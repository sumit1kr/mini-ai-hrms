const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

const logger = require('./config/logger');
const { runMigrations } = require('./db/migrations');

// Import routes
const authRoutes = require('./routes/auth');
const organizationsRoutes = require('./routes/organizations');
const tasksRoutes = require('./routes/tasks');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');
const web3Routes = require('./routes/web3');

const app = express();
const PORT = process.env.PORT || 3001;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientDbError = (err) => {
  if (!err) return false;
  const message = String(err.message || '').toLowerCase();
  return (
    message.includes('connection terminated unexpectedly') ||
    message.includes('connection reset') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('etimedout')
  );
};

const runMigrationsWithRetry = async (maxAttempts = 3) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await runMigrations();
      return;
    } catch (err) {
      const shouldRetry = attempt < maxAttempts && isTransientDbError(err);
      if (!shouldRetry) {
        throw err;
      }

      const delayMs = attempt * 3000;
      logger.warn(
        `Database migration attempt ${attempt}/${maxAttempts} failed (${err.message}). Retrying in ${delayMs}ms...`
      );
      await sleep(delayMs);
    }
  }
};

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, message: 'Too many requests, please try again later' },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});

// ─── Body Parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ─── Serve React Frontend (static) ───────────────────────────────────────────
const frontendPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/organizations', generalLimiter, organizationsRoutes);
app.use('/api/tasks', generalLimiter, tasksRoutes);
app.use('/api/dashboard', generalLimiter, dashboardRoutes);
app.use('/api/ai', generalLimiter, aiRoutes);
app.use('/api/web3', generalLimiter, web3Routes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Serve React app for all non-API routes (SPA fallback)
app.get('*', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      success: true,
      message: 'Mini AI-HRMS API is running',
      docs: '/api/health',
    });
  }
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await runMigrationsWithRetry(3);

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Mini AI-HRMS API running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

module.exports = app;