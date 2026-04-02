const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
    },
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    seatsBooked: { type: Number, required: true, min: 1, max: 4 },
    totalAmount:  { type: Number, required: true },

    // ── Status flow ────────────────────────────────────────────────
    // pending → confirmed → started → completed / cancelled / refunded
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'started', 'completed', 'cancelled', 'refunded'],
      default: 'pending',
    },
    cancelledBy:      { type: String, enum: ['passenger', 'driver', 'admin', ''], default: '' },
    cancellationNote: { type: String, default: '' },

    // ── Payment (Razorpay) ─────────────────────────────────────────
    payment: {
      status: {
        type: String,
        enum: ['pending', 'paid', 'refunded', 'failed'],
        default: 'pending',
      },
      razorpayOrderId:   { type: String, default: '' },
      razorpayPaymentId: { type: String, default: '' },
      paidAt:            { type: Date },
    },

    // ── Rating (filled by passenger after completion) ──────────────
    rating: {
      score:   { type: Number, min: 1, max: 5 },
      comment: { type: String, default: '' },
      ratedAt: { type: Date },
    },

    pickupLocation: {
      address:     String,
      coordinates: [Number],
    },
    dropLocation: {
      address:     String,
      coordinates: [Number],
    },
  },
  { timestamps: true }
);

bookingSchema.index({ ride: 1, passenger: 1 }, { unique: true });
bookingSchema.index({ passenger: 1, status: 1 });
bookingSchema.index({ driver: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
