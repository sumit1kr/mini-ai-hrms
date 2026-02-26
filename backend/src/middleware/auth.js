const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

/**
 * Middleware to verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data from DB
    const result = await query(
      'SELECT id, email, name, role, organization_id, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/**
 * Middleware to restrict access to admin role only
 */
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

/**
 * Middleware to ensure user belongs to the organization in the route param
 */
const requireSameOrg = (req, res, next) => {
  const orgId = req.params.orgId || req.body.organization_id;
  if (req.user.role !== 'admin' && req.user.organization_id !== orgId) {
    return res.status(403).json({ success: false, message: 'Access denied to this organization' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireSameOrg };