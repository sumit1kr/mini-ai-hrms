import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyStats, getAiScore } from '../services/api';
import { getUserBlockchainActivity } from '../services/web3Service';
import { useAuth } from '../context/AuthContext';
import WalletConnect from '../components/WalletConnect';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import LoadingState from '../components/ui/LoadingState';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [score, setScore] = useState(null);
  const [chainLogs, setChainLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoreLoading, setScoreLoading] = useState(false);

  useEffect(() => {
    getMyStats()
      .then((r) => setStats(r.data.stats))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Fetch blockchain activity
  useEffect(() => {
    if (!user?.id) return undefined;

    let isMounted = true;

    const fetchChainLogs = async () => {
      try {
        const r = await getUserBlockchainActivity(user.id);
        if (isMounted) {
          setChainLogs(r.data.dbLogs || []);
        }
      } catch {
      }
    };

    fetchChainLogs();
    const intervalId = setInterval(fetchChainLogs, 10000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [user?.id]);

  const handleFetchScore = async () => {
    setScoreLoading(true);
    try {
      const res = await getAiScore(user.id);
      setScore(res.data.score);
    } catch (err) {
      console.error(err);
    } finally {
      setScoreLoading(false);
    }
  };

  const statusColor = (s) => {
    if (s === 'completed') return 'bg-green-100 text-green-700';
    if (s === 'in_progress') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  };

  const isOverdue = (t) =>
    t.due_date && t.status !== 'completed' && new Date(t.due_date) < new Date();

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageShell>
      <PageHeader
        title={`Hello, ${user?.name?.split(' ')[0]}! 👋`}
        subtitle={user?.org_name}
        actions={
          <>
            {user?.department && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                {user.department}
              </span>
            )}
            {user?.position && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {user.position}
              </span>
            )}
          </>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="stats-grid mb-8">
          {[
            { label: 'Total Tasks', value: stats.tasks.total, color: 'text-gray-900', icon: '📋' },
            { label: 'In Progress', value: stats.tasks.inProgress, color: 'text-blue-600', icon: '🔄' },
            { label: 'Completed', value: stats.tasks.completed, color: 'text-green-600', icon: '✅' },
            { label: 'Overdue', value: stats.tasks.overdue, color: 'text-red-600', icon: '⚠️' },
          ].map((s) => (
            <div key={s.label} className="card-compact text-center h-full">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="content-grid-3">
        {/* Left: AI Score + Wallet */}
        <div className="space-y-4">
          {/* AI Score */}
          <div className="card">
            <h2 className="section-title">🤖 My AI Score</h2>
            {score ? (
              <div>
                <div className="text-center mb-4">
                  <div className={`text-5xl font-bold mb-1 ${
                    score.score >= 70 ? 'text-green-600' :
                    score.score >= 40 ? 'text-yellow-600' : 'text-red-600'
                  }`}>{score.score}</div>
                  <p className="helper-text">out of 100</p>
                  <p className="text-lg mt-1">
                    {score.trend === 'improving' ? '📈 Improving' :
                     score.trend === 'declining' ? '📉 Declining' : '➡️ Stable'}
                  </p>
                </div>
                <div className="space-y-2 mb-4">
                  {[
                    { label: 'Task Completion', value: score.taskCompletionRate },
                    { label: 'On-time Rate', value: score.onTimeRate },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{m.label}</span><span>{m.value}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${m.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {score.recommendations?.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3 text-xs">
                    <p className="font-medium text-blue-700 mb-1">💡 Recommendations</p>
                    {score.recommendations.map((r, i) => (
                      <p key={i} className="text-gray-600 mb-0.5">• {r}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <p className="helper-text mb-4">Click to calculate your score</p>
                <button
                  onClick={handleFetchScore}
                  disabled={scoreLoading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {scoreLoading
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : '🤖'}
                  Calculate Score
                </button>
              </div>
            )}
          </div>

          {/* Blockchain Wallet */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">⛓️ Blockchain Wallet</h2>
            <p className="text-xs text-gray-500 mb-3">
              Connect MetaMask to get immutable on-chain records of your task completions on Polygon.
            </p>
            <WalletConnect />

            {/* Chain logs */}
            {chainLogs.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  📜 On-chain Events ({chainLogs.length})
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {chainLogs.slice(0, 6).map((log, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-orange-50 rounded-md p-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        log.event_type === 'task_completion' ? 'bg-green-500' : 'bg-blue-500'
                      }`} />
                      <span className="text-gray-600 capitalize flex-1 truncate">
                        {log.event_type.replace(/_/g, ' ')}
                      </span>
                      {log.transaction_hash && (
                        <a
                          href={`https://www.oklink.com/amoy/tx/${log.transaction_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:underline font-mono flex-shrink-0"
                        >
                          {log.transaction_hash.slice(0, 8)}...
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Tasks */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">My Tasks</h2>
            <Link to="/employee/tasks" className="text-sm text-blue-600 hover:text-blue-800">
              View all →
            </Link>
          </div>

          {!stats?.recentTasks?.length ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">📭</p>
              <p className="helper-text">No tasks assigned yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentTasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    isOverdue(task) ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      {task.due_date && (
                        <span className="text-xs text-gray-400">
                          📅 {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {isOverdue(task) && (
                        <span className="text-xs text-red-600 font-medium">⚠️ Overdue</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      task.priority === 'high' ? 'bg-red-100 text-red-700' :
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{task.priority}</span>
                    {/* Blockchain confirmation badge */}
                    {task.status === 'completed' && chainLogs.length > 0 && (
                      <span
                        title="Task logged on Polygon blockchain"
                        className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full"
                      >
                        ⛓️
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export default EmployeeDashboard;