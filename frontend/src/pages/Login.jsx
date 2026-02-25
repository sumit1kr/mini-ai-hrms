import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const { theme, toggleTheme } = useUI();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(form);
      loginUser(res.data.token, res.data.user);
      navigate(res.data.user.role === 'admin' ? '/admin' : '/employee');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-container">
        <div className="flex justify-end mb-3">
          <button onClick={toggleTheme} className="toggle-chip" type="button">
            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>

        {/* Header */}
        <div className="auth-brand">
          <div className="auth-logo">
            <span className="text-white font-bold text-2xl">HR</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Mini AI-HRMS</h1>
          <p className="text-gray-500 mt-1">Sign in to your account</p>
          <p className="text-xs text-gray-500 mt-2">Secure access to dashboard, tasks and AI insights</p>
        </div>

        {/* Card */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full py-3 text-base" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
            <Link
              to="/register-admin"
              className="block text-center text-sm text-blue-600 hover:text-blue-800 font-medium p-2 rounded-lg hover:bg-blue-50"
            >
              Create Organization (Admin)
            </Link>
            <Link
              to="/join-org"
              className="block text-center text-sm text-gray-600 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-50"
            >
              Join an Organization (Employee)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;