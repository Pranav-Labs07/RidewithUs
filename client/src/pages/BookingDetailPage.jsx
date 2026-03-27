import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { bookingsAPI, paymentsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { format } from "date-fns";
import toast from "react-hot-toast";

const Star = ({ filled, onClick }) => (
  <button
    onClick={onClick}
    className={`text-2xl transition-all ${filled ? "text-yellow-400" : "text-gray-700 hover:text-yellow-300"}`}
  >
    ★
  </button>
);

export default function BookingDetailPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showRate, setShowRate] = useState(sp.get("rate") === "1");
  const [paying, setPaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    bookingsAPI
      .getById(id)
      .then(({ data }) => setBooking(data.booking))
      .catch(() => toast.error("Booking not found"))
      .finally(() => setLoading(false));

    if (sp.get("payment") === "success")
      toast.success("Payment successful! Ride confirmed.");
    if (sp.get("payment") === "cancelled") toast.error("Payment cancelled.");
  }, [id]);

  const handlePay = async () => {
    try {
      setPaying(true);
      const { data } = await paymentsAPI.createSession(booking._id);
      window.location.href = data.url;
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Payment unavailable — Stripe key not set yet",
      );
      setPaying(false);
    }
  };

  const handleRate = async () => {
    if (!rating) return toast.error("Select a rating");
    try {
      setSubmitting(true);
      await bookingsAPI.rate(id, { score: rating, comment });
      toast.success("Rating submitted! Thank you.");
      setShowRate(false);
      setBooking((prev) => ({ ...prev, rating: { score: rating, comment } }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Rating failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-pulse h-80" />
      </div>
    );

  if (!booking)
    return (
      <div className="text-center py-12 text-gray-600">
        Booking not found.{" "}
        <Link to="/bookings" className="text-orange-400">
          Back
        </Link>
      </div>
    );

  const isPassenger = booking.passenger?._id === user?._id;
  const paid = booking.payment?.status === "paid";

  const STATUS_COLORS = {
    pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    confirmed: "text-green-400  bg-green-500/10  border-green-500/20",
    started: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    completed: "text-blue-400   bg-blue-500/10   border-blue-500/20",
    cancelled: "text-red-400    bg-red-500/10    border-red-500/20",
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-gray-100">
          Booking Details
        </h1>
        <span
          className={`text-xs px-2.5 py-1 rounded-lg border font-medium capitalize ${STATUS_COLORS[booking.status]}`}
        >
          {booking.status}
        </span>
      </div>

      {/* Route card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex flex-col items-center gap-1 mt-1 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <div className="w-px h-7 bg-gray-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          </div>
          <div className="space-y-2.5">
            <p className="text-sm text-gray-200">
              {booking.ride?.origin?.address}
            </p>
            <p className="text-sm text-gray-200">
              {booking.ride?.destination?.address}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          {booking.ride?.departureTime
            ? format(
                new Date(booking.ride.departureTime),
                "EEEE, MMMM d · h:mm a",
              )
            : "—"}
        </p>
      </div>

      {/* People card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 grid grid-cols-2 gap-4">
        {[
          { label: "Driver", person: booking.driver },
          { label: "Passenger", person: booking.passenger },
        ].map(({ label, person }) => (
          <div key={label}>
            <p className="text-xs text-gray-500 mb-2">{label}</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm font-semibold text-gray-300">
                {person?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-gray-200">{person?.name}</p>
                <p className="text-xs text-gray-600">{person?.phone}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pricing */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Seats booked</span>
          <span className="text-gray-200">{booking.seatsBooked}</span>
        </div>
        <div className="flex justify-between text-sm mb-4">
          <span className="text-gray-500">Payment status</span>
          <span className={paid ? "text-green-400" : "text-yellow-400"}>
            {booking.payment?.status || "pending"}
          </span>
        </div>
        <div className="flex justify-between border-t border-gray-800 pt-3">
          <span className="text-gray-400 font-medium">Total</span>
          <span className="font-display text-xl font-bold text-orange-400">
            ₹{booking.totalAmount}
          </span>
        </div>
      </div>

      {/* Payment CTA */}
      {isPassenger && !paid && booking.status !== "cancelled" && (
        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all text-sm"
        >
          {paying ? "Redirecting to Stripe..." : "💳 Pay Now"}
        </button>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {["confirmed", "started"].includes(booking.status) && (
          <>
            <Link
              to={`/track/${booking.ride?._id}`}
              className="flex-1 text-center bg-blue-500/10 border border-blue-500/20 text-blue-400 py-2 rounded-xl text-sm hover:bg-blue-500/20 transition-all"
            >
              📡 Track Ride
            </Link>
            <Link
              to={`/chat/${booking._id}`}
              className="flex-1 text-center bg-orange-500/10 border border-orange-500/20 text-orange-400 py-2 rounded-xl text-sm hover:bg-orange-500/20 transition-all"
            >
              💬 Chat
            </Link>
          </>
        )}
      </div>

      {/* Rating */}
      {booking.status === "completed" && isPassenger && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          {booking.rating?.score ? (
            <div>
              <p className="text-sm text-gray-400 mb-2">Your rating</p>
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} filled={n <= booking.rating.score} />
                ))}
              </div>
              {booking.rating.comment && (
                <p className="text-sm text-gray-500 italic">
                  "{booking.rating.comment}"
                </p>
              )}
            </div>
          ) : showRate ? (
            <div>
              <p className="text-sm font-medium text-gray-200 mb-3">
                Rate this ride
              </p>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    filled={n <= rating}
                    onClick={() => setRating(n)}
                  />
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Leave a comment (optional)"
                rows={2}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-orange-500 placeholder-gray-600 resize-none mb-3"
              />
              <button
                onClick={handleRate}
                disabled={submitting || !rating}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-all"
              >
                {submitting ? "Submitting..." : "Submit Rating"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowRate(true)}
              className="w-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 py-2.5 rounded-xl text-sm hover:bg-yellow-500/20 transition-all"
            >
              ⭐ Rate this ride
            </button>
          )}
        </div>
      )}
    </div>
  );
}
