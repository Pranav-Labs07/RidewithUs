const express = require('express');
const router = express.Router();
const {
  createCheckoutSession, stripeWebhook, getPaymentStatus, refundPayment,
} = require('../controllers/paymentController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

router.post('/create-session', protect, createCheckoutSession);
router.get('/booking/:bookingId', protect, getPaymentStatus);
router.post('/refund/:bookingId', protect, adminOnly, refundPayment);

module.exports = router;
