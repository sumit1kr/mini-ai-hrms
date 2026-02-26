import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hrms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const registerAdmin = (data) => api.post('/auth/register-admin', data);
export const registerEmployee = (data) => api.post('/auth/register-employee', data);
export const login = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');

// ─── Organizations ────────────────────────────────────────────────────────────
export const getMyOrg = () => api.get('/organizations/my');
export const getEmployees = () => api.get('/organizations/employees');
export const getRequests = (status = 'pending') =>
  api.get(`/organizations/requests?status=${status}`);
export const approveRequest = (requestId) =>
  api.post(`/organizations/requests/${requestId}/approve`);
export const rejectRequest = (requestId) =>
  api.post(`/organizations/requests/${requestId}/reject`);
export const updateEmployee = (userId, data) =>
  api.put(`/organizations/employees/${userId}`, data);
export const deactivateEmployee = (userId) =>
  api.delete(`/organizations/employees/${userId}`);

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const getTasks = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  return api.get(`/tasks${params ? `?${params}` : ''}`);
};
export const createTask = (data) => api.post('/tasks', data);
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);
export const getTaskSuggestions = (skills = '') =>
  api.get(`/tasks/suggestions${skills ? `?skills=${skills}` : ''}`);

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const getDashboardStats = () => api.get('/dashboard/stats');
export const getProductivityRankings = () => api.get('/dashboard/productivity');
export const getMyStats = () => api.get('/dashboard/my-stats');

// ─── AI ───────────────────────────────────────────────────────────────────────
export const getAiScore = (userId) => api.get(`/ai/score/${userId}`);
export const recalculateAllScores = () => api.post('/ai/recalculate-all');
export const getAiInsights = () => api.get('/ai/insights');

export default api;