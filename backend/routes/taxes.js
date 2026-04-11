const express = require('express');
const TaxConfig = require('../models/TaxConfig');
const { protect, adminOnly } = require('../middleware/auth');
const router = express.Router();

// GET /api/taxes - list all FY configs
router.get('/', protect, async (req, res) => {
  try {
    const configs = await TaxConfig.find().sort({ fy: -1 });
    res.json({ success: true, configs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/taxes/active - get current active FY config
router.get('/active', protect, async (req, res) => {
  try {
    const config = await TaxConfig.findOne({ isActive: true });
    if (!config) return res.status(404).json({ success: false, message: 'No active tax config found' });
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/taxes/:fy - get config for specific FY
router.get('/:fy', protect, async (req, res) => {
  try {
    const config = await TaxConfig.findOne({ fy: req.params.fy });
    if (!config) return res.status(404).json({ success: false, message: 'Tax config not found for this FY' });
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/taxes (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { fy, taxes } = req.body;
    if (!fy || !taxes) return res.status(400).json({ success: false, message: 'fy and taxes are required' });
    const config = await TaxConfig.create({ fy, taxes, createdBy: req.user._id });
    res.status(201).json({ success: true, config });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/taxes/:fy (admin only)
router.put('/:fy', protect, adminOnly, async (req, res) => {
  try {
    const config = await TaxConfig.findOneAndUpdate(
      { fy: req.params.fy }, req.body, { new: true, runValidators: true }
    );
    if (!config) return res.status(404).json({ success: false, message: 'Tax config not found' });
    res.json({ success: true, config });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
