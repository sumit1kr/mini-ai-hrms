import React, { useState, useEffect } from 'react';
import { getAiInsights, getProductivityRankings, recalculateAllScores } from '../services/api';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import LoadingState from '../components/ui/LoadingState';

const ScoreBar = ({ score }) => (
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div
      className={`h-2 rounded-full transition-all ${
        score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
      }`}
      style={{ width: `${score}%` }}
    />
  </div>
);

const AiInsights = () => {
  const [insights, setInsights] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchData = async () => {
    try {
      const [insRes, rankRes] = await Promise.all([getAiInsights(), getProductivityRankings()]);
      setInsights(insRes.data.insights);
      setRankings(rankRes.data.employees);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRecalc = async () => {
    setRecalcLoading(true);
    setMessage('');
    try {
      const res = await recalculateAllScores();
      setMessage(res.data.message);
      fetchData();
    } catch (err) {
      setMessage('Recalculation failed');
    } finally {
      setRecalcLoading(false);
    }
  };

  const trendIcon = (t) => t === 'improving' ? '📈' : t === 'declining' ? '📉' : '➡️';

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageShell>
      <PageHeader
        title="🤖 AI Insights"
        subtitle="Rule-based workforce intelligence"
        actions={
          <button
            onClick={handleRecalc}
            disabled={recalcLoading}
            className="btn-primary flex items-center gap-2"
          >
            {recalcLoading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : '🔄'}
            Recalculate All
          </button>
        }
      />

      {message && (
        <div className="status-banner status-banner--success">
          {message}
        </div>
      )}

      {insights && (
        <div className="content-grid-2 mb-8">
          {/* Top Performers */}
          <div className="card">
            <h2 className="section-title">🏆 Top Performers</h2>
            {insights.topPerformers.length === 0 ? (
              <p className="helper-text">No data yet</p>
            ) : (
              <div className="space-y-3">
                {insights.topPerformers.map((emp, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xl">{['🥇', '🥈', '🥉'][i]}</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-900">{emp.name}</span>
                        <span className="text-sm font-bold text-green-600">
                          {emp.productivity_score}/100
                        </span>
                      </div>
                      <ScoreBar score={emp.productivity_score} />
                      {emp.department && (
                        <p className="text-xs text-gray-400 mt-0.5">{emp.department}</p>
                      )}
                    </div>
                    <span>{trendIcon(emp.performance_trend)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Needs Attention */}
          <div className="card">
            <h2 className="section-title">⚠️ Needs Attention</h2>
            {insights.needsAttention.length === 0 ? (
              <p className="helper-text">All employees performing well!</p>
            ) : (
              <div className="space-y-3">
                {insights.needsAttention.map((emp, i) => (
                  <div key={i} className="p-3 bg-yellow-50 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-900">{emp.name}</span>
                      <span className="text-sm font-bold text-yellow-600">
                        {emp.productivity_score}/100
                      </span>
                    </div>
                    <ScoreBar score={emp.productivity_score} />
                    {emp.recommendations?.[0] && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        💡 {emp.recommendations[0]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trend Distribution */}
      {insights?.trendDistribution?.length > 0 && (
        <div className="card mb-8">
          <h2 className="section-title">📊 Performance Trends</h2>
          <div className="flex gap-6 flex-wrap">
            {insights.trendDistribution.map((t) => (
              <div key={t.performance_trend} className="flex items-center gap-2">
                <span className="text-2xl">{trendIcon(t.performance_trend)}</span>
                <div>
                  <p className="text-sm font-medium capitalize text-gray-900">
                    {t.performance_trend.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-gray-500">{t.count} employees</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Rankings */}
      <div className="card">
        <h2 className="section-title">📋 Full Productivity Rankings</h2>
        {rankings.length === 0 ? (
          <p className="helper-text">No employee data yet. Approve employees and assign tasks to generate scores.</p>
        ) : (
          <div className="table-wrap">
            <table className="table-base min-w-[760px]">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>Employee</th>
                  <th className="hidden sm:table-cell">Dept</th>
                  <th className="text-right">Score</th>
                  <th className="hidden md:table-cell text-right">Completion</th>
                  <th className="hidden md:table-cell text-right">On-time</th>
                  <th className="text-center w-16">Trend</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((emp, i) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="text-gray-400">{i + 1}</td>
                    <td>
                      <div>
                        <p className="font-medium text-gray-900">{emp.name}</p>
                        {emp.position && <p className="text-xs text-gray-400">{emp.position}</p>}
                      </div>
                    </td>
                    <td className="text-gray-500 hidden sm:table-cell">
                      {emp.department || '-'}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <span className={`font-bold ${
                          emp.productivity_score >= 70 ? 'text-green-600' :
                          emp.productivity_score >= 40 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {emp.productivity_score}
                        </span>
                        <div className="w-16 hidden sm:block">
                          <ScoreBar score={emp.productivity_score} />
                        </div>
                      </div>
                    </td>
                    <td className="text-gray-500 hidden md:table-cell text-right">
                      {emp.task_completion_rate}%
                    </td>
                    <td className="text-gray-500 hidden md:table-cell text-right">
                      {emp.on_time_rate}%
                    </td>
                    <td className="text-center">{trendIcon(emp.performance_trend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default AiInsights;