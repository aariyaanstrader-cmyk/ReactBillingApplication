const express = require('express');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/auth');
const router = express.Router();

// GET /api/customers?search=name
router.get('/', protect, async (req, res) => {
  try {
    const { search, limit = 20 } = req.query;
    const filter = { isActive: true };
    if (search) {
      const q = search.trim();
      if (/^\d+/.test(q)) {
        filter.phone = { $regex: q, $options: 'i' };
      } else {
        filter.name = { $regex: q, $options: 'i' };
      }
    }
    const customers = await Customer.find(filter).sort({ name: 1 }).limit(Number(limit));
    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/customers
router.post('/', protect, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const customer = await Customer.create({ name, phone, address });
    res.status(201).json({ success: true, customer });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/customers/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, customer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const customer = await Customer.findByIdAndUpdate(
      req.params.id, { name, phone, address }, { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, customer });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
