import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerAdmin } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

const RegisterAdmin = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    organizationName: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const { loginUser } = useAuth();
  const { theme, toggleTheme } = useUI();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await registerAdmin(form);
      setSuccess(res.data.organization);
      loginUser(res.data.token, res.data.user);
      setTimeout(() => navigate('/admin'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-shell">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-2">Organization Created!</h2>
          <p className="text-gray-600 mb-4">Share this code with your employees:</p>
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-4">
            <p className="text-sm text-blue-600 font-medium mb-2">Organization Code</p>
            <p className="text-4xl font-bold font-mono text-blue-700 tracking-widest">
              {success.org_code}
            </p>
          </div>
          <p className="helper-text">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-container">
        <div className="flex justify-end mb-3">
          <button onClick={toggleTheme} className="toggle-chip" type="button">
            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>

        <div className="auth-brand">
          <div className="auth-logo">
            <span className="text-white font-bold text-2xl">HR</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create Organization</h1>
          <p className="text-gray-500 mt-1">Set up your company workspace</p>
          <p className="text-xs text-gray-500 mt-2">You’ll receive a 6-letter org code for employee onboarding</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Full Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="John Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="admin@company.com"
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
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Acme Corporation"
                value={form.organizationName}
                onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                className="input-field resize-none"
                rows={2}
                placeholder="Brief description of your organization"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
              <strong>Note:</strong> A unique 6-letter code will be generated for your organization.
              Share it with employees so they can request to join.
            </div>

            <button type="submit" className="btn-primary w-full py-3 text-base" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create Organization'
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <Link to="/login" className="text-sm text-gray-600 hover:text-gray-800">
              Already have an account? <span className="text-blue-600 font-medium">Sign in</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterAdmin;