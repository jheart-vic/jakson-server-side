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
 * ─ Each user's entire processing block runs inside a MongoDB transaction
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
    const schedule = process.env.CRON_DAILY_INCOME || '0 8 * * 1-5'

    cron.schedule(schedule, async () => {
        console.log(
            `🌞 [${new Date().toISOString()}] Running daily income cron...`,
        )
        try {
            const now = new Date()
            const isWeekend = now.getDay() === 0 || now.getDay() === 6

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

                // Group by user — one DB transaction per user
                const byUser = {}
                for (const inv of investments) {
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
                    const session = await mongoose.startSession()
                    try {
                        await session.withTransaction(async () => {
                            const user =
                                await User.findById(uid).session(session)
                            if (!user || !user.isActive) return

                            let userQueuedTotal = 0
                            let userQueuedCount = 0
                            let userForfeitedCount = 0
                            let anyExpiredWhilePending = false

                            for (const investment of userInvestments) {
                                const income = investment.dailyIncome
                                const isExpiring =
                                    now >= investment.expirationDate

                                // ── Per-investment forfeit check ───────────────
                                if (investment.pendingIncome > 0) {
                                    const lastClaim = investment.lastIncomeClaim
                                        ? new Date(
                                              investment.lastIncomeClaim,
                                          ).setHours(0, 0, 0, 0)
                                        : null

                                    if (
                                        !lastClaim ||
                                        lastClaim < lastValidWeekday.getTime()
                                    ) {
                                        console.log(
                                            `⚠️  Forfeiting $${investment.pendingIncome.toFixed(4)} ` +
                                                `for investment ${investment._id} (user ${uid})`,
                                        )
                                        user.pendingDailyIncome = Math.max(
                                            0,
                                            (user.pendingDailyIncome || 0) -
                                                investment.pendingIncome,
                                        )
                                        investment.pendingIncome = 0
                                        forfeited++
                                        userForfeitedCount++
                                    }
                                }

                                if (isExpiring) {
                                    if (investment.pendingIncome > 0) {
                                        user.pendingDailyIncome = Math.max(
                                            0,
                                            (user.pendingDailyIncome || 0) -
                                                investment.pendingIncome,
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
                                    // Pass investment._id so referral txns are traceable
                                    await payReferralCommissions(
                                        user._id,
                                        income,
                                        investment._id,
                                        session,
                                    )
                                    continue
                                }

                                // ── Queue today's income ───────────────────────
                                investment.pendingIncome =
                                    (investment.pendingIncome || 0) + income
                                investment.daysElapsed += 1
                                investment.totalEarned += income
                                investment.lastIncomeDate = now
                                await investment.save({ session })

                                user.pendingDailyIncome =
                                    (user.pendingDailyIncome || 0) + income
                                userQueuedTotal += income
                                userQueuedCount++
                                queued++

                                // Pass investment._id so referral txns are traceable
                                await payReferralCommissions(
                                    user._id,
                                    income,
                                    investment._id,
                                    session,
                                )
                            }

                            await user.save({
                                validateBeforeSave: false,
                                session,
                            })

                            // Notifications — fire-and-forget, not part of the transaction
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
                                    metadata: {
                                        total: userQueuedTotal,
                                        count: userQueuedCount,
                                    },
                                })
                            }
                        })
                    } catch (userErr) {
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

            // Reset today → yesterday for all users (runs every day including weekends)
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
 *
 * @param {ObjectId} userId         - The investor whose income triggered commissions
 * @param {number}   incomeAmount   - The daily income amount that generates commissions
 * @param {ObjectId} investmentId   - The UserInvestment _id — stored as refId on each
 *                                    commission transaction so it's fully traceable
 * @param {ClientSession} session   - Mongoose session — runs inside the caller's transaction
 */
const payReferralCommissions = async (
    userId,
    incomeAmount,
    investmentId,
    session,
) => {
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
            [
                {
                    user: referrer._id,
                    type: 'in',
                    category: 'referral_bonus',
                    amountUSD: commission,
                    balanceBefore,
                    balanceAfter: referrer.balance,
                    description: `Referral commission (${(tier.percent * 100).toFixed(0)}%) from daily income`,
                    // Now fully traceable: which investment generated this commission
                    refModel: 'UserInvestment',
                    refId: investmentId,
                },
            ],
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
