const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query, getClient } = require('../config/db');
const { generateOrgCode } = require('../services/aiService');
const { authenticate } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

/**
 * POST /api/auth/register-admin
 * Admin registers and creates a new organization with a 6-letter code
 */
router.post(
  '/register-admin',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('organizationName').trim().notEmpty().withMessage('Organization name is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const { name, email, password, organizationName, description } = req.body;

      // Check if email already exists
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }

      // Generate unique org code
      const orgCode = await generateOrgCode();

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create org (admin_id set after user creation)
      const orgResult = await client.query(
        `INSERT INTO organizations (name, org_code, description) VALUES ($1, $2, $3) RETURNING *`,
        [organizationName, orgCode, description || null]
      );
      const org = orgResult.rows[0];

      // Create admin user
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, name, role, organization_id)
         VALUES ($1, $2, $3, 'admin', $4) RETURNING id, email, name, role, organization_id`,
        [email, passwordHash, name, org.id]
      );
      const user = userResult.rows[0];

      // Update org with admin_id
      await client.query('UPDATE organizations SET admin_id = $1 WHERE id = $2', [user.id, org.id]);

      await client.query('COMMIT');

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, role: user.role, orgId: org.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      logger.info(`Admin registered: ${email}, Org: ${organizationName} [${orgCode}]`);

      res.status(201).json({
        success: true,
        message: 'Organization created successfully',
        token,
        user: { ...user, organization_id: org.id },
        organization: { ...org, admin_id: user.id },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Admin registration error:', err);
      res.status(500).json({ success: false, message: 'Registration failed' });
    } finally {
      client.release();
    }
  }
);

/**
 * POST /api/auth/register-employee
 * Employee requests to join an organization using a 6-letter org code
 */
router.post(
  '/register-employee',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('orgCode')
      .trim()
      .isLength({ min: 6, max: 6 })
      .toUpperCase()
      .withMessage('Org code must be exactly 6 letters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, email, password, orgCode, department, position } = req.body;
      const upperCode = orgCode.toUpperCase();

      // Find organization
      const orgResult = await query('SELECT * FROM organizations WHERE org_code = $1', [upperCode]);
      if (!orgResult.rows.length) {
        return res.status(404).json({ success: false, message: 'Invalid organization code' });
      }
      const org = orgResult.rows[0];

      // Check if email already registered as user
      const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }

      // Check if already has a pending request for this org
      const existingRequest = await query(
        `SELECT id, status FROM employee_requests WHERE email = $1 AND organization_id = $2`,
        [email, org.id]
      );
      if (existingRequest.rows.length) {
        const { status } = existingRequest.rows[0];
        if (status === 'pending') {
          return res.status(409).json({
            success: false,
            message: 'You already have a pending request for this organization',
          });
        }
        if (status === 'rejected') {
          return res.status(403).json({
            success: false,
            message: 'Your previous request was rejected. Contact the admin.',
          });
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create pending request
      const requestResult = await query(
        `INSERT INTO employee_requests (email, name, password_hash, org_code, organization_id, department, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, name, status, requested_at`,
        [email, name, passwordHash, upperCode, org.id, department || null, position || null]
      );

      logger.info(`Employee join request: ${email} -> Org [${upperCode}]`);

      res.status(201).json({
        success: true,
        message: `Request submitted to join "${org.name}". Waiting for admin approval.`,
        request: requestResult.rows[0],
        organization: { name: org.name, org_code: org.org_code },
      });
    } catch (err) {
      logger.error('Employee registration error:', err);
      res.status(500).json({ success: false, message: 'Registration failed' });
    }
  }
);

/**
 * POST /api/auth/login
 * Login for both admins and employees
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { email, password } = req.body;

      const result = await query(
        `SELECT u.*, o.name AS org_name, o.org_code
         FROM users u
         LEFT JOIN organizations o ON o.id = u.organization_id
         WHERE u.email = $1`,
        [email]
      );

      if (!result.rows.length) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(403).json({ success: false, message: 'Account is inactive' });
      }

      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role, orgId: user.organization_id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      const { password_hash, ...safeUser } = user;

      logger.info(`Login: ${email} [${user.role}]`);

      res.json({
        success: true,
        token,
        user: safeUser,
      });
    } catch (err) {
      logger.error('Login error:', err);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.name, u.role, u.organization_id, u.department,
              u.position, u.skills, u.is_active, u.created_at,
              o.name AS org_name, o.org_code
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

module.exports = router;