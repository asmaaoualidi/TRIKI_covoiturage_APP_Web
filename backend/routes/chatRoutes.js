const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middlewares/auth');

router.post('/envoyer', authenticate, chatController.envoyerMessage);
router.get('/:trajet_id', authenticate, chatController.obtenirDiscussion);

module.exports = router;