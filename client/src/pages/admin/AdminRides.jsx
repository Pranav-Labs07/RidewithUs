import React, { useEffect, useState } from "react";
import { adminAPI } from "../../services/api";
import { format } from "date-fns";
import toast from "react-hot-toast";

export default function AdminRides() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ vehicleType: "", status: "" });

  const load = () => {
    setLoading(true);
    adminAPI
      .getRides(filter)
      .then(({ data }) => setRides(data.rides))
      .catch(() => toast.error("Failed to load rides"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filter]);

  const handleDelete = async (id, driverName) => {
    if (
      !window.confirm(
        `Delete ride by ${driverName}? This will cancel all bookings.`,
      )
    )
      return;
    try {
      await adminAPI.deleteRide(id);
      setRides((prev) => prev.filter((r) => r._id !== id));
      toast.success("Ride deleted");
    } catch {
      toast.error("Failed to delete ride");
    }
  };

  const statusColor = {
    scheduled: "text-blue-400  bg-blue-400/10",
    active: "text-green-400 bg-green-400/10",
    started: "text-orange-400 bg-orange-400/10",
    completed: "text-gray-400  bg-gray-400/10",
    cancelled: "text-red-400   bg-red-400/10",
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold text-purple-400 mb-5">
        Manage Rides
      </h1>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select
          value={filter.vehicleType}
          onChange={(e) =>
            setFilter((f) => ({ ...f, vehicleType: e.target.value }))
          }
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
        >
          <option value="">All Vehicles</option>
          <option value="bike">Bike</option>
          <option value="car">Car</option>
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
        >
          <option value="">All Statuses</option>
          {["scheduled", "active", "started", "completed", "cancelled"].map(
            (s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ),
          )}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl h-16 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
            <span>Route</span>
            <span>Driver</span>
            <span>Type</span>
            <span>Date</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {rides.length === 0 ? (
            <p className="text-center text-gray-600 py-8">No rides found</p>
          ) : (
            rides.map((ride) => (
              <div
                key={ride._id}
                className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-gray-800 last:border-0 items-center hover:bg-gray-800/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-300 truncate">
                    {ride.origin?.address?.split(",")[0]}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    → {ride.destination?.address?.split(",")[0]}
                  </p>
                </div>
                <p className="text-sm text-gray-400">
                  {ride.driver?.name || "—"}
                </p>
                <span
                  className={`text-xs px-2 py-1 rounded-md inline-block ${ride.vehicleType === "bike" ? "bg-blue-500/10 text-blue-400" : "bg-green-500/10 text-green-400"}`}
                >
                  {ride.vehicleType === "bike" ? "🏍 Bike" : "🚗 Car"}
                </span>
                <p className="text-xs text-gray-500">
                  {ride.departureTime
                    ? format(new Date(ride.departureTime), "MMM d")
                    : "—"}
                </p>
                <span
                  className={`text-xs px-2 py-1 rounded-md inline-block capitalize ${statusColor[ride.status] || "text-gray-400"}`}
                >
                  {ride.status}
                </span>
                <button
                  onClick={() => handleDelete(ride._id, ride.driver?.name)}
                  className="text-xs border border-red-900 text-red-400 hover:bg-red-900/20 px-2 py-1 rounded-lg transition-all"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
