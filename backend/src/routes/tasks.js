const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getTaskAssignmentSuggestions } = require('../services/aiService');
const web3Service = require('../services/web3Service');
const logger = require('../config/logger');

const router = express.Router();

/**
 * GET /api/tasks
 * Get tasks (admin sees all org tasks; employee sees own tasks)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, priority, assignedTo } = req.query;

    let queryText, params;

    if (req.user.role === 'admin') {
      let conditions = ['t.organization_id = $1'];
      params = [req.user.organization_id];

      if (status) {
        params.push(status);
        conditions.push(`t.status = $${params.length}`);
      }
      if (priority) {
        params.push(priority);
        conditions.push(`t.priority = $${params.length}`);
      }
      if (assignedTo) {
        params.push(assignedTo);
        conditions.push(`t.assigned_to = $${params.length}`);
      }

      queryText = `
        SELECT t.*,
               u.name AS assigned_to_name,
               u.email AS assigned_to_email,
               a.name AS assigned_by_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assigned_to
        LEFT JOIN users a ON a.id = t.assigned_by
        WHERE ${conditions.join(' AND ')}
        ORDER BY
          CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          t.due_date ASC NULLS LAST,
          t.created_at DESC
      `;
    } else {
      // Employee: only see their tasks
      let conditions = ['t.assigned_to = $1'];
      params = [req.user.id];

      if (status) {
        params.push(status);
        conditions.push(`t.status = $${params.length}`);
      }

      queryText = `
        SELECT t.*,
               a.name AS assigned_by_name
        FROM tasks t
        LEFT JOIN users a ON a.id = t.assigned_by
        WHERE ${conditions.join(' AND ')}
        ORDER BY
          CASE t.status WHEN 'assigned' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,
          t.due_date ASC NULLS LAST
      `;
    }

    const result = await query(queryText, params);
    res.json({ success: true, tasks: result.rows });
  } catch (err) {
    logger.error('Get tasks error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
});

/**
 * POST /api/tasks
 * Create a new task (admin only)
 */
router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('assignedTo').isUUID().withMessage('Valid employee ID required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { title, description, assignedTo, priority, dueDate } = req.body;

      // Verify assigned employee belongs to same org
      const empCheck = await query(
        'SELECT id, name FROM users WHERE id = $1 AND organization_id = $2 AND role = $3 AND is_active = TRUE',
        [assignedTo, req.user.organization_id, 'employee']
      );

      if (!empCheck.rows.length) {
        return res.status(400).json({ success: false, message: 'Employee not found in your organization' });
      }

      const result = await query(
        `INSERT INTO tasks (title, description, assigned_to, assigned_by, organization_id, priority, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          title,
          description || null,
          assignedTo,
          req.user.id,
          req.user.organization_id,
          priority || 'medium',
          dueDate || null,
        ]
      );

      const task = result.rows[0];

      logger.info(`Task created: "${title}" assigned to ${empCheck.rows[0].name}`);

      res.status(201).json({ success: true, task });
    } catch (err) {
      logger.error('Create task error:', err);
      res.status(500).json({ success: false, message: 'Failed to create task' });
    }
  }
);

/**
 * GET /api/tasks/suggestions
 * MUST be defined BEFORE /:id to prevent Express matching "suggestions" as an ID
 * Get AI-powered employee suggestions for a new task
 */
router.get('/suggestions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { skills } = req.query;
    const requiredSkills = skills ? skills.split(',').map((s) => s.trim()) : [];
    const suggestions = await getTaskAssignmentSuggestions(req.user.organization_id, requiredSkills);
    res.json({ success: true, suggestions });
  } catch (err) {
    logger.error('Task suggestions error:', err);
    res.status(500).json({ success: false, message: 'Failed to get suggestions' });
  }
});

/**
 * PUT /api/tasks/:id
 * Update task (admin can update all fields; employee can only update status)
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, assignedTo } = req.body;

    // Verify task belongs to org and (if employee) is assigned to them
    let taskCheck;
    if (req.user.role === 'admin') {
      taskCheck = await query(
        'SELECT * FROM tasks WHERE id = $1 AND organization_id = $2',
        [id, req.user.organization_id]
      );
    } else {
      taskCheck = await query(
        'SELECT * FROM tasks WHERE id = $1 AND assigned_to = $2',
        [id, req.user.id]
      );
    }

    if (!taskCheck.rows.length) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];

    if (req.user.role === 'admin') {
      if (title !== undefined) { values.push(title); updates.push(`title = $${values.length}`); }
      if (description !== undefined) { values.push(description); updates.push(`description = $${values.length}`); }
      if (priority !== undefined) { values.push(priority); updates.push(`priority = $${values.length}`); }
      if (dueDate !== undefined) { values.push(dueDate); updates.push(`due_date = $${values.length}`); }
      if (assignedTo !== undefined) { values.push(assignedTo); updates.push(`assigned_to = $${values.length}`); }
    }

    // Both admin and employee can update status
    if (status !== undefined) {
      values.push(status);
      updates.push(`status = $${values.length}`);

      // Set completed_at if marking complete
      if (status === 'completed') {
        updates.push(`completed_at = NOW()`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    const updatedTask = result.rows[0];

    // ── Blockchain logging: auto-log task completion on Polygon ──────────────
    let blockchainResult = null;
    if (status === 'completed' && web3Service.isActive()) {
      const assignedUserId = updatedTask.assigned_to || req.user.id;
      // Fire-and-forget: don't block API response on blockchain tx
      web3Service.logTaskCompletion(id, assignedUserId)
        .then((r) => {
          if (r.success) logger.info(`Blockchain: task ${id} logged — tx: ${r.txHash}`);
        })
        .catch((err) => logger.error('Blockchain log error:', err.message));

      blockchainResult = { status: 'pending', message: 'Blockchain log submitted' };
    }

    res.json({ success: true, task: updatedTask, blockchain: blockchainResult });
  } catch (err) {
    logger.error('Update task error:', err);
    res.status(500).json({ success: false, message: 'Failed to update task' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task (admin only)
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM tasks WHERE id = $1 AND organization_id = $2 RETURNING id, title',
      [id, req.user.organization_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, message: `Task "${result.rows[0].title}" deleted` });
  } catch (err) {
    logger.error('Delete task error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
});

module.exports = router;