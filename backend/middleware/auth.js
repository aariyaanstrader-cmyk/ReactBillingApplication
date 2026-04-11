const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('+password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin access required' });
};

const auditLog = (action, resourceType = '') => async (req, res, next) => {
  res.on('finish', async () => {
    try {
      await AuditLog.create({
        user: req.user?._id,
        username: req.user?.username,
        action,
        resourceType,
        resourceId: req.params?.id || '',
        ip: req.ip,
        success: res.statusCode < 400
      });
    } catch (e) {}
  });
  next();
};

module.exports = { protect, adminOnly, auditLog };
