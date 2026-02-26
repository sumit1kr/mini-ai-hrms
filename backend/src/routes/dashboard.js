const express = require('express');
const { query } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

/**
 * GET /api/dashboard/stats
 * Get overview stats for the admin dashboard
 */
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const [employeesRes, tasksRes, requestsRes, scoresRes] = await Promise.all([
      // Employee counts
      query(
        `SELECT
           COUNT(*) FILTER (WHERE is_active = TRUE) AS active_employees,
           COUNT(*) AS total_employees
         FROM users WHERE organization_id = $1 AND role = 'employee'`,
        [orgId]
      ),
      // Task stats
      query(
        `SELECT
           COUNT(*) AS total_tasks,
           COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks,
           COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_tasks,
           COUNT(*) FILTER (WHERE status = 'assigned') AS assigned_tasks,
           COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'completed') AS overdue_tasks
         FROM tasks WHERE organization_id = $1`,
        [orgId]
      ),
      // Pending requests
      query(
        `SELECT COUNT(*) AS pending_requests
         FROM employee_requests WHERE organization_id = $1 AND status = 'pending'`,
        [orgId]
      ),
      // Avg productivity score
      query(
        `SELECT COALESCE(AVG(a.productivity_score), 0) AS avg_productivity
         FROM ai_scores a
         JOIN users u ON u.id = a.user_id
         WHERE u.organization_id = $1 AND u.is_active = TRUE`,
        [orgId]
      ),
    ]);

    // Recent activity (last 5 completed tasks)
    const recentActivity = await query(
      `SELECT t.title, t.completed_at, t.priority, u.name AS employee_name
       FROM tasks t
       JOIN users u ON u.id = t.assigned_to
       WHERE t.organization_id = $1 AND t.status = 'completed'
       ORDER BY t.completed_at DESC
       LIMIT 5`,
      [orgId]
    );

    const stats = {
      employees: {
        active: parseInt(employeesRes.rows[0].active_employees, 10),
        total: parseInt(employeesRes.rows[0].total_employees, 10),
      },
      tasks: {
        total: parseInt(tasksRes.rows[0].total_tasks, 10),
        completed: parseInt(tasksRes.rows[0].completed_tasks, 10),
        inProgress: parseInt(tasksRes.rows[0].in_progress_tasks, 10),
        assigned: parseInt(tasksRes.rows[0].assigned_tasks, 10),
        overdue: parseInt(tasksRes.rows[0].overdue_tasks, 10),
        completionRate:
          tasksRes.rows[0].total_tasks > 0
            ? Math.round(
                (tasksRes.rows[0].completed_tasks / tasksRes.rows[0].total_tasks) * 100
              )
            : 0,
      },
      pendingRequests: parseInt(requestsRes.rows[0].pending_requests, 10),
      avgProductivity: Math.round(parseFloat(scoresRes.rows[0].avg_productivity) * 10) / 10,
      recentActivity: recentActivity.rows,
    };

    res.json({ success: true, stats });
  } catch (err) {
    logger.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
});

/**
 * GET /api/dashboard/productivity
 * Get productivity rankings for all employees
 */
router.get('/productivity', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.department, u.position,
              COALESCE(a.productivity_score, 0) AS productivity_score,
              COALESCE(a.task_completion_rate, 0) AS task_completion_rate,
              COALESCE(a.on_time_rate, 0) AS on_time_rate,
              COALESCE(a.performance_trend, 'no_data') AS performance_trend,
              COALESCE(a.recommendations, '{}') AS recommendations,
              a.last_calculated,
              COUNT(t.id) FILTER (WHERE t.status = 'completed') AS tasks_completed,
              COUNT(t.id) FILTER (WHERE t.status != 'completed') AS tasks_pending
       FROM users u
       LEFT JOIN ai_scores a ON a.user_id = u.id
       LEFT JOIN tasks t ON t.assigned_to = u.id
       WHERE u.organization_id = $1 AND u.role = 'employee' AND u.is_active = TRUE
       GROUP BY u.id, u.name, u.department, u.position, a.productivity_score,
                a.task_completion_rate, a.on_time_rate, a.performance_trend,
                a.recommendations, a.last_calculated
       ORDER BY productivity_score DESC`,
      [req.user.organization_id]
    );

    res.json({ success: true, employees: result.rows });
  } catch (err) {
    logger.error('Productivity error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch productivity data' });
  }
});

/**
 * GET /api/dashboard/my-stats
 * Employee's own dashboard stats
 */
router.get('/my-stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const [tasksRes, scoreRes] = await Promise.all([
      query(
        `SELECT
           COUNT(*) AS total_tasks,
           COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks,
           COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_tasks,
           COUNT(*) FILTER (WHERE status = 'assigned') AS assigned_tasks,
           COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'completed') AS overdue_tasks
         FROM tasks WHERE assigned_to = $1`,
        [userId]
      ),
      query(
        `SELECT productivity_score, task_completion_rate, on_time_rate,
                performance_trend, recommendations, last_calculated
         FROM ai_scores WHERE user_id = $1`,
        [userId]
      ),
    ]);

    // Recent tasks
    const recentTasks = await query(
      `SELECT id, title, status, priority, due_date, completed_at, created_at
       FROM tasks WHERE assigned_to = $1
       ORDER BY
         CASE status WHEN 'in_progress' THEN 1 WHEN 'assigned' THEN 2 ELSE 3 END,
         due_date ASC NULLS LAST
       LIMIT 10`,
      [userId]
    );

    res.json({
      success: true,
      stats: {
        tasks: {
          total: parseInt(tasksRes.rows[0].total_tasks, 10),
          completed: parseInt(tasksRes.rows[0].completed_tasks, 10),
          inProgress: parseInt(tasksRes.rows[0].in_progress_tasks, 10),
          assigned: parseInt(tasksRes.rows[0].assigned_tasks, 10),
          overdue: parseInt(tasksRes.rows[0].overdue_tasks, 10),
        },
        productivity: scoreRes.rows[0] || null,
        recentTasks: recentTasks.rows,
      },
    });
  } catch (err) {
    logger.error('My stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch your stats' });
  }
});

module.exports = router;