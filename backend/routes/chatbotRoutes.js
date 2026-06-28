// routes/chatbotRoutes.js
const express = require('express');
const router = express.Router();
const { chatbot } = require('../controllers/chatbotController');

// Public — no auth required (users may need help before logging in)
router.post('/', chatbot);

module.exports = router;
