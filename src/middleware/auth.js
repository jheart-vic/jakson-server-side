const jwt  = require('jsonwebtoken')
const User = require('../models/User')

/**
 * Reads the access token from:
 *  1. HTTP-only cookie  `access_token`  (browser clients)
 *  2. Authorization header `Bearer …`   (non-browser / mobile fallback)
 */
const protect = async (req, res, next) => {
  try {
    let token = req.cookies?.access_token

    // Fallback for API clients that send a Bearer token
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, please log in' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user    = await User.findById(decoded.id)
      .select('-password -withdrawPassword -securityAnswer -securityQuestionId')

    if (!user)          return res.status(401).json({ success: false, message: 'User no longer exists' })
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account suspended. Contact support.' })

    req.user = user

    if (decoded.isImpersonating) {
      req.isImpersonating = true
      req.adminId         = decoded.adminId
    }

    next()
  } catch (err) {
    // Expired access token → client should call /auth/refresh
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Access token expired', code: 'TOKEN_EXPIRED' })
    }
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
}

const adminOnly = (req, res, next) => {
  if (req.isImpersonating)
    return res.status(403).json({ success: false, message: 'Impersonation tokens cannot access admin routes' })
  if (req.user?.role === 'admin' || req.user?.role === 'superadmin') return next()
  return res.status(403).json({ success: false, message: 'Admin access required' })
}

const superAdminOnly = (req, res, next) => {
  if (req.isImpersonating)
    return res.status(403).json({ success: false, message: 'Impersonation tokens cannot access admin routes' })
  if (req.user?.role === 'superadmin') return next()
  return res.status(403).json({ success: false, message: 'Superadmin access required' })
}

module.exports = { protect, adminOnly, superAdminOnly }