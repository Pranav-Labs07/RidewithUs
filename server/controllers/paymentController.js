const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('REPLACE')) {
    throw new Error('Stripe not configured yet. Add STRIPE_SECRET_KEY to .env');
  }
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
};

exports.createCheckoutSession = async (req, res) => {
  try {
    const stripe = getStripe();
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId)
      .populate('ride', 'origin destination departureTime vehicleType')
      .populate('driver', 'name');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.passenger.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }
    if (booking.payment.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Booking already paid' });
    }

    const amountPaise = booking.totalAmount * 100; // Stripe uses smallest currency unit

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            unit_amount: amountPaise,
            product_data: {
              name: `RideWithUs — ${booking.ride.vehicleType === 'bike' ? '🏍' : '🚗'} Ride`,
              description: `${booking.ride.origin.address} → ${booking.ride.destination.address}`,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/booking/${bookingId}?payment=success`,
      cancel_url: `${process.env.CLIENT_URL}/booking/${bookingId}?payment=cancelled`,
      metadata: {
        bookingId: bookingId.toString(),
        userId: req.user._id.toString(),
      },
    });


    booking.payment.stripeSessionId = session.id;
    await booking.save();


    await Payment.create({
      booking: bookingId,
      user: req.user._id,
      amount: amountPaise,
      stripeSessionId: session.id,
      status: 'created',
    });

    res.json({ success: true, url: session.url, sessionId: session.id });
  } catch (error) {
    if (error.message.includes('Stripe not configured')) {
      return res.status(503).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.stripeWebhook = async (req, res) => {
  try {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).json({ success: false, message: `Webhook Error: ${err.message}` });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const bookingId = session.metadata.bookingId;


      const booking = await Booking.findById(bookingId);
      if (booking) {
        booking.payment.status = 'paid';
        booking.payment.stripePaymentId = session.payment_intent;
        booking.payment.paidAt = new Date();
        booking.status = 'confirmed';
        await booking.save();


        await Payment.findOneAndUpdate(
          { stripeSessionId: session.id },
          { status: 'paid', stripePaymentId: session.payment_intent, paidAt: new Date() }
        );
      }
    }

    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findOne({ booking: req.params.bookingId });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true, payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.refundPayment = async (req, res) => {
  try {
    const stripe = getStripe();
    const payment = await Payment.findOne({ booking: req.params.bookingId });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status !== 'paid') {
      return res.status(400).json({ success: false, message: 'No paid payment to refund' });
    }

    const refund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentId,
    });

    payment.status = 'refunded';
    payment.stripeRefundId = refund.id;
    payment.refundedAt = new Date();
    await payment.save();

    await Booking.findByIdAndUpdate(req.params.bookingId, {
      status: 'refunded',
      'payment.status': 'refunded',
    });

    res.json({ success: true, message: 'Refund initiated', refundId: refund.id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
