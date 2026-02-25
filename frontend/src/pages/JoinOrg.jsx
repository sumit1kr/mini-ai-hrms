import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { registerEmployee } from '../services/api';
import { useUI } from '../context/UIContext';

const JoinOrg = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    orgCode: '',
    department: '',
    position: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const { theme, toggleTheme } = useUI();

  const handleOrgCodeChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
    setForm({ ...form, orgCode: val });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await registerEmployee(form);
      setSuccess(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-shell bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-2">Request Submitted!</h2>
          <p className="text-gray-600 mb-4">{success.message}</p>
          <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
            <p className="helper-text">Organization</p>
            <p className="font-semibold text-gray-900">{success.organization?.name}</p>
            <p className="text-sm font-mono text-blue-600 mt-1">{success.organization?.org_code}</p>
          </div>
          <div className="badge-pending py-2 px-4 text-sm mb-4">
            ⏳ Waiting for admin approval
          </div>
          <Link to="/login" className="block text-blue-600 hover:text-blue-800 text-sm font-medium">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="auth-container">
        <div className="flex justify-end mb-3">
          <button onClick={toggleTheme} className="toggle-chip" type="button">
            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>

        <div className="auth-brand">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Join Organization</h1>
          <p className="text-gray-500 mt-1">Enter your org code to request access</p>
          <p className="text-xs text-gray-500 mt-2">Admin approval is required before first login</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Org Code — prominent at top */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input-field font-mono text-center text-xl sm:text-2xl tracking-[0.3em] sm:tracking-[0.5em] font-bold uppercase"
                placeholder="XXXXXX"
                value={form.orgCode}
                onChange={handleOrgCodeChange}
                required
                maxLength={6}
              />
              <p className="text-xs text-gray-400 mt-1">6-letter code provided by your admin</p>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Jane Smith"
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
                placeholder="jane@company.com"
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Engineering"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Developer"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full py-3 text-base bg-green-600 hover:bg-green-700" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                'Request to Join'
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

export default JoinOrg;