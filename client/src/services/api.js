/**
 * API Service v3 — all endpoints wired
 */
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('rwu_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, err => Promise.reject(err));

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('rwu_token');
      localStorage.removeItem('rwu_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  sendOTP:   data => api.post('/auth/send-otp', data),
  verifyOTP: data => api.post('/auth/verify-otp', data),
  getMe:     ()   => api.get('/auth/me'),
};

export const ridesAPI = {
  create:         data        => api.post('/rides', data),
  search:         params      => api.get('/rides/search', { params }),
  getAll:         params      => api.get('/rides', { params }),
  getMy:          ()          => api.get('/rides/my'),
  getById:        id          => api.get(`/rides/${id}`),
  update:         (id, data)  => api.put(`/rides/${id}`, data),
  updateStatus:   (id, status)=> api.put(`/rides/${id}/status`, { status }),
  updateLocation: (id,lat,lng)=> api.put(`/rides/${id}/location`, { lat, lng }),
  cancel:         id          => api.delete(`/rides/${id}`),
};

export const bookingsAPI = {
  create:         data => api.post('/bookings', data),
  getMy:          ()   => api.get('/bookings/my'),
  getDriver:      ()   => api.get('/bookings/driver'),
  getById:        id   => api.get(`/bookings/${id}`),
  accept:         id   => api.put(`/bookings/${id}/accept`),
  deny:           (id, reason) => api.put(`/bookings/${id}/deny`, { reason }),
  confirm:        id   => api.put(`/bookings/${id}/confirm`),   // alias
  cancel:         (id, reason) => api.put(`/bookings/${id}/cancel`, { reason }),
  markPaymentDone:id   => api.put(`/bookings/${id}/payment-done`),
  rate:           (id, data) => api.post(`/bookings/${id}/rate`, data),
};

export const messagesAPI = {
  send:             data      => api.post('/messages', data),
  getHistory:       bookingId => api.get(`/messages/${bookingId}`),
  getConversations: ()        => api.get('/messages/conversations'),
};

export const paymentsAPI = {
  createSession: bookingId => api.post('/payments/create-session', { bookingId }),
  getStatus:     bookingId => api.get(`/payments/booking/${bookingId}`),
};

export const usersAPI = {
  getProfile:    ()     => api.get('/users/profile'),
  updateProfile: data   => api.put('/users/profile', data),
  updateVehicle: data   => api.put('/users/vehicle', data),
  getStats:      ()     => api.get('/users/stats'),
  getById:       id     => api.get(`/users/${id}`),
};

export const adminAPI = {
  getDashboard:   ()       => api.get('/admin/dashboard'),
  getUsers:       params   => api.get('/admin/users', { params }),
  getRides:       params   => api.get('/admin/rides', { params }),
  deleteRide:     id       => api.delete(`/admin/rides/${id}`),
  getBookings:    params   => api.get('/admin/bookings', { params }),
  deactivateUser: id       => api.put(`/admin/users/${id}/deactivate`),
  activateUser:   id       => api.put(`/admin/users/${id}/activate`),
  makeAdmin:      id       => api.put(`/admin/users/${id}/make-admin`),
  getRevenue:     ()       => api.get('/admin/revenue'),
};

export default api;
