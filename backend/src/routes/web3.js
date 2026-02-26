const express = require('express');
const { query } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const web3Service = require('../services/web3Service');
const logger = require('../config/logger');

const router = express.Router();

/**
 * GET /api/web3/status
 * Public health check for Web3 integration
 */
router.get('/status', (req, res) => {
  res.json({ success: true, web3: web3Service.getStatus() });
});

/**
 * POST /api/web3/connect-wallet
 * Save an employee's MetaMask wallet address
 */
router.post('/connect-wallet', authenticate, async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return res.status(400).json({ success: false, message: 'Invalid Ethereum wallet address' });
    }

    await query(
      `UPDATE users SET wallet_address = $1, updated_at = NOW() WHERE id = $2`,
      [walletAddress.toLowerCase(), req.user.id]
    );

    logger.info(`Wallet connected: ${walletAddress} -> user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Wallet connected successfully',
      walletAddress: walletAddress.toLowerCase(),
    });
  } catch (err) {
    logger.error('Connect wallet error:', err);
    res.status(500).json({ success: false, message: 'Failed to connect wallet' });
  }
});

/**
 * DELETE /api/web3/disconnect-wallet
 * Remove a user's wallet address
 */
router.delete('/disconnect-wallet', authenticate, async (req, res) => {
  try {
    await query(
      `UPDATE users SET wallet_address = NULL, updated_at = NOW() WHERE id = $1`,
      [req.user.id]
    );
    res.json({ success: true, message: 'Wallet disconnected' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to disconnect wallet' });
  }
});

/**
 * GET /api/web3/activity/:userId
 * Get on-chain activity logs for an employee
 */
router.get('/activity/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    // Access control
    if (req.user.role === 'employee' && req.user.id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get DB logs
    const dbLogs = await query(
      `SELECT bl.event_type, bl.transaction_hash, bl.block_number,
              bl.activity_hash, bl.created_at
       FROM blockchain_logs bl
       WHERE bl.user_id = $1
       ORDER BY bl.created_at DESC
       LIMIT 50`,
      [userId]
    );

    // Get on-chain data (if available)
    const chainActivity = await web3Service.getEmployeeChainActivity(userId);

    res.json({
      success: true,
      dbLogs: dbLogs.rows,
      chainActivity,
      explorerBase: 'https://www.oklink.com/amoy/tx/',
      web3Enabled: web3Service.isActive(),
    });
  } catch (err) {
    logger.error('Get activity error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch activity' });
  }
});

/**
 * POST /api/web3/log-task
 * Manually trigger blockchain log for a completed task (admin)
 */
router.post('/log-task', authenticate, requireAdmin, async (req, res) => {
  try {
    const { taskId, employeeId } = req.body;

    if (!taskId || !employeeId) {
      return res.status(400).json({ success: false, message: 'taskId and employeeId required' });
    }

    // Verify task belongs to org and is completed
    const taskCheck = await query(
      `SELECT id, status FROM tasks WHERE id = $1 AND organization_id = $2`,
      [taskId, req.user.organization_id]
    );

    if (!taskCheck.rows.length) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const result = await web3Service.logTaskCompletion(taskId, employeeId);

    if (!result.success) {
      return res.status(422).json({
        success: false,
        message: result.reason === 'blockchain_not_configured'
          ? 'Blockchain not configured. Deploy contract and set ADMIN_PRIVATE_KEY.'
          : `Blockchain log failed: ${result.error}`,
      });
    }

    res.json({ success: true, blockchain: result });
  } catch (err) {
    logger.error('Manual log task error:', err);
    res.status(500).json({ success: false, message: 'Failed to log task' });
  }
});

/**
 * POST /api/web3/log-payroll
 * Log a payroll event on-chain (admin only)
 */
router.post('/log-payroll', authenticate, requireAdmin, async (req, res) => {
  try {
    const { employeeId, amountCents } = req.body;

    if (!employeeId || !amountCents) {
      return res.status(400).json({ success: false, message: 'employeeId and amountCents required' });
    }

    // Verify employee is in the org
    const empCheck = await query(
      'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
      [employeeId, req.user.organization_id]
    );

    if (!empCheck.rows.length) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const result = await web3Service.logPayrollEvent(employeeId, amountCents);

    if (!result.success) {
      return res.status(422).json({
        success: false,
        message: result.reason === 'blockchain_not_configured'
          ? 'Blockchain not configured. Deploy contract and set ADMIN_PRIVATE_KEY.'
          : `Payroll log failed: ${result.error}`,
      });
    }

    res.json({ success: true, blockchain: result });
  } catch (err) {
    logger.error('Log payroll error:', err);
    res.status(500).json({ success: false, message: 'Failed to log payroll' });
  }
});

/**
 * GET /api/web3/org-logs
 * Get all blockchain logs for the organization (admin)
 */
router.get('/org-logs', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT bl.id, bl.event_type, bl.transaction_hash, bl.block_number,
              bl.activity_hash, bl.created_at,
              u.name AS employee_name, u.email AS employee_email
       FROM blockchain_logs bl
       JOIN users u ON u.id = bl.user_id
       WHERE u.organization_id = $1
       ORDER BY bl.created_at DESC
       LIMIT 100`,
      [req.user.organization_id]
    );

    res.json({
      success: true,
      logs: result.rows,
      total: result.rowCount,
      web3Enabled: web3Service.isActive(),
      explorerBase: 'https://www.oklink.com/amoy/tx/',
    });
  } catch (err) {
    logger.error('Org logs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
});

module.exports = router;