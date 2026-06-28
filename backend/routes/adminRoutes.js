const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const adminController = require('../controllers/adminController');

router.get('/users', authenticate, authorize('admin'), adminController.getUsers);
router.get('/reservations', authenticate, authorize('admin'), adminController.getReservations);
router.get('/trajets', authenticate, authorize('admin'), adminController.getAllTrajets);

module.exports = router;
