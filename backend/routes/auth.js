const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { protect, adminOnly } = require('../middleware/auth');
const router = express.Router();

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: 'Username and password required' });
    const user = await User.findOne({ username: username.toLowerCase() }).select('+password');
    if (!user || !user.isActive || !(await user.comparePassword(password))) {
      await AuditLog.create({ username, action: 'LOGIN_FAILED', ip: req.ip, success: false });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save();
    await AuditLog.create({ user: user._id, username: user.username, action: 'LOGIN', ip: req.ip, success: true });
    const token = signToken(user._id);
    res.json({ success: true, token, user: { id: user._id, name: user.name, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', protect, async (req, res) => {
  try {
    await AuditLog.create({ user: req.user._id, username: req.user.username, action: 'LOGOUT', ip: req.ip, success: true });
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ success: true, user: { id: req.user._id, name: req.user.name, username: req.user.username, role: req.user.role } });
});

// POST /api/auth/change-password
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Both passwords required' });
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'Current password incorrect' });
    user.password = newPassword;
    await user.save();
    await AuditLog.create({ user: user._id, username: user.username, action: 'PASSWORD_CHANGE', ip: req.ip, success: true });
    res.json({ success: true, message: 'Password changed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/users (admin only - create user)
router.post('/users', protect, adminOnly, async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    const user = await User.create({ name, username, password, role });
    await AuditLog.create({ user: req.user._id, username: req.user.username, action: 'USER_CREATE', resourceType: 'User', resourceId: user._id.toString(), ip: req.ip, success: true });
    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/auth/users (admin only)
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
