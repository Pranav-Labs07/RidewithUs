
const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const User = require('../models/User');

exports.createBooking = async (req, res) => {
  try {
    const { rideId, seatsBooked = 1, pickupAddress, dropAddress } = req.body;
    if (!rideId) return res.status(400).json({ success: false, message: 'rideId required' });

    const ride = await Ride.findById(rideId).populate('driver');
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (!['scheduled', 'active'].includes(ride.status))
      return res.status(400).json({ success: false, message: `Ride is ${ride.status}` });
    if (ride.driver._id.toString() === req.user._id.toString())
      return res.status(400).json({ success: false, message: 'Cannot book your own ride' });
    if (ride.availableSeats < Number(seatsBooked))
      return res.status(400).json({ success: false, message: `Only ${ride.availableSeats} seat(s) left` });

    const existing = await Booking.findOne({ ride: rideId, passenger: req.user._id, status: { $nin: ['cancelled'] } });
    if (existing) return res.status(400).json({ success: false, message: 'Already booked this ride' });

    const booking = await Booking.create({
      ride: rideId, passenger: req.user._id, driver: ride.driver._id,
      seatsBooked: Number(seatsBooked),
      totalAmount: ride.pricePerSeat * Number(seatsBooked),
      status: 'pending',
      pickupLocation: { address: pickupAddress || ride.origin.address },
      dropLocation: { address: dropAddress || ride.destination.address },
    });

    // Reserve seats
    ride.availableSeats = Math.max(0, ride.availableSeats - Number(seatsBooked));
    await ride.save();

    await booking.populate([
      { path: 'ride', select: 'origin destination departureTime vehicleType pricePerSeat distanceKm durationMins status' },
      { path: 'passenger', select: 'name phone rating profilePhoto' },
      { path: 'driver', select: 'name phone vehicle rating profilePhoto' },
    ]);

    // Notify driver in real-time
    if (req.io) {
      req.io.to(`user_${ride.driver._id}`).emit('booking:new', {
        bookingId: booking._id,
        rideId: ride._id,
        passenger: { name: req.user.name, phone: req.user.phone },
        seatsBooked: Number(seatsBooked),
        totalAmount: booking.totalAmount,
        origin: ride.origin.address,
        destination: ride.destination.address,
      });
    }
    res.status(201).json({ success: true, message: 'Ride booked! Waiting for driver confirmation.', booking });
  } catch (err) {
    console.error('createBooking:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/bookings/my — passenger bookings ────────────────────
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ passenger: req.user._id })
      .populate({
        path: 'ride', select: 'origin destination departureTime vehicleType pricePerSeat distanceKm durationMins status _id',
        populate: { path: 'driver', select: 'name phone rating vehicle profilePhoto' }
      })
      .populate('driver', 'name phone rating vehicle profilePhoto')
      .populate('passenger', 'name phone rating profilePhoto')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/bookings/driver — all bookings received by driver ───
exports.getDriverBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ driver: req.user._id })
      .populate({ path: 'ride', select: 'origin destination departureTime vehicleType pricePerSeat distanceKm durationMins status _id' })
      .populate('passenger', 'name phone rating profilePhoto')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/bookings/:id ─────────────────────────────────────────
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({ path: 'ride', select: 'origin destination departureTime vehicleType pricePerSeat distanceKm durationMins status _id' })
      .populate('passenger', 'name phone rating profilePhoto')
      .populate('driver', 'name phone vehicle rating profilePhoto');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const ids = [booking.passenger?._id?.toString(), booking.driver?._id?.toString()];
    if (!ids.includes(req.user._id.toString()) && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorised' });
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/bookings/:id/accept — DRIVER ACCEPTS ────────────────
exports.acceptBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.driver.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Only driver can accept' });
    if (booking.status !== 'pending')
      return res.status(400).json({ success: false, message: `Booking is already ${booking.status}` });

    booking.status = 'confirmed';
    await booking.save();

    if (req.io) {
      req.io.to(`user_${booking.passenger}`).emit('booking:accepted', {
        bookingId: booking._id,
        message: `${req.user.name} accepted your ride request!`,
      });
      req.io.to(`booking_${booking._id}`).emit('booking:statusChange', { status: 'confirmed', bookingId: booking._id });
    }
    res.json({ success: true, message: 'Booking accepted', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/bookings/:id/deny — DRIVER DENIES ───────────────────
exports.denyBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.driver.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Only driver can deny' });
    if (booking.status !== 'pending')
      return res.status(400).json({ success: false, message: `Booking is ${booking.status}` });

    booking.status = 'cancelled';
    booking.cancelledBy = 'driver';
    booking.cancellationNote = reason || 'Driver declined';
    await booking.save();

    // Restore seats
    await Ride.findByIdAndUpdate(booking.ride, { $inc: { availableSeats: booking.seatsBooked } });

    if (req.io) {
      req.io.to(`user_${booking.passenger}`).emit('booking:denied', {
        bookingId: booking._id,
        reason: booking.cancellationNote,
      });
      req.io.to(`booking_${booking._id}`).emit('booking:statusChange', { status: 'cancelled', bookingId: booking._id });
    }
    res.json({ success: true, message: 'Booking denied', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/bookings/:id/confirm — legacy alias for accept ──────
exports.confirmBooking = exports.acceptBooking;

// ── PUT /api/bookings/:id/cancel — passenger or driver cancels ───
exports.cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const isPassenger = booking.passenger.toString() === req.user._id.toString();
    const isDriver = booking.driver.toString() === req.user._id.toString();
    if (!isPassenger && !isDriver && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorised' });
    if (['completed', 'cancelled'].includes(booking.status))
      return res.status(400).json({ success: false, message: `Cannot cancel a ${booking.status} booking` });

    booking.status = 'cancelled';
    booking.cancelledBy = req.user.role === 'admin' ? 'admin' : isDriver ? 'driver' : 'passenger';
    booking.cancellationNote = reason || '';
    await booking.save();

    await Ride.findByIdAndUpdate(booking.ride, { $inc: { availableSeats: booking.seatsBooked } });

    const notifyId = isPassenger ? booking.driver : booking.passenger;
    if (req.io) {
      req.io.to(`user_${notifyId}`).emit('booking:cancelled', { bookingId: booking._id, cancelledBy: booking.cancelledBy });
      req.io.to(`booking_${booking._id}`).emit('booking:statusChange', { status: 'cancelled', bookingId: booking._id });
    }
    res.json({ success: true, message: 'Booking cancelled', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/bookings/:id/payment-done — DRIVER marks payment ────
// After driver confirms cash received → passenger sees "completed"
exports.markPaymentDone = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.driver.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Only driver can mark payment done' });
    if (booking.status !== 'confirmed')
      return res.status(400).json({ success: false, message: 'Booking must be confirmed first' });

    booking.status = 'completed';
    booking.payment.status = 'paid';
    booking.payment.paidAt = new Date();
    await booking.save();

    // Notify passenger in real-time
    if (req.io) {
      req.io.to(`user_${booking.passenger}`).emit('booking:paymentDone', {
        bookingId: booking._id,
        message: 'Payment confirmed! Your ride is complete. 🎉',
      });
      req.io.to(`booking_${booking._id}`).emit('booking:statusChange', {
        status: 'completed', paymentStatus: 'paid', bookingId: booking._id,
      });
    }
    res.json({ success: true, message: 'Payment marked done. Ride completed!', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/bookings/:id/rate ───────────────────────────────────
exports.rateBooking = async (req, res) => {
  try {
    const { score, comment } = req.body;
    if (!score || score < 1 || score > 5) return res.status(400).json({ success: false, message: 'Score 1-5 required' });
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.passenger.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Only passenger can rate' });
    if (booking.status !== 'completed')
      return res.status(400).json({ success: false, message: 'Can only rate completed rides' });
    if (booking.rating?.score)
      return res.status(400).json({ success: false, message: 'Already rated' });

    booking.rating = { score: Number(score), comment: comment || '', ratedAt: new Date() };
    await booking.save();

    const driver = await User.findById(booking.driver);
    const prev = driver.rating || { average: 0, count: 0 };
    const newCnt = prev.count + 1;
    driver.rating = { average: Math.round(((prev.average * prev.count) + Number(score)) / newCnt * 10) / 10, count: newCnt };
    await driver.save();
    res.json({ success: true, message: 'Rating submitted!', rating: booking.rating });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
