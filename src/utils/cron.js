// const cron = require('node-cron')
// const UserInvestment = require('../models/UserInvestment')
// const User = require('../models/User')
// const Transaction = require('../models/Transaction')
// const { notify } = require('../utils/userNotify')

// /**
//  * Daily income cron (Mon-Fri):
//  *
//  * CLAIM MECHANICS:
//  * ─ Each day's income is queued into investment.pendingIncome (per-investment)
//  *   and mirrored into user.pendingDailyIncome (aggregate, for dashboard display)
//  * ─ Users claim each investment independently via POST /api/invest/:id/claim
//  * ─ If a specific investment's pendingIncome was NOT claimed before today's cron
//  *   runs, that investment's amount is FORFEITED individually
//  * ─ Forfeit uses lastValidWeekday (not "yesterday") so a weekend gap never
//  *   counts as a missed day
//  * ─ Referral commissions remain automatic (referrers always get paid)
//  */

// /**
//  * Returns midnight of the most recent weekday (Mon–Fri) strictly before `date`.
//  * e.g. called on Monday → returns last Friday midnight.
//  */
// const lastWeekdayBefore = (date) => {
//     const d = new Date(date)
//     d.setHours(0, 0, 0, 0)
//     do {
//         d.setDate(d.getDate() - 1)
//     } while (d.getDay() === 0 || d.getDay() === 6)
//     return d
// }

// const startDailyIncomeCron = () => {
//     // 8 AM Mon–Fri — gives users the full day to claim each investment
//     const schedule = process.env.CRON_DAILY_INCOME || '0 8 * * 1-5'

//     cron.schedule(schedule, async () => {
//         console.log(
//             `🌞 [${new Date().toISOString()}] Running daily income cron...`,
//         )
//         try {
//             const now = new Date()
//             const dayOfWeek = now.getDay()
//             const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

//             let queued = 0,
//                 completed = 0,
//                 forfeited = 0

//             if (!isWeekend) {
//                 const today = new Date()
//                 today.setHours(0, 0, 0, 0)
//                 const lastValidWeekday = lastWeekdayBefore(today)

//                 const investments = await UserInvestment.find({
//                     status: 'in_progress',
//                 })

//                 // Group by user to load each User doc once and send
//                 // one notification per user instead of one per investment
//                 const byUser = {}
//                 for (const inv of investments) {
//                     // Skip if already processed today
//                     if (inv.lastIncomeDate) {
//                         const last = new Date(inv.lastIncomeDate)
//                         last.setHours(0, 0, 0, 0)
//                         if (last.getTime() === today.getTime()) continue
//                     }
//                     const uid = inv.user.toString()
//                     if (!byUser[uid]) byUser[uid] = []
//                     byUser[uid].push(inv)
//                 }

//                 for (const [uid, userInvestments] of Object.entries(byUser)) {
//                     const user = await User.findById(uid)
//                     if (!user || !user.isActive) continue

//                     let userQueuedTotal = 0
//                     let userQueuedCount = 0
//                     let userForfeitedCount = 0
//                     let anyExpiredWhilePending = false

//                     for (const investment of userInvestments) {
//                         const income = investment.dailyIncome
//                         const isExpiring = now >= investment.expirationDate

//                         // ── Per-investment forfeit check ───────────────────────
//                         // If this investment still has unclaimed income from a
//                         // previous weekday, forfeit it before queuing today's.
//                         if (investment.pendingIncome > 0) {
//                             const lastClaim = investment.lastIncomeClaim
//                                 ? new Date(investment.lastIncomeClaim).setHours(0, 0, 0, 0)
//                                 : null

//                             if (!lastClaim || lastClaim < lastValidWeekday.getTime()) {
//                                 console.log(
//                                     `⚠️  Forfeiting $${investment.pendingIncome.toFixed(4)} ` +
//                                     `for investment ${investment._id} (user ${uid})`,
//                                 )
//                                 // Subtract forfeited amount from the user aggregate
//                                 user.pendingDailyIncome = Math.max(
//                                     0,
//                                     (user.pendingDailyIncome || 0) - investment.pendingIncome,
//                                 )
//                                 investment.pendingIncome = 0
//                                 forfeited++
//                                 userForfeitedCount++
//                             }
//                         }

//                         if (isExpiring) {
//                             // Forfeit any still-pending income on this expiring investment
//                             if (investment.pendingIncome > 0) {
//                                 user.pendingDailyIncome = Math.max(
//                                     0,
//                                     (user.pendingDailyIncome || 0) - investment.pendingIncome,
//                                 )
//                                 investment.pendingIncome = 0
//                                 forfeited++
//                                 anyExpiredWhilePending = true
//                             }
//                             investment.status = 'completed'
//                             investment.daysElapsed += 1
//                             investment.totalEarned += income
//                             investment.lastIncomeDate = now
//                             completed++
//                             await investment.save()
//                             await payReferralCommissions(user._id, income)
//                             continue
//                         }

//                         // ── Queue today's income for this investment ───────────
//                         investment.pendingIncome = (investment.pendingIncome || 0) + income
//                         investment.daysElapsed += 1
//                         investment.totalEarned += income
//                         investment.lastIncomeDate = now
//                         await investment.save()

//                         // Mirror into user aggregate for dashboard display
//                         user.pendingDailyIncome = (user.pendingDailyIncome || 0) + income

//                         userQueuedTotal += income
//                         userQueuedCount++
//                         queued++

//                         await payReferralCommissions(user._id, income)
//                     }

//                     await user.save({ validateBeforeSave: false })

//                     // Single forfeit notification per user (not per investment)
//                     if (userForfeitedCount > 0) {
//                         await notify(uid, {
//                             type: 'warning',
//                             title: 'Daily Income Forfeited ⚠️',
//                             body: `${userForfeitedCount} investment${userForfeitedCount > 1 ? 's' : ''} had unclaimed income that was forfeited. Claim each investment daily to avoid losing income.`,
//                             metadata: { count: userForfeitedCount },
//                         })
//                     }

//                     // Single expiry-forfeit notification per user
//                     if (anyExpiredWhilePending) {
//                         await notify(uid, {
//                             type: 'warning',
//                             title: 'Investment Expired — Unclaimed Income Lost ⚠️',
//                             body: 'One of your investments expired with unclaimed income. Always claim before expiry!',
//                             metadata: {},
//                         })
//                     }

//                     // Single income-ready notification listing total across all investments
//                     if (userQueuedCount > 0) {
//                         await notify(uid, {
//                             type: 'daily_income',
//                             title: 'Claim Your Daily Income Now! ⏰',
//                             body:
//                                 `$${userQueuedTotal.toFixed(4)} from ${userQueuedCount} investment${userQueuedCount > 1 ? 's' : ''} is ready to claim. ` +
//                                 `Each investment must be claimed individually — unclaimed income is forfeited tomorrow morning.`,
//                             metadata: { total: userQueuedTotal, count: userQueuedCount },
//                         })
//                     }
//                 }

//                 console.log(
//                     `✅ Income queued: ${queued} | Completed: ${completed} | Forfeited: ${forfeited}`,
//                 )
//             } else {
//                 console.log(
//                     `🌙 Weekend (${now.toDateString()}) – skipping income distribution.`,
//                 )
//             }

//             // Reset today → yesterday for all users (runs every day including weekends)
//             await User.updateMany({}, [
//                 {
//                     $set: {
//                         yesterdayEarnings: '$todayEarnings',
//                         todayEarnings: 0,
//                     },
//                 },
//             ])
//             console.log('🔄 Reset todayEarnings → yesterdayEarnings')
//         } catch (err) {
//             console.error('❌ Daily income cron error:', err)
//         }
//     })

//     console.log('⏰ Daily income cron scheduled')
// }

// const payReferralCommissions = async (userId, incomeAmount) => {
//     const TIERS = [{ percent: 0.03 }, { percent: 0.02 }, { percent: 0.01 }]
//     let currentUserId = userId
//     for (const tier of TIERS) {
//         const user = await User.findById(currentUserId)
//         if (!user || !user.referredBy) break
//         const referrer = await User.findById(user.referredBy)
//         if (!referrer || !referrer.isActive) break

//         const commission = +(incomeAmount * tier.percent).toFixed(6)
//         if (commission <= 0) continue

//         const balanceBefore = referrer.balance
//         referrer.balance += commission
//         referrer.totalEarnings += commission
//         referrer.todayEarnings += commission
//         await referrer.save({ validateBeforeSave: false })

//         await Transaction.create({
//             user: referrer._id,
//             type: 'in',
//             category: 'referral_bonus',
//             amountUSD: commission,
//             balanceBefore,
//             balanceAfter: referrer.balance,
//             description: `Referral commission (${(tier.percent * 100).toFixed(0)}%) from daily income`,
//         })

//         await notify(referrer._id, {
//             type: 'referral_bonus',
//             title: 'Referral Commission Earned 🤝',
//             body: `You earned $${commission.toFixed(6)} (${(tier.percent * 100).toFixed(0)}%) from your team's daily income.`,
//             metadata: { commission, percent: tier.percent * 100 },
//         })

//         currentUserId = referrer._id
//     }
// }

// module.exports = { startDailyIncomeCron }

const cron = require('node-cron')
const mongoose = require('mongoose')
const UserInvestment = require('../models/UserInvestment')
const User = require('../models/User')
const Transaction = require('../models/Transaction')
const { notify } = require('../utils/userNotify')

/**
 * Daily income cron (Mon-Fri):
 *
 * CLAIM MECHANICS:
 * ─ Each day's income is queued into investment.pendingIncome (per-investment)
 *   and mirrored into user.pendingDailyIncome (aggregate, for dashboard display)
 * ─ Users claim each investment independently via POST /api/invest/:id/claim
 * ─ If a specific investment's pendingIncome was NOT claimed before today's cron
 *   runs, that investment's amount is FORFEITED individually
 * ─ Forfeit uses lastValidWeekday (not "yesterday") so a weekend gap never
 *   counts as a missed day
 * ─ Referral commissions remain automatic (referrers always get paid)
 * ─ Each user's entire processing block runs inside a MongoDB transaction —
 *   if anything fails mid-user, all writes for that user roll back cleanly
 */

/**
 * Returns midnight of the most recent weekday (Mon–Fri) strictly before `date`.
 * e.g. called on Monday → returns last Friday midnight.
 */
const lastWeekdayBefore = (date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    do {
        d.setDate(d.getDate() - 1)
    } while (d.getDay() === 0 || d.getDay() === 6)
    return d
}

const startDailyIncomeCron = () => {
    // 8 AM Mon–Fri — gives users the full day to claim each investment
    const schedule = process.env.CRON_DAILY_INCOME || '0 8 * * 1-5'

    cron.schedule(schedule, async () => {
        console.log(
            `🌞 [${new Date().toISOString()}] Running daily income cron...`,
        )
        try {
            const now = new Date()
            const dayOfWeek = now.getDay()
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

            let queued = 0,
                completed = 0,
                forfeited = 0,
                failed = 0

            if (!isWeekend) {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const lastValidWeekday = lastWeekdayBefore(today)

                const investments = await UserInvestment.find({
                    status: 'in_progress',
                })

                // Group by user — one transaction per user, not per investment
                const byUser = {}
                for (const inv of investments) {
                    // Skip if already processed today
                    if (inv.lastIncomeDate) {
                        const last = new Date(inv.lastIncomeDate)
                        last.setHours(0, 0, 0, 0)
                        if (last.getTime() === today.getTime()) continue
                    }
                    const uid = inv.user.toString()
                    if (!byUser[uid]) byUser[uid] = []
                    byUser[uid].push(inv)
                }

                for (const [uid, userInvestments] of Object.entries(byUser)) {
                    // ── One MongoDB transaction per user ───────────────────────
                    // If anything throws inside, ALL writes for this user roll
                    // back automatically — no partial state, no stale aggregates.
                    const session = await mongoose.startSession()
                    try {
                        await session.withTransaction(async () => {
                            const user = await User.findById(uid).session(session)
                            if (!user || !user.isActive) return // skip inside tx

                            let userQueuedTotal = 0
                            let userQueuedCount = 0
                            let userForfeitedCount = 0
                            let anyExpiredWhilePending = false

                            for (const investment of userInvestments) {
                                const income = investment.dailyIncome
                                const isExpiring = now >= investment.expirationDate

                                // ── Per-investment forfeit check ───────────────
                                if (investment.pendingIncome > 0) {
                                    const lastClaim = investment.lastIncomeClaim
                                        ? new Date(investment.lastIncomeClaim).setHours(0, 0, 0, 0)
                                        : null

                                    if (!lastClaim || lastClaim < lastValidWeekday.getTime()) {
                                        console.log(
                                            `⚠️  Forfeiting $${investment.pendingIncome.toFixed(4)} ` +
                                            `for investment ${investment._id} (user ${uid})`,
                                        )
                                        user.pendingDailyIncome = Math.max(
                                            0,
                                            (user.pendingDailyIncome || 0) - investment.pendingIncome,
                                        )
                                        investment.pendingIncome = 0
                                        forfeited++
                                        userForfeitedCount++
                                    }
                                }

                                if (isExpiring) {
                                    // Forfeit any still-pending on expiry
                                    if (investment.pendingIncome > 0) {
                                        user.pendingDailyIncome = Math.max(
                                            0,
                                            (user.pendingDailyIncome || 0) - investment.pendingIncome,
                                        )
                                        investment.pendingIncome = 0
                                        forfeited++
                                        anyExpiredWhilePending = true
                                    }
                                    investment.status = 'completed'
                                    investment.daysElapsed += 1
                                    investment.totalEarned += income
                                    investment.lastIncomeDate = now
                                    completed++
                                    await investment.save({ session })
                                    // Referral commissions run inside the same tx
                                    await payReferralCommissions(user._id, income, session)
                                    continue
                                }

                                // ── Queue today's income ───────────────────────
                                investment.pendingIncome = (investment.pendingIncome || 0) + income
                                investment.daysElapsed += 1
                                investment.totalEarned += income
                                investment.lastIncomeDate = now
                                await investment.save({ session })

                                user.pendingDailyIncome = (user.pendingDailyIncome || 0) + income
                                userQueuedTotal += income
                                userQueuedCount++
                                queued++

                                await payReferralCommissions(user._id, income, session)
                            }

                            // Save user aggregate once, inside the transaction
                            await user.save({ validateBeforeSave: false, session })

                            // ── Notifications (outside tx — non-critical) ──────
                            // Notifications are fire-and-forget; a notify failure
                            // should never roll back financial writes.
                            if (userForfeitedCount > 0) {
                                notify(uid, {
                                    type: 'warning',
                                    title: 'Daily Income Forfeited ⚠️',
                                    body: `${userForfeitedCount} investment${userForfeitedCount > 1 ? 's' : ''} had unclaimed income that was forfeited. Claim each investment daily to avoid losing income.`,
                                    metadata: { count: userForfeitedCount },
                                })
                            }

                            if (anyExpiredWhilePending) {
                                notify(uid, {
                                    type: 'warning',
                                    title: 'Investment Expired — Unclaimed Income Lost ⚠️',
                                    body: 'One of your investments expired with unclaimed income. Always claim before expiry!',
                                    metadata: {},
                                })
                            }

                            if (userQueuedCount > 0) {
                                notify(uid, {
                                    type: 'daily_income',
                                    title: 'Claim Your Daily Income Now! ⏰',
                                    body:
                                        `$${userQueuedTotal.toFixed(4)} from ${userQueuedCount} investment${userQueuedCount > 1 ? 's' : ''} is ready to claim. ` +
                                        `Each investment must be claimed individually — unclaimed income is forfeited tomorrow morning.`,
                                    metadata: { total: userQueuedTotal, count: userQueuedCount },
                                })
                            }
                        })
                    } catch (userErr) {
                        // One user's failure is isolated — log and continue to next user
                        failed++
                        console.error(
                            `❌ Transaction failed for user ${uid} — rolled back:`,
                            userErr.message,
                        )
                    } finally {
                        await session.endSession()
                    }
                }

                console.log(
                    `✅ Income queued: ${queued} | Completed: ${completed} | ` +
                    `Forfeited: ${forfeited} | Failed (rolled back): ${failed}`,
                )
            } else {
                console.log(
                    `🌙 Weekend (${now.toDateString()}) – skipping income distribution.`,
                )
            }

            // Reset today → yesterday for all users (every day including weekends).
            // Runs outside per-user transactions — it's a bulk reset, not per-user
            // financial data, so a partial failure here is acceptable and recoverable.
            await User.updateMany({}, [
                {
                    $set: {
                        yesterdayEarnings: '$todayEarnings',
                        todayEarnings: 0,
                    },
                },
            ])
            console.log('🔄 Reset todayEarnings → yesterdayEarnings')
        } catch (err) {
            console.error('❌ Daily income cron error:', err)
        }
    })

    console.log('⏰ Daily income cron scheduled')
}

/**
 * Pay referral commissions up 3 tiers for a given income amount.
 * Runs inside the caller's MongoDB session so it's part of the same transaction.
 */
const payReferralCommissions = async (userId, incomeAmount, session) => {
    const TIERS = [{ percent: 0.03 }, { percent: 0.02 }, { percent: 0.01 }]
    let currentUserId = userId

    for (const tier of TIERS) {
        const user = await User.findById(currentUserId).session(session)
        if (!user || !user.referredBy) break

        const referrer = await User.findById(user.referredBy).session(session)
        if (!referrer || !referrer.isActive) break

        const commission = +(incomeAmount * tier.percent).toFixed(6)
        if (commission <= 0) continue

        const balanceBefore = referrer.balance
        referrer.balance += commission
        referrer.totalEarnings += commission
        referrer.todayEarnings += commission
        await referrer.save({ validateBeforeSave: false, session })

        await Transaction.create(
            [{
                user: referrer._id,
                type: 'in',
                category: 'referral_bonus',
                amountUSD: commission,
                balanceBefore,
                balanceAfter: referrer.balance,
                description: `Referral commission (${(tier.percent * 100).toFixed(0)}%) from daily income`,
            }],
            { session },
        )

        // Notify is fire-and-forget — not part of the transaction
        notify(referrer._id, {
            type: 'referral_bonus',
            title: 'Referral Commission Earned 🤝',
            body: `You earned $${commission.toFixed(6)} (${(tier.percent * 100).toFixed(0)}%) from your team's daily income.`,
            metadata: { commission, percent: tier.percent * 100 },
        })

        currentUserId = referrer._id
    }
}

module.exports = { startDailyIncomeCron }