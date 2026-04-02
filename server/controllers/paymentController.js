/**
 * paymentController.js — Razorpay integration
 *
 * Flow:
 *   1. POST /payments/create-order  → create Razorpay order, store in DB
 *   2. Client opens Razorpay checkout modal
 *   3. POST /payments/verify        → HMAC verification, mark booking paid
 *   4. GET  /payments/booking/:id   → fetch payment record
 *   5. POST /payments/refund/:id    → admin-only refund
 */

const crypto  = require('crypto');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

// ── Lazily initialise Razorpay so missing key doesn't crash boot ──
let _razorpay;
const getRazorpay = () => {
  const keyId     = process.env.RAZORPAY_KEY_ID     || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

  if (!keyId || keyId.includes('REPLACE') || !keySecret || keySecret.includes('REPLACE')) {
    throw new Error('Razorpay not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env');
  }
  if (!_razorpay) {
    const Razorpay = require('razorpay');
    _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return _razorpay;
};

// ── POST /api/payments/create-order ───────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    const razorpay = getRazorpay();
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId)
      .populate('ride', 'origin destination departureTime vehicleType')
      .populate('driver', 'name');

    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.passenger.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorised' });

    if (booking.payment.status === 'paid')
      return res.status(400).json({ success: false, message: 'Booking already paid' });

    const amountPaise = booking.totalAmount * 100;   // ₹ → paise

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  `rwu_${bookingId}`,
      notes: {
        bookingId: bookingId.toString(),
        userId:    req.user._id.toString(),
      },
    });

    // Persist order id in booking
    booking.payment.razorpayOrderId = order.id;
    await booking.save();

    // Upsert Payment record
    await Payment.findOneAndUpdate(
      { booking: bookingId },
      {
        booking:          bookingId,
        user:             req.user._id,
        amount:           amountPaise,
        razorpayOrderId:  order.id,
        status:           'created',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success:  true,
      orderId:  order.id,
      amount:   amountPaise,
      currency: 'INR',
      keyId:    process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    if (error.message.includes('Razorpay not configured')) {
      return res.status(503).json({ success: false, message: error.message });
    }
    console.error('createOrder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/payments/verify ─────────────────────────────────────
exports.verifyPayment = async (req, res) => {
  try {
    const {
      bookingId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    // HMAC-SHA256 signature check
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    const body      = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected  = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expected !== razorpaySignature) {
      return res
        .status(400)
        .json({ success: false, message: 'Payment verification failed — invalid signature' });
    }

    // Mark booking as paid + confirmed
    const booking = await Booking.findById(bookingId);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.payment.status            = 'paid';
    booking.payment.razorpayPaymentId = razorpayPaymentId;
    booking.payment.paidAt            = new Date();
    booking.status                    = 'confirmed';
    await booking.save();

    // Update Payment record
    await Payment.findOneAndUpdate(
      { razorpayOrderId },
      {
        razorpayPaymentId,
        razorpaySignature,
        status: 'paid',
        paidAt: new Date(),
      }
    );

    // Real-time notify driver
    if (req.io) {
      req.io.to(`user_${booking.driver}`).emit('booking:paid', {
        bookingId: booking._id,
        message:   'Passenger paid for the ride!',
      });
      req.io.to(`booking_${booking._id}`).emit('booking:statusChange', {
        status: 'confirmed', paymentStatus: 'paid', bookingId: booking._id,
      });
    }

    res.json({ success: true, message: 'Payment verified', booking });
  } catch (error) {
    console.error('verifyPayment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/payments/booking/:bookingId ──────────────────────────
exports.getPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findOne({ booking: req.params.bookingId });
    if (!payment)
      return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true, payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/payments/refund/:bookingId (admin only) ─────────────
exports.refundPayment = async (req, res) => {
  try {
    const razorpay = getRazorpay();
    const payment  = await Payment.findOne({ booking: req.params.bookingId });

    if (!payment)
      return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status !== 'paid')
      return res.status(400).json({ success: false, message: 'No paid payment to refund' });

    // Issue full refund via Razorpay
    const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: payment.amount,   // full refund in paise
      notes: { reason: req.body.reason || 'Admin refund' },
    });

    payment.status            = 'refunded';
    payment.razorpayRefundId  = refund.id;
    payment.refundedAt        = new Date();
    await payment.save();

    await Booking.findByIdAndUpdate(req.params.bookingId, {
      status:          'refunded',
      'payment.status':'refunded',
    });

    res.json({ success: true, message: 'Refund initiated', refundId: refund.id });
  } catch (error) {
    console.error('refundPayment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
