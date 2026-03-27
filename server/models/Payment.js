const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: { type: Number, required: true },   // in paise (₹100 = 10000 paise)
    currency: { type: String, default: 'inr' },

    stripeSessionId: { type: String, default: '' },
    stripePaymentId: { type: String, default: '' },
    stripeRefundId: { type: String, default: '' },

    status: {
      type: String,
      enum: ['created', 'paid', 'failed', 'refunded'],
      default: 'created',
    },

    paidAt: { type: Date },
    refundedAt: { type: Date },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

paymentSchema.index({ booking: 1 });
paymentSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
