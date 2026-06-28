// routes/trajetRoutes.js
const chatController = require('../controllers/chatController');
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const {
  createTrajet,
  getTrajets,
  getTrajetById,
  cancelTrajet,
} = require('../controllers/trajetController');

// Public
router.get('/', getTrajets);
router.get('/:id', getTrajetById);

// Protected
router.post(
  '/',
  authenticate,
  authorize('conducteur', 'admin'),
  createTrajet
);

router.delete(
  '/:id',
  authenticate,
  cancelTrajet           // ownership check is done inside the controller
);
// وزيدي هاد السطور ف الأسفل قبل module.exports = router;
router.post('/:trajet_id/messages', authenticate, chatController.envoyerMessage);
router.get('/:trajet_id/messages', authenticate, chatController.obtenirDiscussion);
module.exports = router;
