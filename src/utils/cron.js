const cron     = require('node-cron')
const mongoose = require('mongoose')
const UserInvestment = require('../models/UserInvestment')
const User           = require('../models/User')
const AppSettings    = require('../models/AppSettings')
const { notify }     = require('../utils/userNotify')

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the most recent weekday (Mon–Fri) strictly before `date` at 00:00.
 * Used to determine whether a claim counts as "today's" or is stale.
 */
const lastWeekdayBefore = (date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    do { d.setDate(d.getDate() - 1) }
    while (d.getDay() === 0 || d.getDay() === 6)
    return d
}

/**
 * Groups an array of investments by their `user` field (string).
 */
const groupByUser = (investments) => {
    const map = {}
    for (const inv of investments) {
        const uid = inv.user.toString()
        if (!map[uid]) map[uid] = []
        map[uid].push(inv)
    }
    return map
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDNIGHT FORFEIT  (00:00 every day)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forfeits any pendingIncome that was not claimed before midnight.
 *
 * Runs BEFORE the 7 AM income queue so the slate is clean when new
 * income is distributed. Runs on weekends too — Friday income can
 * still be forfeited at Saturday 00:00 if unclaimed.
 *
 * Safe to call manually if the scheduled run is ever missed.
 */
const runMidnightForfeit = async () => {
    console.log(`🌙 [${new Date().toISOString()}] Starting midnight forfeit...`)

    try {
        const today            = new Date()
        today.setHours(0, 0, 0, 0)
        const lastValidWeekday = lastWeekdayBefore(today)

        // Only fetch investments that actually have something to forfeit
        const investments = await UserInvestment.find({
            status:        'in_progress',
            pendingIncome: { $gt: 0 },
        })

        const byUser = groupByUser(
            investments.filter((inv) => {
                const lastClaim = inv.lastIncomeClaim
                    ? new Date(inv.lastIncomeClaim).setHours(0, 0, 0, 0)
                    : null
                // Keep only investments whose last claim predates the last valid weekday
                return !lastClaim || lastClaim < lastValidWeekday.getTime()
            }),
        )

        let totalForfeited = 0
        let totalFailed    = 0

        for (const [uid, userInvestments] of Object.entries(byUser)) {
            const session = await mongoose.startSession()
            try {
                await session.withTransaction(async () => {
                    const user = await User.findById(uid).session(session)
                    if (!user) return

                    let count = 0
                    for (const inv of userInvestments) {
                        console.log(
                            `  ⚠️  Forfeiting $${inv.pendingIncome.toFixed(4)} ` +
                            `for investment ${inv._id} (user ${uid})`,
                        )
                        user.pendingDailyIncome = Math.max(
                            0,
                            (user.pendingDailyIncome || 0) - inv.pendingIncome,
                        )
                        inv.pendingIncome = 0
                        await inv.save({ session })
                        totalForfeited++
                        count++
                    }

                    await user.save({ validateBeforeSave: false, session })

                    notify(uid, {
                        type:  'system',
                        title: 'Unclaimed Income Forfeited ⚠️',
                        body:  `${count} investment${count > 1 ? 's' : ''} had unclaimed income ` +
                               `that expired at midnight. Claim your income daily before 12 AM to keep it.`,
                        metadata: { count },
                    })
                })
            } catch (err) {
                totalFailed++
                console.error(`  ❌ Forfeit transaction failed for user ${uid}:`, err.message)
            } finally {
                await session.endSession()
            }
        }

        console.log(
            `🌙 Midnight forfeit complete — forfeited: ${totalForfeited} | failed: ${totalFailed}`,
        )
    } catch (err) {
        console.error('❌ Midnight forfeit cron error:', err)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY INCOME QUEUE  (07:00 Mon–Fri)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Queues daily income into each active investment's `pendingIncome`.
 * Users must claim individually via POST /api/invest/:id/claim.
 *
 * Also handles:
 * - Expiring investments (marks completed, no new income queued)
 * - Rolling todayEarnings → yesterdayEarnings (once per calendar day)
 *
 * Safe to call manually via triggerIncome.js if the scheduled run is missed.
 */
const runDailyIncome = async () => {
    console.log(`🌞 [${new Date().toISOString()}] Starting daily income queue...`)

    try {
        const now       = new Date()
        const isWeekend = now.getDay() === 0 || now.getDay() === 6

        if (isWeekend) {
            console.log(`🌙 Weekend (${now.toDateString()}) — skipping income distribution.`)
        } else {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            // Fetch only investments not already processed today
            const investments = await UserInvestment.find({ status: 'in_progress' })
            const due = investments.filter((inv) => {
                if (!inv.lastIncomeDate) return true
                const last = new Date(inv.lastIncomeDate)
                last.setHours(0, 0, 0, 0)
                return last.getTime() !== today.getTime()
            })

            const byUser = groupByUser(due)

            let queued = 0, completed = 0, failed = 0

            for (const [uid, userInvestments] of Object.entries(byUser)) {
                const session = await mongoose.startSession()
                try {
                    await session.withTransaction(async () => {
                        const user = await User.findById(uid).session(session)
                        if (!user || !user.isActive) return

                        let userQueuedTotal = 0
                        let userQueuedCount = 0
                        let anyExpiredWhilePending = false

                        for (const inv of userInvestments) {
                            const income     = inv.dailyIncome
                            const isExpiring = now >= inv.expirationDate

                            if (isExpiring) {
                                // Clear any residual pending income on expiry
                                if (inv.pendingIncome > 0) {
                                    user.pendingDailyIncome = Math.max(
                                        0,
                                        (user.pendingDailyIncome || 0) - inv.pendingIncome,
                                    )
                                    inv.pendingIncome      = 0
                                    anyExpiredWhilePending = true
                                }
                                inv.status         = 'completed'
                                inv.daysElapsed   += 1
                                inv.totalEarned   += income
                                inv.lastIncomeDate = now
                                await inv.save({ session })
                                completed++
                                continue
                            }

                            // Queue today's income
                            inv.pendingIncome  = (inv.pendingIncome || 0) + income
                            inv.daysElapsed   += 1
                            inv.totalEarned   += income
                            inv.lastIncomeDate = now
                            await inv.save({ session })

                            user.pendingDailyIncome = (user.pendingDailyIncome || 0) + income
                            userQueuedTotal += income
                            userQueuedCount++
                            queued++
                        }

                        await user.save({ validateBeforeSave: false, session })

                        if (anyExpiredWhilePending) {
                            notify(uid, {
                                type:  'system',
                                title: 'Investment Expired — Unclaimed Income Lost ⚠️',
                                body:  'One of your investments expired with unclaimed income. Always claim before expiry!',
                                metadata: {},
                            })
                        }

                        if (userQueuedCount > 0) {
                            notify(uid, {
                                type:  'daily_income',
                                title: 'Claim Your Daily Income Now! ⏰',
                                body:  `$${userQueuedTotal.toFixed(4)} from ` +
                                       `${userQueuedCount} investment${userQueuedCount > 1 ? 's' : ''} ` +
                                       `is ready to claim. Unclaimed income is forfeited at midnight.`,
                                metadata: { total: userQueuedTotal, count: userQueuedCount },
                            })
                        }
                    })
                } catch (err) {
                    failed++
                    console.error(`  ❌ Income transaction failed for user ${uid}:`, err.message)
                } finally {
                    await session.endSession()
                }
            }

            console.log(
                `✅ Income queued: ${queued} | Completed: ${completed} | Failed: ${failed}`,
            )
        }

        // ── Roll todayEarnings → yesterdayEarnings (once per calendar day) ──
        const todayMidnight = new Date()
        todayMidnight.setHours(0, 0, 0, 0)

        const lastReset    = await AppSettings.get('last_earnings_reset')
        const alreadyReset = lastReset
            ? new Date(lastReset).setHours(0, 0, 0, 0) >= todayMidnight.getTime()
            : false

        if (!alreadyReset) {
            await User.updateMany({}, [
                { $set: { yesterdayEarnings: '$todayEarnings', todayEarnings: 0 } },
            ])
            await AppSettings.set('last_earnings_reset', new Date().toISOString())
            console.log('🔄 Rolled todayEarnings → yesterdayEarnings')
        } else {
            console.log('⏭️  Earnings reset already done today — skipping')
        }
    } catch (err) {
        console.error('❌ Daily income cron error:', err)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULERS
// ─────────────────────────────────────────────────────────────────────────────

const startMidnightForfeitCron = () => {
    // Every day at 00:00 — weekends included
    cron.schedule('0 0 * * *', async () => {
        await runMidnightForfeit()
    })
    console.log('⏰ Midnight forfeit cron scheduled  [0 0 * * *]')
}

const startDailyIncomeCron = () => {
    const schedule = process.env.CRON_DAILY_INCOME || '0 7 * * 1-5'
    cron.schedule(schedule, async () => {
        await runDailyIncome()
    })
    console.log(`⏰ Daily income cron scheduled      [${schedule}]`)
}

/**
 * Call once at server startup:
 *
 *   const { startCrons } = require('./cron/dailyIncomeCron')
 *   startCrons()
 */
const startCrons = () => {
    startMidnightForfeitCron()
    startDailyIncomeCron()
}

module.exports = {
    startCrons,
    startDailyIncomeCron,
    startMidnightForfeitCron,
    runDailyIncome,
    runMidnightForfeit,
}