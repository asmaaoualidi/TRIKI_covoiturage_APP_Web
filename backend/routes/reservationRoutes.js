// routes/reservationRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const {
  createReservation,
  stripeWebhook,
  getMesReservations,
  getMesReservationsPassees,
  soumettreAvis,
  getReservationsRecues,
  cancelReservation,
} = require('../controllers/reservationController');

// ── Stripe webhook: raw body required (registered BEFORE express.json) ──
// This route is mounted at /api/reservations/webhook from server.js
// The raw-body parser is applied in server.js (see integration section)
router.post('/webhook', stripeWebhook);

// Protected routes
router.post('/', authenticate, createReservation);
router.get('/mes-reservations', authenticate, getMesReservations);
// [AJOUT TRIKI.COV] : réservations passées pour noter le conducteur
router.get('/historique', authenticate, getMesReservationsPassees);
// [AJOUT TRIKI.COV] : soumettre un avis sur un conducteur après trajet terminé
router.post('/:id/avis', authenticate, soumettreAvis);
// [AJOUT TRIKI.COV] : permet au conducteur de voir les réservations reçues
// sur ses propres trajets (nécessaire pour la liste des discussions du chat)
router.get('/recues', authenticate, getReservationsRecues);
router.delete('/:id', authenticate, cancelReservation);

module.exports = router;
