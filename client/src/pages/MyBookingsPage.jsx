import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { bookingsAPI } from "../services/api";
import socketService from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { format } from "date-fns";
import toast from "react-hot-toast";

const S = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  confirmed: "bg-green-500/10  text-green-400  border-green-500/20",
  started: "bg-blue-500/10   text-blue-400   border-blue-500/20",
  completed: "bg-gray-500/10   text-gray-400   border-gray-500/20",
  cancelled: "bg-red-500/10    text-red-400    border-red-500/20",
};

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("passenger");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const fn = tab === "passenger" ? bookingsAPI.getMy : bookingsAPI.getDriver;
    fn()
      .then(({ data }) => setBookings(data.bookings || []))
      .catch(() => toast.error("Failed to load bookings"))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time updates
  useEffect(() => {
    const refresh = (data) => {
      if (data?.message) toast(data.message, { icon: "📣" });
      load();
    };
    const handlePayDone = (data) => {
      toast.success(data?.message || "Payment confirmed! Ride complete 🎉");
      load();
    };
    socketService.on("booking:new", refresh);
    socketService.on("booking:accepted", refresh);
    socketService.on("booking:denied", refresh);
    socketService.on("booking:cancelled", refresh);
    socketService.on("booking:statusChange", refresh);
    socketService.on("booking:paymentDone", handlePayDone);
    return () => {
      socketService.off("booking:new", refresh);
      socketService.off("booking:accepted", refresh);
      socketService.off("booking:denied", refresh);
      socketService.off("booking:cancelled", refresh);
      socketService.off("booking:statusChange", refresh);
      socketService.off("booking:paymentDone", handlePayDone);
    };
  }, [load]);

  const act = async (bookingId, fn, successMsg) => {
    setActing(bookingId);
    try {
      await fn();
      toast.success(successMsg);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    } finally {
      setActing(null);
    }
  };

  const handleAccept = (id) =>
    act(
      id,
      () => bookingsAPI.accept(id),
      "Booking accepted! Passenger notified ✓",
    );
  const handleDeny = (id) =>
    act(id, () => bookingsAPI.deny(id), "Booking denied");
  const handleCancel = (id) => {
    if (!window.confirm("Cancel this booking? Seats will be restored.")) return;
    act(id, () => bookingsAPI.cancel(id), "Booking cancelled");
  };
  const handlePayDone = (id) => {
    if (
      !window.confirm(
        "Mark payment as received? This completes the ride for both users.",
      )
    )
      return;
    act(
      id,
      () => bookingsAPI.markPaymentDone(id),
      "Payment done! Ride completed for both users ✓",
    );
  };

  const getRideInfo = (b) => {
    const r = b.ride;
    if (!r) return { from: "—", to: "—", dateStr: "—" };
    return {
      from: r.origin?.address?.split(",")[0] || "—",
      to: r.destination?.address?.split(",")[0] || "—",
      dateStr: r.departureTime
        ? format(new Date(r.departureTime), "EEE, MMM d · h:mm a")
        : "—",
    };
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold text-gray-100 mb-5">
        My Bookings
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-5 w-fit">
        {[
          ["passenger", "As Passenger"],
          ["driver", "As Driver (Requests)"],
        ].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === v ? "bg-orange-500 text-white" : "text-gray-400 hover:text-gray-200"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl h-36 animate-pulse"
            />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-14 bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="text-4xl mb-3">
            {tab === "passenger" ? "🎫" : "🚗"}
          </div>
          <p className="text-gray-400 font-medium">
            {tab === "passenger" ? "No bookings yet" : "No ride requests yet"}
          </p>
          <div className="mt-2">
            {tab === "passenger" ? (
              <Link
                to="/find"
                className="text-orange-400 hover:underline text-sm"
              >
                Find a ride →
              </Link>
            ) : (
              <Link
                to="/create"
                className="text-orange-400 hover:underline text-sm"
              >
                Offer a ride →
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const { from, to, dateStr } = getRideInfo(b);
            const person = tab === "passenger" ? b.driver : b.passenger;
            const rideId = b.ride?._id || b.ride;
            const isActing = acting === b._id;

            return (
              <div
                key={b._id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      {from} → {to}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{dateStr}</p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium capitalize flex-shrink-0 ${S[b.status] || S.pending}`}
                  >
                    {b.status}
                  </span>
                </div>

                {/* Person */}
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-800">
                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-300 flex-shrink-0">
                    {person?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <span className="text-xs text-gray-500">
                    {tab === "passenger" ? "Driver" : "Passenger"}:
                  </span>
                  <span className="text-xs text-gray-300">
                    {person?.name || "—"}
                  </span>
                  <span className="text-xs text-gray-600 hidden sm:inline">
                    {person?.phone}
                  </span>
                </div>

                {/* Payment + seats */}
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="text-xs text-gray-500">
                    🪑 {b.seatsBooked} seat{b.seatsBooked > 1 ? "s" : ""}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md border ${
                      b.payment?.status === "paid"
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    }`}
                  >
                    💳{" "}
                    {b.payment?.status === "paid"
                      ? "Payment done"
                      : "Payment pending"}
                  </span>
                  <span className="ml-auto font-display text-base font-bold text-orange-400">
                    ₹{b.totalAmount}
                  </span>
                </div>

                {/* ── DRIVER ACTIONS ── */}
                {tab === "driver" && (
                  <div className="flex gap-2 flex-wrap">
                    {/* Accept / Deny for pending */}
                    {b.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleAccept(b._id)}
                          disabled={isActing}
                          className="flex-1 text-xs bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg font-medium transition-all"
                        >
                          {isActing ? "..." : "✓ Accept"}
                        </button>
                        <button
                          onClick={() => handleDeny(b._id)}
                          disabled={isActing}
                          className="flex-1 text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-2 rounded-lg transition-all"
                        >
                          {isActing ? "..." : "✗ Deny"}
                        </button>
                      </>
                    )}
                    {/* Payment done — only for confirmed bookings */}
                    {b.status === "confirmed" &&
                      b.payment?.status !== "paid" && (
                        <button
                          onClick={() => handlePayDone(b._id)}
                          disabled={isActing}
                          className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-all"
                        >
                          {isActing ? "Processing..." : "💰 Mark Payment Done"}
                        </button>
                      )}
                    {/* Chat */}
                    {["pending", "confirmed", "started"].includes(b.status) && (
                      <Link
                        to={`/chat/${b._id}`}
                        className="text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 px-3 py-2 rounded-lg transition-all"
                      >
                        💬 Chat
                      </Link>
                    )}
                    {b.status === "completed" && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        ✓ Ride completed · Payment received
                      </span>
                    )}
                  </div>
                )}

                {/* ── PASSENGER ACTIONS ── */}
                {tab === "passenger" && (
                  <div className="flex gap-2 flex-wrap">
                    <Link
                      to={`/bookings/${b._id}`}
                      className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 px-3 py-1.5 rounded-lg transition-all"
                    >
                      View Details
                    </Link>
                    {["confirmed", "started"].includes(b.status) && rideId && (
                      <Link
                        to={`/track/${rideId}`}
                        className="text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg transition-all"
                      >
                        📡 Track
                      </Link>
                    )}
                    {["pending", "confirmed"].includes(b.status) && (
                      <>
                        <Link
                          to={`/chat/${b._id}`}
                          className="text-xs bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 px-3 py-1.5 rounded-lg transition-all"
                        >
                          💬 Chat
                        </Link>
                        <button
                          onClick={() => handleCancel(b._id)}
                          disabled={isActing}
                          className="text-xs border border-red-900 text-red-400 hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                        >
                          {isActing ? "..." : "Cancel"}
                        </button>
                      </>
                    )}
                    {b.status === "pending" && (
                      <span className="text-xs text-yellow-400 flex items-center">
                        ⏳ Waiting for driver
                      </span>
                    )}
                    {b.status === "completed" && !b.rating?.score && (
                      <Link
                        to={`/bookings/${b._id}?rate=1`}
                        className="text-xs bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-lg transition-all"
                      >
                        ⭐ Rate Ride
                      </Link>
                    )}
                    {b.status === "completed" &&
                      b.payment?.status === "paid" && (
                        <span className="text-xs text-green-400">
                          ✓ Payment complete
                        </span>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
