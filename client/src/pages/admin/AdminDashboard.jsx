import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminAPI } from "../../services/api";
import toast from "react-hot-toast";

const StatCard = ({ label, value, color, sub }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
      {label}
    </p>
    <p className={`font-display text-2xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
  </div>
);

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI
      .getDashboard()
      .then(({ data }) => setData(data.dashboard))
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse h-24"
            />
          ))}
        </div>
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-purple-400">
            Admin Dashboard
          </h1>
          <p className="text-gray-500 text-sm">RideWithUs platform overview</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/rides"
            className="bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition-all"
          >
            Manage Rides
          </Link>
          <Link
            to="/admin/users"
            className="bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition-all"
          >
            Manage Users
          </Link>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Total Users"
              value={data.totalUsers?.toLocaleString()}
              color="text-purple-400"
              sub={`+${data.newUsersThisMonth} this month`}
            />
            <StatCard
              label="Total Rides"
              value={data.totalRides?.toLocaleString()}
              color="text-orange-400"
              sub={`+${data.newRidesThisMonth} this month`}
            />
            <StatCard
              label="Total Bookings"
              value={data.totalBookings?.toLocaleString()}
              color="text-blue-400"
            />
            <StatCard
              label="Active Rides"
              value={data.activeRides}
              color="text-green-400"
            />
            <StatCard
              label="Bike Rides"
              value={data.vehicleBreakdown?.bike || 0}
              color="text-blue-300"
            />
            <StatCard
              label="Car Rides"
              value={data.vehicleBreakdown?.car || 0}
              color="text-green-300"
            />
          </div>

     
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <h2 className="font-display text-base font-semibold text-gray-300 mb-4">
              Revenue
            </h2>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-orange-400">
                ₹{data.totalRevenue?.toLocaleString("en-IN")}
              </span>
              <span className="text-gray-500 text-sm">total collected</span>
            </div>
          </div>

          {/* Booking status breakdown */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-display text-base font-semibold text-gray-300 mb-4">
              Booking Status Breakdown
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(data.bookingStatusBreakdown || {}).map(
                ([status, count]) => (
                  <div
                    key={status}
                    className="bg-gray-950 rounded-lg p-3 text-center"
                  >
                    <div className="font-display text-xl font-bold text-gray-200">
                      {count}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 capitalize">
                      {status}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
