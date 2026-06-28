// server.js — TRIKI.COV Backend
// MODIFICATION : ajout du mount /api/chat (chatRoutes était absent)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey || stripeKey.includes('your_stripe_key_here')) {
  console.warn('WARNING: STRIPE_SECRET_KEY is not configured or is still a placeholder.');
  console.warn('Stripe payments will be unavailable until a valid key is provided. Cash reservations can still work.');
}

const app = express();
const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────
// Import routes
// ─────────────────────────────────────────────
const authRoutes        = require('./routes/authRoutes');
const trajetRoutes      = require('./routes/trajetRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const chatbotRoutes     = require('./routes/chatbotRoutes');
const analyticsRoutes   = require('./routes/analyticsRoutes');
const adminRoutes       = require('./routes/adminRoutes');
// [AJOUT TRIKI.COV] : chatRoutes était importé mais jamais monté dans server.js
const chatRoutes        = require('./routes/chatRoutes');

// ─────────────────────────────────────────────
// IMPORTANT: Stripe webhook MUST receive raw body.
// Mount it BEFORE express.json() is applied globally.
// ─────────────────────────────────────────────
app.post(
  '/api/reservations/webhook',
  express.raw({ type: 'application/json' }),
  require('./controllers/reservationController').stripeWebhook
);

// ─────────────────────────────────────────────
// Global middlewares
// ─────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173']
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'TRIKI.COV API is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

// ─────────────────────────────────────────────
// Route mounting
// ─────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/trajets',      trajetRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/chatbot',      chatbotRoutes);
app.use('/api/analytics',    analyticsRoutes);
app.use('/api/admin',        adminRoutes);
// [AJOUT TRIKI.COV] : Mount du système de messagerie
app.use('/api/chat',         chatRoutes);

// ─────────────────────────────────────────────
// 404 handler
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route non trouvée : ${req.method} ${req.originalUrl}`,
  });
});

// ─────────────────────────────────────────────
// Global error handler
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[GlobalError]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur serveur interne.',
  });
});

app.listen(PORT, () => {
  console.log(`✅ TRIKI.COV API running on http://localhost:${PORT}`);
});

module.exports = app;