require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi         = require('swagger-ui-express');
const swaggerDefinition = require('./config/swagger');

const connectDB = require('./config/db');
const routes = require('./routes/index');
const { errorHandler } = require('./middleware/errorHandler');
const {  runDailyIncome,  startCrons } = require('./utils/cron');
const cookieParser = require('cookie-parser')

const app = express();
app.set('trust proxy', 1); // trust first proxy (if behind a proxy like Render)

// ─── Connect Database ────────────────────
connectDB();

// ─── Security Middleware ─────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(cookieParser())
// Rate limiting - global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Request Middleware ──────────────────
app.use(express.json({
  limit: '10mb',
  // Keep the raw request text so payment-gateway callback signatures can be
  // verified against the exact bytes sent (preserves decimals like "100.00").
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); },
}));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Routes ─────────────────────────────
app.use('/api', routes);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition, {
  customSiteTitle: 'Jakson Solar API Docs',
  swaggerOptions: { persistAuthorization: true, filter: true, tryItOutEnabled: true },
}));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Error Handler ───────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`
🌞 ─────────────────────────────────
   Jakson Solar API
   Mode: ${process.env.NODE_ENV || 'development'}
   Port: ${PORT}
   URL:  http://localhost:${PORT}/api
─────────────────────────────────`);

  // Start cron jobs
startCrons()

  // ── Missed-run recovery ──────────────────────────────────────────────
  // Render free tier spins down when idle and may restart after 7 AM,
  // missing the scheduled cron window. On every weekday startup after
  // 8 AM, run income distribution immediately. The skip guard inside
  // runDailyIncome (lastIncomeDate === today) prevents double-processing
  // if the cron already ran earlier that day.
  const now = new Date()
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5
  const isAfter7AM = now.getHours() >= 7

  if (isWeekday && isAfter7AM) {
    console.log('🔄 Server started after 7 AM — checking for missed income distribution...')
    setTimeout(() => {
      runDailyIncome().catch((err) =>
        console.error('❌ Startup income recovery failed:', err.message)
      )
    }, 3000) // 3s delay ensures DB connection is fully ready
  }
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

module.exports = app;