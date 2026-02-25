import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats, getMyOrg, recalculateAllScores } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import LoadingState from '../components/ui/LoadingState';

const StatCard = ({ label, value, sub, color, icon }) => (
  <div className="card-compact h-full">
    <div className="flex items-center justify-between mb-2">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <span className={`text-2xl`}>{icon}</span>
    </div>
    <p className={`text-3xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, orgRes] = await Promise.all([getDashboardStats(), getMyOrg()]);
        setStats(statsRes.data.stats);
        setOrg(orgRes.data.organization);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRecalculate = async () => {
    setRecalcLoading(true);
    setRecalcMsg('');
    try {
      const res = await recalculateAllScores();
      setRecalcMsg(res.data.message);
    } catch (err) {
      setRecalcMsg('Recalculation failed');
    } finally {
      setRecalcLoading(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageShell>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0]}! 👋`}
        subtitle="Here's what's happening in your organization"
        actions={
          org ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center min-w-[140px]">
              <p className="text-xs text-blue-500 font-medium">ORG CODE</p>
              <p className="text-xl font-bold font-mono text-blue-700 tracking-widest">{org.org_code}</p>
              <p className="text-xs text-gray-400">Share with employees</p>
            </div>
          ) : null
        }
      />

      {/* Stats Grid */}
      {stats && (
        <div className="stats-grid mb-8">
          <StatCard
            label="Active Employees"
            value={stats.employees.active}
            sub={`${stats.employees.total} total`}
            color="text-blue-600"
            icon="👥"
          />
          <StatCard
            label="Pending Requests"
            value={stats.pendingRequests}
            sub="Awaiting approval"
            color={stats.pendingRequests > 0 ? 'text-yellow-600' : 'text-gray-900'}
            icon="⏳"
          />
          <StatCard
            label="Task Completion"
            value={`${stats.tasks.completionRate}%`}
            sub={`${stats.tasks.completed}/${stats.tasks.total} tasks`}
            color="text-green-600"
            icon="✅"
          />
          <StatCard
            label="Avg Productivity"
            value={`${stats.avgProductivity}`}
            sub="AI score / 100"
            color="text-purple-600"
            icon="🤖"
          />
        </div>
      )}

      <div className="content-grid-3 mb-6">
        {/* Task Overview */}
        {stats && (
          <div className="card lg:col-span-2">
            <h2 className="section-title">Task Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Assigned', value: stats.tasks.assigned, color: 'bg-gray-100 text-gray-700' },
                { label: 'In Progress', value: stats.tasks.inProgress, color: 'bg-blue-100 text-blue-700' },
                { label: 'Completed', value: stats.tasks.completed, color: 'bg-green-100 text-green-700' },
                { label: 'Overdue', value: stats.tasks.overdue, color: 'bg-red-100 text-red-700' },
              ].map((item) => (
                <div key={item.label} className={`rounded-lg p-4 ${item.color}`}>
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="text-xs font-medium mt-1">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            {stats.tasks.total > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Overall Progress</span>
                  <span>{stats.tasks.completionRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${stats.tasks.completionRate}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="card">
          <h2 className="section-title">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/admin/requests"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors group min-h-[64px]"
            >
              <div className="action-icon-box bg-yellow-100">
                <span>⏳</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600">Review Requests</p>
                {stats && stats.pendingRequests > 0 && (
                  <p className="text-xs text-yellow-600">{stats.pendingRequests} pending</p>
                )}
              </div>
            </Link>

            <Link
              to="/admin/tasks"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors group min-h-[64px]"
            >
              <div className="action-icon-box bg-blue-100">
                <span>📋</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600">Assign Tasks</p>
                <p className="text-xs text-gray-400">Create & manage tasks</p>
              </div>
            </Link>

            <Link
              to="/admin/ai-insights"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors group min-h-[64px]"
            >
              <div className="action-icon-box bg-purple-100">
                <span>🤖</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600">AI Insights</p>
                <p className="text-xs text-gray-400">Productivity analysis</p>
              </div>
            </Link>

            <button
              onClick={handleRecalculate}
              disabled={recalcLoading}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition-colors group text-left min-h-[64px]"
            >
              <div className="action-icon-box bg-purple-100">
                {recalcLoading ? (
                  <span className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>🔄</span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-purple-600">
                  Recalculate Scores
                </p>
                {recalcMsg && <p className="text-xs text-green-600">{recalcMsg}</p>}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {stats?.recentActivity?.length > 0 && (
        <div className="card">
          <h2 className="section-title">Recent Activity</h2>
          <div className="space-y-3">
            {stats.recentActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.employee_name}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    item.priority === 'high'
                      ? 'bg-red-100 text-red-700'
                      : item.priority === 'medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {item.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
};

export default AdminDashboard;