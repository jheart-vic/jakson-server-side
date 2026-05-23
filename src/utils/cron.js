const cron = require('node-cron')
const UserInvestment = require('../models/UserInvestment')
const User = require('../models/User')
const Transaction = require('../models/Transaction')
const { notify } = require('../utils/userNotify')

/**
 * Daily income cron (Mon-Fri):
 *
 * CLAIM MECHANICS:
 * ─ Each day's income is queued into user.pendingDailyIncome
 * ─ If the user did NOT claim yesterday's income before today's cron runs,
 *   yesterday's amount is FORFEITED (zeroed out, no transaction)
 * ─ If an investment expires and pendingDailyIncome > 0 and unclaimed, it is forfeited
 * ─ Referral commissions remain automatic (referrers always get paid)
 */
const startDailyIncomeCron = () => {
    const schedule = process.env.CRON_DAILY_INCOME || '0 0 * * *'

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
                forfeited = 0

            if (!isWeekend) {
                const investments = await UserInvestment.find({
                    status: 'in_progress',
                })
                const userSummary = {} // { userId: { total, count } }

                for (const investment of investments) {
                    // Skip if already processed today
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    if (investment.lastIncomeDate) {
                        const last = new Date(investment.lastIncomeDate)
                        last.setHours(0, 0, 0, 0)
                        if (last.getTime() === today.getTime()) continue
                    }

                    const user = await User.findById(investment.user)
                    if (!user || !user.isActive) continue

                    // ── FORFEIT: if user didn't claim yesterday's pending income, zero it ──
                    if (user.pendingDailyIncome > 0) {
                        const lastClaim = user.lastIncomeClaim
                            ? new Date(user.lastIncomeClaim).setHours(
                                  0,
                                  0,
                                  0,
                                  0,
                              )
                            : null
                        const yesterday = new Date(today)
                        yesterday.setDate(yesterday.getDate() - 1)

                        // If no claim was made yesterday (or ever), forfeit
                        if (!lastClaim || lastClaim < yesterday.getTime()) {
                            console.log(
                                `⚠️  Forfeiting $${user.pendingDailyIncome.toFixed(4)} for user ${user._id}`,
                            )
                            user.pendingDailyIncome = 0
                            forfeited++

                            await notify(user._id, {
                                type: 'warning',
                                title: 'Daily Income Forfeited ⚠️',
                                body: "You missed yesterday's claim window. Daily income must be claimed each day — don't forget today's!",
                                metadata: {},
                            })
                        }
                    }

                    const income = investment.dailyIncome

                    // Check if investment is expiring today
                    const isExpiring = now >= investment.expirationDate
                    if (isExpiring) {
                        // Forfeit any remaining pending on expiry
                        if (user.pendingDailyIncome > 0) {
                            user.pendingDailyIncome = 0
                            investment.pendingIncome = 0
                            forfeited++

                            await notify(user._id, {
                                type: 'warning',
                                title: 'Investment Expired — Unclaimed Income Lost ⚠️',
                                body: `Your ${investment.productSnapshot.name} has expired. Any unclaimed income has been forfeited. Always claim before expiry!`,
                                metadata: {},
                            })
                        }
                        investment.status = 'completed'
                        investment.daysElapsed += 1
                        investment.totalEarned += income // still count in total
                        investment.lastIncomeDate = now
                        completed++
                        await user.save({ validateBeforeSave: false })
                        await investment.save()
                        // Still pay referral commissions on last day
                        await payReferralCommissions(investment.user, income)
                        continue
                    }

                    // ── Queue today's income ─────────────────────────────────────────
                    user.pendingDailyIncome =
                        (user.pendingDailyIncome || 0) + income
                    investment.pendingIncome =
                        (investment.pendingIncome || 0) + income
                    investment.daysElapsed += 1
                    investment.totalEarned += income
                    investment.lastIncomeDate = now

                    await user.save({ validateBeforeSave: false })
                    await investment.save()

                    // Accumulate for single notification per user
                    const uid = investment.user.toString()
                    if (!userSummary[uid])
                        userSummary[uid] = { total: 0, count: 0 }
                    userSummary[uid].total += income
                    userSummary[uid].count += 1

                    // Referral commissions — always automatic
                    await payReferralCommissions(investment.user, income)
                    queued++
                }

                // One notification per user with urgency warning
                for (const [userId, { total, count }] of Object.entries(
                    userSummary,
                )) {
                    await notify(userId, {
                        type: 'daily_income',
                        title: 'Claim Your Daily Income Now! ⏰',
                        body:
                            `$${total.toFixed(4)} from ${count} investment${count > 1 ? 's' : ''} is ready. ` +
                            `You must claim TODAY — unclaimed income is forfeited at midnight.`,
                        metadata: { total, count },
                    })
                }

                console.log(
                    `✅ Income queued: ${queued} | Completed: ${completed} | Forfeited: ${forfeited}`,
                )
            } else {
                console.log(
                    `🌙 Weekend (${now.toDateString()}) – skipping income distribution.`,
                )
            }

            // Reset today → yesterday for all users (every day)
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

const payReferralCommissions = async (userId, incomeAmount) => {
    const TIERS = [{ percent: 0.03 }, { percent: 0.02 }, { percent: 0.01 }]
    let currentUserId = userId
    for (const tier of TIERS) {
        const user = await User.findById(currentUserId)
        if (!user || !user.referredBy) break
        const referrer = await User.findById(user.referredBy)
        if (!referrer || !referrer.isActive) break

        const commission = +(incomeAmount * tier.percent).toFixed(6)
        if (commission <= 0) continue

        const balanceBefore = referrer.balance
        referrer.balance += commission
        referrer.totalEarnings += commission
        referrer.todayEarnings += commission
        await referrer.save({ validateBeforeSave: false })

        await Transaction.create({
            user: referrer._id,
            type: 'in',
            category: 'referral_bonus',
            amountUSD: commission,
            balanceBefore,
            balanceAfter: referrer.balance,
            description: `Referral commission (${(tier.percent * 100).toFixed(0)}%) from daily income`,
        })

        await notify(referrer._id, {
            type: 'referral_bonus',
            title: 'Referral Commission Earned 🤝',
            body: `You earned $${commission.toFixed(6)} (${(tier.percent * 100).toFixed(0)}%) from your team's daily income.`,
            metadata: { commission, percent: tier.percent * 100 },
        })

        currentUserId = referrer._id
    }
}

module.exports = { startDailyIncomeCron }
