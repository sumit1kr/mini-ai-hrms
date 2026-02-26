const express = require('express');
const { query, getClient } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

/**
 * GET /api/organizations/my
 * Get current admin's organization info
 */
router.get('/my', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT o.*, COUNT(u.id) AS employee_count
       FROM organizations o
       LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'employee' AND u.is_active = TRUE
       WHERE o.id = $1
       GROUP BY o.id`,
      [req.user.organization_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    res.json({ success: true, organization: result.rows[0] });
  } catch (err) {
    logger.error('Get org error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch organization' });
  }
});

/**
 * GET /api/organizations/employees
 * Get all employees in the organization
 */
router.get('/employees', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.name, u.department, u.position, u.skills,
              u.is_active, u.created_at,
              COALESCE(a.productivity_score, 0) AS productivity_score,
              COALESCE(a.performance_trend, 'no_data') AS performance_trend,
              COUNT(t.id) FILTER (WHERE t.status != 'completed') AS active_tasks,
              COUNT(t.id) FILTER (WHERE t.status = 'completed') AS completed_tasks
       FROM users u
       LEFT JOIN ai_scores a ON a.user_id = u.id
       LEFT JOIN tasks t ON t.assigned_to = u.id
       WHERE u.organization_id = $1 AND u.role = 'employee'
       GROUP BY u.id, a.productivity_score, a.performance_trend
       ORDER BY u.name ASC`,
      [req.user.organization_id]
    );

    res.json({ success: true, employees: result.rows });
  } catch (err) {
    logger.error('Get employees error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch employees' });
  }
});

/**
 * GET /api/organizations/requests
 * Get all pending join requests
 */
router.get('/requests', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const result = await query(
      `SELECT id, email, name, department, position, status, requested_at, processed_at
       FROM employee_requests
       WHERE organization_id = $1 AND status = $2
       ORDER BY requested_at DESC`,
      [req.user.organization_id, status]
    );

    res.json({ success: true, requests: result.rows });
  } catch (err) {
    logger.error('Get requests error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
});

/**
 * POST /api/organizations/requests/:requestId/approve
 * Approve an employee join request — creates the user account
 */
router.post('/requests/:requestId/approve', authenticate, requireAdmin, async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { requestId } = req.params;

    // Get request
    const reqResult = await client.query(
      `SELECT * FROM employee_requests WHERE id = $1 AND organization_id = $2`,
      [requestId, req.user.organization_id]
    );

    if (!reqResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const empReq = reqResult.rows[0];

    if (empReq.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Request is already ${empReq.status}` });
    }

    // Check email not taken (race condition guard)
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [empReq.email]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Email already registered as user' });
    }

    // Create employee user
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, name, role, organization_id, department, position)
       VALUES ($1, $2, $3, 'employee', $4, $5, $6)
       RETURNING id, email, name, role, organization_id, department, position`,
      [
        empReq.email,
        empReq.password_hash,
        empReq.name,
        req.user.organization_id,
        empReq.department,
        empReq.position,
      ]
    );

    // Update request status
    await client.query(
      `UPDATE employee_requests
       SET status = 'approved', processed_at = NOW(), processed_by = $1
       WHERE id = $2`,
      [req.user.id, requestId]
    );

    await client.query('COMMIT');

    logger.info(`Request approved: ${empReq.email} joined org ${req.user.organization_id}`);

    res.json({
      success: true,
      message: `${empReq.name} has been approved and added to your organization`,
      user: userResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Approve request error:', err);
    res.status(500).json({ success: false, message: 'Failed to approve request' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/organizations/requests/:requestId/reject
 * Reject an employee join request
 */
router.post('/requests/:requestId/reject', authenticate, requireAdmin, async (req, res) => {
  try {
    const { requestId } = req.params;

    const result = await query(
      `UPDATE employee_requests
       SET status = 'rejected', processed_at = NOW(), processed_by = $1
       WHERE id = $2 AND organization_id = $3 AND status = 'pending'
       RETURNING *`,
      [req.user.id, requestId, req.user.organization_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Request not found or already processed' });
    }

    logger.info(`Request rejected: ${result.rows[0].email}`);

    res.json({ success: true, message: 'Request rejected successfully' });
  } catch (err) {
    logger.error('Reject request error:', err);
    res.status(500).json({ success: false, message: 'Failed to reject request' });
  }
});

/**
 * PUT /api/organizations/employees/:userId
 * Update employee profile (admin only)
 */
router.put('/employees/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { department, position, skills, is_active } = req.body;

    const result = await query(
      `UPDATE users
       SET department = COALESCE($1, department),
           position = COALESCE($2, position),
           skills = COALESCE($3, skills),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5 AND organization_id = $6 AND role = 'employee'
       RETURNING id, email, name, department, position, skills, is_active`,
      [department, position, skills, is_active, userId, req.user.organization_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.json({ success: true, employee: result.rows[0] });
  } catch (err) {
    logger.error('Update employee error:', err);
    res.status(500).json({ success: false, message: 'Failed to update employee' });
  }
});

/**
 * DELETE /api/organizations/employees/:userId
 * Deactivate (soft delete) an employee
 */
router.delete('/employees/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `UPDATE users SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND role = 'employee'
       RETURNING id, name, email`,
      [userId, req.user.organization_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.json({ success: true, message: `${result.rows[0].name} has been deactivated` });
  } catch (err) {
    logger.error('Delete employee error:', err);
    res.status(500).json({ success: false, message: 'Failed to deactivate employee' });
  }
});

module.exports = router;