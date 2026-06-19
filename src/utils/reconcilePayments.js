const cron = require('node-cron')

const Withdrawal = require('../models/Withdrawal')
const Deposit    = require('../models/Deposit')
const gateway    = require('../utils/paymentGateway')

const {
  completeWithdrawalByDoc,
  refundWithdrawalByDoc,
} = require('../controllers/withdrawController')
const { creditDepositByDoc, rejectDepositByDoc } = require('../controllers/depositController')

const MAX_AGE_DAYS = 7
const BATCH_LIMIT = 50
const sinceDate = () => new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000)

const reconcileWithdrawals = async () => {
  const list = await Withdrawal.find({
    status: 'processing',
    createdAt: { $gte: sinceDate() },
  }).sort({ createdAt: 1 }).limit(BATCH_LIMIT)

  let completed = 0, refunded = 0, pending = 0, errored = 0
  for (const w of list) {
    try {
      const res = await gateway.queryPayoutOrder(w._id.toString())
      const data = res && res.data
      if (!res || res.code !== 200 || !data) { errored++; continue }
      const status = Number(data.orderStatus)
      if (status === gateway.PAYOUT_STATUS.COMPLETED) {
        await completeWithdrawalByDoc(w); completed++
      } else if (status === gateway.PAYOUT_STATUS.FAILED || status === gateway.PAYOUT_STATUS.REFUNDED) {
        await refundWithdrawalByDoc(w, (data.failReason || data.orderRemarks) || 'Payout failed at gateway'); refunded++
      } else { pending++ }
    } catch (err) { errored++; console.error(`  ❌ Reconcile withdrawal ${w._id} failed:`, err.message) }
  }
  return { checked: list.length, completed, refunded, pending, errored }
}

const reconcileDeposits = async () => {
  const list = await Deposit.find({
    status: 'pending',
    createdAt: { $gte: sinceDate() },
  }).sort({ createdAt: 1 }).limit(BATCH_LIMIT)

  let credited = 0, rejected = 0, pending = 0, errored = 0
  for (const d of list) {
    try {
      const res = await gateway.queryCollectionOrder(d._id.toString())
      const data = res && res.data
      if (!res || res.code !== 200 || !data) { errored++; continue }
      const status = Number(data.orderStatus)
      if (status === gateway.COLLECTION_STATUS.COMPLETED) {
        await creditDepositByDoc(d); credited++
      } else if (status === gateway.COLLECTION_STATUS.FAILED || status === gateway.COLLECTION_STATUS.REFUNDED) {
        await rejectDepositByDoc(d, 'Payment failed/refunded at gateway'); rejected++
      } else { pending++ }
    } catch (err) { errored++; console.error(`  ❌ Reconcile deposit ${d._id} failed:`, err.message) }
  }
  return { checked: list.length, credited, rejected, pending, errored }
}

let isRunning = false
const runReconcile = async () => {
  if (isRunning) return
  isRunning = true
  try {
    if (!gateway.isConfigured()) return
    const w = await reconcileWithdrawals()
    const d = await reconcileDeposits()
    if (w.checked || d.checked) {
      console.log(
        `🔁 Reconcile — withdrawals[checked:${w.checked} done:${w.completed} refund:${w.refunded} wait:${w.pending} err:${w.errored}] ` +
        `deposits[checked:${d.checked} credit:${d.credited} reject:${d.rejected} wait:${d.pending} err:${d.errored}]`,
      )
    }
  } catch (err) {
    console.error('❌ Reconcile cron error:', err)
  } finally {
    isRunning = false
  }
}

const startReconcileCron = () => {
  const schedule = process.env.CRON_RECONCILE || '*/3 * * * *'
  cron.schedule(schedule, runReconcile)
  console.log(`⏰ Payment reconcile cron scheduled [${schedule}]`)
}

module.exports = { startReconcileCron, runReconcile, reconcileWithdrawals, reconcileDeposits }