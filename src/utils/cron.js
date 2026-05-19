const cron = require('node-cron');
const UserInvestment = require('../models/UserInvestment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

/**
 * Runs daily at midnight to:
 * 1. Credit each active investment's daily income (Mon-Fri only)
 * 2. Mark investments as completed if expired
 * 3. Reset today/yesterday earnings tracking (every day)
 */
const startDailyIncomeCron = () => {
  const schedule = process.env.CRON_DAILY_INCOME || '0 0 * * *';

  cron.schedule(schedule, async () => {
    console.log(`🌞 [${new Date().toISOString()}] Running daily income cron...`);

    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

      let credited = 0;
      let completed = 0;

      // 1. Process investments only on weekdays
      if (!isWeekend) {
        const investments = await UserInvestment.find({ status: 'in_progress' });

        for (const investment of investments) {
          // Skip if income already given today
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (investment.lastIncomeDate) {
            const lastDate = new Date(investment.lastIncomeDate);
            lastDate.setHours(0, 0, 0, 0);
            if (lastDate.getTime() === today.getTime()) continue;
          }

          const user = await User.findById(investment.user);
          if (!user || !user.isActive) continue;

          const income = investment.dailyIncome;
          const balanceBefore = user.balance;

          // Credit income
          user.balance += income;
          user.totalEarnings += income;
          user.todayEarnings += income;
          investment.totalEarned += income;
          investment.daysElapsed += 1;
          investment.lastIncomeDate = now;

          // Check if expired
          if (now >= investment.expirationDate) {
            investment.status = 'completed';
            completed++;
          }

          await user.save({ validateBeforeSave: false });
          await investment.save();

          // Record transaction
          await Transaction.create({
            user: investment.user,
            type: 'in',
            category: 'daily_income',
            amountUSD: income,
            balanceBefore,
            balanceAfter: user.balance,
            description: `Daily income from ${investment.productSnapshot.name}`,
            refModel: 'UserInvestment',
            refId: investment._id,
          });

          // Pay referral commissions (3%, 2%, 1%)
          await payReferralCommissions(investment.user, income);

          credited++;
        }

        console.log(`✅ Daily income credited: ${credited} investments, Completed: ${completed}`);
      } else {
        console.log(`🌙 Weekend (${now.toDateString()}) – skipping income distribution.`);
      }

      // 2. Reset today → yesterday for all users (runs every day regardless of weekend)
      await User.updateMany(
        {},
        [
          { $set: { yesterdayEarnings: '$todayEarnings', todayEarnings: 0 } },
        ]
      );
      console.log(`🔄 Reset todayEarnings → yesterdayEarnings for all users`);

    } catch (err) {
      console.error('❌ Daily income cron error:', err);
    }
  });

  console.log('⏰ Daily income cron scheduled (Mon-Fri only for earnings, reset runs daily)');
};

/**
 * Pay referral commissions up to 3 tiers
 * Level 1 (direct): 3%
 * Level 2: 2%
 * Level 3: 1%
 */
const payReferralCommissions = async (userId, incomeAmount) => {
  const TIERS = [
    { percent: 0.03 }, // 3% for level 1
    { percent: 0.02 }, // 2% for level 2
    { percent: 0.01 }, // 1% for level 3
  ];

  let currentUserId = userId;

  for (const tier of TIERS) {
    const user = await User.findById(currentUserId);
    if (!user || !user.referredBy) break;

    const referrer = await User.findById(user.referredBy);
    if (!referrer || !referrer.isActive) break;

    const commission = +(incomeAmount * tier.percent).toFixed(6);
    if (commission <= 0) continue; // skip zero or negative

    const balanceBefore = referrer.balance;

    referrer.balance += commission;
    referrer.totalEarnings += commission;
    referrer.todayEarnings += commission;
    await referrer.save({ validateBeforeSave: false });

    await Transaction.create({
      user: referrer._id,
      type: 'in',
      category: 'referral_bonus',
      amountUSD: commission,
      balanceBefore,
      balanceAfter: referrer.balance,
      description: `Referral commission (${(tier.percent * 100).toFixed(0)}%) from daily income`,
    });

    currentUserId = referrer._id;
  }
};

module.exports = { startDailyIncomeCron };