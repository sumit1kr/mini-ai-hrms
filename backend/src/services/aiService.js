const { query } = require('../config/db');

/**
 * Generates a unique 6-letter uppercase organization code
 * @returns {Promise<string>} Unique org code
 */
const generateOrgCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code;
  let isUnique = false;

  while (!isUnique) {
    // Generate random 6-letter code
    code = Array.from({ length: 6 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');

    // Check uniqueness in DB
    const result = await query('SELECT id FROM organizations WHERE org_code = $1', [code]);
    if (!result.rows.length) {
      isUnique = true;
    }
  }

  return code;
};

/**
 * Calculates rule-based productivity score for an employee
 * Score components:
 *   - Task completion rate      (40%)
 *   - On-time completion rate   (30%)
 *   - Task complexity bonus     (20%)
 *   - Recent activity bonus     (10%)
 * @param {string} userId
 * @returns {Promise<Object>} Score details
 */
const calculateProductivityScore = async (userId) => {
  try {
    // Get all tasks for this user
    const tasksResult = await query(
      `SELECT status, priority, due_date, completed_at, created_at
       FROM tasks
       WHERE assigned_to = $1`,
      [userId]
    );

    const tasks = tasksResult.rows;
    const totalTasks = tasks.length;

    if (totalTasks === 0) {
      return {
        score: 0,
        taskCompletionRate: 0,
        onTimeRate: 0,
        complexityScore: 0,
        recentActivityBonus: 0,
        trend: 'no_data',
        recommendations: ['Get started by completing your first task!'],
      };
    }

    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const completionRate = completedTasks.length / totalTasks;

    // On-time completions: completed before due_date
    const onTimeTasks = completedTasks.filter((t) => {
      if (!t.due_date) return true; // No due date = not late
      return new Date(t.completed_at) <= new Date(t.due_date);
    });
    const onTimeRate = completedTasks.length > 0 ? onTimeTasks.length / completedTasks.length : 0;

    // Complexity bonus based on priority distribution
    const highPriority = completedTasks.filter((t) => t.priority === 'high').length;
    const medPriority = completedTasks.filter((t) => t.priority === 'medium').length;
    const complexityScore = completedTasks.length > 0
      ? (highPriority * 1.0 + medPriority * 0.6) / completedTasks.length
      : 0;

    // Recent activity: tasks completed in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCompleted = completedTasks.filter(
      (t) => t.completed_at && new Date(t.completed_at) >= sevenDaysAgo
    ).length;
    const recentBonus = Math.min(recentCompleted / 3, 1); // cap at 1

    // Final weighted score (0–100)
    const rawScore =
      completionRate * 40 +
      onTimeRate * 30 +
      complexityScore * 20 +
      recentBonus * 10;

    const score = Math.round(Math.min(rawScore, 100) * 100) / 100;

    // Trend: compare last 7 days vs previous 7 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const prevPeriod = completedTasks.filter(
      (t) =>
        t.completed_at &&
        new Date(t.completed_at) >= fourteenDaysAgo &&
        new Date(t.completed_at) < sevenDaysAgo
    ).length;

    let trend = 'stable';
    if (recentCompleted > prevPeriod + 1) trend = 'improving';
    else if (recentCompleted < prevPeriod - 1) trend = 'declining';

    // Recommendations
    const recommendations = [];
    if (completionRate < 0.5) recommendations.push('Focus on completing assigned tasks');
    if (onTimeRate < 0.6) recommendations.push('Improve time management to meet deadlines');
    if (highPriority === 0) recommendations.push('Take on higher priority tasks to boost score');
    if (recentCompleted === 0) recommendations.push('Stay active — complete tasks regularly');
    if (recommendations.length === 0) recommendations.push('Great work! Keep up the momentum!');

    // Persist score to ai_scores table
    await query(
      `INSERT INTO ai_scores (user_id, organization_id, productivity_score, task_completion_rate, on_time_rate, performance_trend, recommendations, last_calculated)
       SELECT $1, organization_id, $2, $3, $4, $5, $6, NOW()
       FROM users WHERE id = $1
       ON CONFLICT (user_id) DO UPDATE SET
         productivity_score = $2,
         task_completion_rate = $3,
         on_time_rate = $4,
         performance_trend = $5,
         recommendations = $6,
         last_calculated = NOW()`,
      [
        userId,
        score,
        Math.round(completionRate * 100 * 100) / 100,
        Math.round(onTimeRate * 100 * 100) / 100,
        trend,
        recommendations,
      ]
    );

    return {
      score,
      taskCompletionRate: Math.round(completionRate * 100),
      onTimeRate: Math.round(onTimeRate * 100),
      complexityScore: Math.round(complexityScore * 100),
      recentActivityBonus: Math.round(recentBonus * 100),
      trend,
      recommendations,
      totalTasks,
      completedTasks: completedTasks.length,
    };
  } catch (err) {
    throw err;
  }
};

/**
 * Get smart task assignment recommendation based on employee workload and skills
 * @param {string} organizationId
 * @param {Array<string>} requiredSkills
 * @returns {Promise<Array>} Ranked employee suggestions
 */
const getTaskAssignmentSuggestions = async (organizationId, requiredSkills = []) => {
  const result = await query(
    `SELECT u.id, u.name, u.department, u.skills,
       COUNT(t.id) FILTER (WHERE t.status != 'completed') AS active_tasks,
       COALESCE(a.productivity_score, 0) AS productivity_score
     FROM users u
     LEFT JOIN tasks t ON t.assigned_to = u.id
     LEFT JOIN ai_scores a ON a.user_id = u.id
     WHERE u.organization_id = $1 AND u.role = 'employee' AND u.is_active = TRUE
     GROUP BY u.id, u.name, u.department, u.skills, a.productivity_score
     ORDER BY active_tasks ASC, a.productivity_score DESC`,
    [organizationId]
  );

  // Rank by skill match + workload
  const scored = result.rows.map((emp) => {
    const empSkills = emp.skills || [];
    const skillMatch = requiredSkills.length > 0
      ? requiredSkills.filter((s) =>
          empSkills.some((es) => es.toLowerCase().includes(s.toLowerCase()))
        ).length / requiredSkills.length
      : 0.5;

    const workloadScore = Math.max(0, 1 - parseInt(emp.active_tasks, 10) / 10);
    const aiScore = parseFloat(emp.productivity_score) / 100;

    const totalScore = skillMatch * 0.4 + workloadScore * 0.35 + aiScore * 0.25;

    return { ...emp, recommendationScore: Math.round(totalScore * 100) };
  });

  return scored.sort((a, b) => b.recommendationScore - a.recommendationScore).slice(0, 5);
};

module.exports = { generateOrgCode, calculateProductivityScore, getTaskAssignmentSuggestions };