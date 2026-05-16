const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, please log in' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id)
      .select('-password -withdrawPassword -securityAnswer -securityQuestionId');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Contact support.',
      });
    }

    req.user = user;

    // Attach impersonation info if this is an admin-issued token
    if (decoded.isImpersonating) {
      req.isImpersonating = true;
      req.adminId = decoded.adminId;
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Blocks impersonation tokens and checks role
const adminOnly = (req, res, next) => {
  if (req.isImpersonating) {
    return res.status(403).json({
      success: false,
      message: 'Impersonation tokens cannot access admin routes',
    });
  }

  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'Admin access required' });
};

// Superadmin only (for future sensitive ops e.g. deleting an admin)
const superAdminOnly = (req, res, next) => {
  if (req.isImpersonating) {
    return res.status(403).json({
      success: false,
      message: 'Impersonation tokens cannot access admin routes',
    });
  }

  if (req.user && req.user.role === 'superadmin') {
    return next();
  }

  return res.status(403).json({ success: false, message: 'Superadmin access required' });
};

module.exports = { protect, adminOnly, superAdminOnly };