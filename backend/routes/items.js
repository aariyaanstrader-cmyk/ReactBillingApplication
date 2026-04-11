const express = require('express');
const ItemMaster = require('../models/ItemMaster');
const { protect, adminOnly } = require('../middleware/auth');
const router = express.Router();

// GET /api/items - list all active items
router.get('/', protect, async (req, res) => {
  try {
    const { metal, category, search } = req.query;
    const filter = { isActive: true };
    if (metal) filter.metal = metal;
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { itemType: { $regex: search, $options: 'i' } },
        { metal: { $regex: search, $options: 'i' } },
      ];
    }
    const items = await ItemMaster.find(filter).sort({ metal: 1, category: 1, sortOrder: 1, displayName: 1 });
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/items/tree - grouped hierarchy for bill UI picker
router.get('/tree', protect, async (req, res) => {
  try {
    const items = await ItemMaster.find({ isActive: true }).sort({ sortOrder: 1, displayName: 1 });
    const tree = {};
    items.forEach(item => {
      if (!tree[item.metal]) tree[item.metal] = {};
      if (!tree[item.metal][item.category]) tree[item.metal][item.category] = {};
      if (!tree[item.metal][item.category][item.itemType]) tree[item.metal][item.category][item.itemType] = [];
      tree[item.metal][item.category][item.itemType].push({
        _id: item._id, displayName: item.displayName, subType: item.subType,
        hsnCode: item.hsnCode, defaultUnit: item.defaultUnit,
        hasStoneWeight: item.hasStoneWeight, hasMakingCharge: item.hasMakingCharge,
        hasWastage: item.hasWastage, hasVatGrams: item.hasVatGrams
      });
    });
    res.json({ success: true, tree });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/items (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const item = await ItemMaster.create(req.body);
    res.status(201).json({ success: true, item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/items/:id (admin only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const item = await ItemMaster.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
