const jwt = require('jsonwebtoken')

const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, ...data })
}

const sendError = (res, message = 'Error', statusCode = 400) => {
  return res.status(statusCode).json({ success: false, message })
}

const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' })

const generateRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  })

const generateJWT = generateAccessToken

const isProd = () => process.env.NODE_ENV === 'production'

const setAuthCookies = (res, userId) => {
  const accessToken  = generateAccessToken(userId)
  const refreshToken = generateRefreshToken(userId)

  const cookieBase = {
    httpOnly: true,
    secure:   isProd(),
    // 'none' requires secure:true (HTTPS only).
    // In dev secure=false so we must use 'lax' — otherwise browser rejects the cookie.
    sameSite: isProd() ? 'none' : 'lax',
domain: isProd() ? '.mylmenergy.com' : undefined,
    path:     '/',
  }

  // Access token — 1 hour
  res.cookie('access_token', accessToken, {
    ...cookieBase,
    maxAge: 60 * 60 * 1000,
  })

  // Refresh token — 30 days, path-locked to the refresh endpoint
  res.cookie('refresh_token', refreshToken, {
    ...cookieBase,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path:   '/api/auth/refresh',
  })

  return { accessToken, refreshToken }
}

const clearAuthCookies = (res) => {
  const base = { httpOnly: true, secure: isProd(), sameSite: isProd() ? 'none' : 'lax', path: '/' }
  res.clearCookie('access_token', base)
  res.clearCookie('refresh_token', { ...base, path: '/api/auth/refresh' })
}

const calcWithdrawalFee = (amountUSD, feeLow = 10, feeHigh = 20, threshold = 500) => {
  const feePercent = amountUSD >= threshold ? feeHigh : feeLow
  const feeAmount  = +(amountUSD * (feePercent / 100)).toFixed(4)
  const netAmount  = +(amountUSD - feeAmount).toFixed(4)
  return { feePercent, feeAmount, netAmount }
}

const paginate = (page = 1, limit = 20) => {
  const p = Math.max(1, parseInt(page))
  const l = Math.min(100, Math.max(1, parseInt(limit)))
  return { skip: (p - 1) * l, limit: l, page: p }
}

  function getClientIp(req) {
    const xff = (req.headers['x-forwarded-for'] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    let ip = xff[0] || req.ip || ''
    ip = ip.replace(/^::ffff:/i, '')          // strip IPv6-mapped IPv4 prefix
    if (ip === '::1' || ip === '') ip = '127.0.0.1'  // IPv6 loopback -> IPv4
    const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)
    if (!isIpv4) ip = '127.0.0.1'             // gateway expects IPv4
    return ip
  }

module.exports = {
  sendSuccess, sendError,
  generateJWT, generateAccessToken, generateRefreshToken,
  setAuthCookies, clearAuthCookies,getClientIp, isProd,
  calcWithdrawalFee, paginate,
}