const express = require('express');
const { query } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { calculateProductivityScore } = require('../services/aiService');
const logger = require('../config/logger');

const router = express.Router();

/**
 * GET /api/ai/score/:userId
 * Get or recalculate productivity score for a specific employee
 */
router.get('/score/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    // Employee can only see own score; admin can see any in their org
    if (req.user.role === 'employee' && req.user.id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (req.user.role === 'admin') {
      const check = await query(
        'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
        [userId, req.user.organization_id]
      );
      if (!check.rows.length) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }
    }

    const score = await calculateProductivityScore(userId);

    res.json({ success: true, score });
  } catch (err) {
    logger.error('AI score error:', err);
    res.status(500).json({ success: false, message: 'Failed to calculate score' });
  }
});

/**
 * POST /api/ai/recalculate-all
 * Recalculate scores for all employees in the org (admin only)
 */
router.post('/recalculate-all', authenticate, requireAdmin, async (req, res) => {
  try {
    const employees = await query(
      'SELECT id FROM users WHERE organization_id = $1 AND role = $2 AND is_active = TRUE',
      [req.user.organization_id, 'employee']
    );

    const results = await Promise.allSettled(
      employees.rows.map((e) => calculateProductivityScore(e.id))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.info(`AI recalculate: ${succeeded} succeeded, ${failed} failed`);

    res.json({
      success: true,
      message: `Scores recalculated for ${succeeded} employees${failed > 0 ? `, ${failed} failed` : ''}`,
      updated: succeeded,
      failed,
    });
  } catch (err) {
    logger.error('Recalculate all error:', err);
    res.status(500).json({ success: false, message: 'Recalculation failed' });
  }
});

/**
 * GET /api/ai/insights
 * Get org-wide AI insights (admin only)
 */
router.get('/insights', authenticate, requireAdmin, async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const [topPerformers, bottomPerformers, trends] = await Promise.all([
      // Top 3 performers
      query(
        `SELECT u.name, u.department, a.productivity_score, a.performance_trend
         FROM ai_scores a JOIN users u ON u.id = a.user_id
         WHERE u.organization_id = $1 AND u.is_active = TRUE
         ORDER BY a.productivity_score DESC LIMIT 3`,
        [orgId]
      ),
      // Bottom 3 (need attention)
      query(
        `SELECT u.name, u.department, a.productivity_score, a.performance_trend, a.recommendations
         FROM ai_scores a JOIN users u ON u.id = a.user_id
         WHERE u.organization_id = $1 AND u.is_active = TRUE
         ORDER BY a.productivity_score ASC LIMIT 3`,
        [orgId]
      ),
      // Trend distribution
      query(
        `SELECT performance_trend, COUNT(*) AS count
         FROM ai_scores a JOIN users u ON u.id = a.user_id
         WHERE u.organization_id = $1 AND u.is_active = TRUE
         GROUP BY performance_trend`,
        [orgId]
      ),
    ]);

    res.json({
      success: true,
      insights: {
        topPerformers: topPerformers.rows,
        needsAttention: bottomPerformers.rows,
        trendDistribution: trends.rows,
      },
    });
  } catch (err) {
    logger.error('AI insights error:', err);
    res.status(500).json({ success: false, message: 'Failed to get insights' });
  }
});

module.exports = router;