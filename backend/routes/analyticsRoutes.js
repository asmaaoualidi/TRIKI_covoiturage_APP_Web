// routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middlewares/auth'); // استعملنا نفس الـ Middlewares ديالك

// Public : statistiques affichées sur la page d'accueil (sans le CA)
router.get('/public', analyticsController.getPublicStats);

// حماية المسار: خاص يكون مسجل الدخول (authenticate) ويكون admin بالظبط
router.get('/', authenticate, authorize('admin'), analyticsController.getGlobalStats);

module.exports = router;