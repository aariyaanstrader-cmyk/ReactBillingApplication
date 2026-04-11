const express = require('express');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const DailyRate = require('../models/DailyRate');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');
const router = express.Router();

const generateBillNo = async (fy) => {
  const prefix = 'INV';
  const fyShort = fy.replace('-', '');
  const lastOrder = await Order.findOne({ fy }).sort({ createdAt: -1 }).select('billNo');
  let seq = 1;
  if (lastOrder && lastOrder.billNo) {
    const match = lastOrder.billNo.match(/-(\d+)$/);
    if (match) seq = parseInt(match[1]) + 1;
  }
  return `${prefix}-${fyShort}-${String(seq).padStart(4, '0')}`;
};

const getCurrentFY = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 4 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
};

// ── Shared: process items + calculate totals
function processOrder(items, exchangeItems, extraCharges, billingRate, silverBillingRate, discount) {
  let goldValueTotal = 0, makingChargesTotal = 0, makingChargesWaived = 0, stoneValueTotal = 0;

  const processedItems = items.map(item => {
    const metal = item.metal || 'Gold';
    const rate = metal === 'Silver' ? silverBillingRate : billingRate;
    const gw = Number(item.grossWeight) || 0;
    const waste = Number(item.waste) || 0;
    const chargeableWeight = gw + waste; // waste grams add to weight for metal value
    const netWeight = gw; // Stone is rupees-only, no weight deduction
    const metalValue = chargeableWeight * rate;
    const mc = Number(item.makingCharge) || 0;
    const mcWaived = item.makingChargeWaived === true;
    const activeMC = mcWaived ? 0 : mc;
    const sv = Number(item.stoneValue) || 0;
    const qty = Number(item.qty) || 1;
    const lineTotal = (metalValue + activeMC + sv) * qty;
    goldValueTotal += metalValue * qty;
    stoneValueTotal += sv * qty;
    if (mcWaived) makingChargesWaived += mc * qty;
    else makingChargesTotal += mc * qty;
    return { ...item, metal, waste, netWeight, goldRate: rate, goldValue: metalValue * qty, makingCharge: mc, makingChargeWaived: mcWaived, stoneValue: sv * qty, lineTotal, qty };
  });

  let exchangeTotal = 0;
  if (exchangeItems?.length) exchangeItems.forEach(ex => { exchangeTotal += Number(ex.exchangeValue) || 0; });

  const totalTax = 0;

  let extraChargesTotal = 0, extraChargesWaived = 0;
  const processedExtras = (extraCharges || []).map(ec => {
    const amt = Number(ec.amount) || 0;
    if (ec.waived) extraChargesWaived += amt;
    else extraChargesTotal += amt;
    return { name: ec.name, amount: amt, waived: ec.waived === true };
  });

  const discountAmt = Number(discount) || 0;
  const subTotal = goldValueTotal + makingChargesTotal + stoneValueTotal;
  const grandTotal = subTotal + totalTax + extraChargesTotal - discountAmt;
  const netPayable = grandTotal - exchangeTotal;

  return { processedItems, goldValueTotal, stoneValueTotal, makingChargesTotal, makingChargesWaived,
           totalTax, processedExtras, extraChargesTotal, extraChargesWaived,
           exchangeTotal, discountAmt, subTotal, grandTotal, netPayable };
}

// POST /api/orders - create new bill (status: confirmed or draft)
router.post('/', protect, async (req, res) => {
  try {
    const {
      customer, items, exchangeItems,
      discount, paymentMode, amountPaid, notes, billDate, fy,
      extraCharges = [],
      saveAsDraft = false,
    } = req.body;

    if (!customer || !items || items.length === 0)
      return res.status(400).json({ success: false, message: 'Customer and items are required' });

    const useFY = fy || getCurrentFY();
    const today = new Date().toISOString().split('T')[0];
    const rateDoc = await DailyRate.findOne({ date: today });
    if (!rateDoc)
      return res.status(400).json({ success: false, message: 'No billing rate set for today. Please set the 1gm rate first.' });

    const billingRate = rateDoc.goldRate;
    const silverBillingRate = rateDoc.silverRate || 0;

    const calc = processOrder(items, exchangeItems, extraCharges, billingRate, silverBillingRate, discount);
    const billNo = await generateBillNo(useFY);

    // ── Customer upsert
    let customerRef = null;
    if (customer.ref) {
      customerRef = customer.ref;
    } else if (customer.phone) {
      let existing = await Customer.findOne({ phone: customer.phone });
      if (!existing)
        existing = await Customer.create({ name: customer.name, phone: customer.phone, address: customer.address || '' });
      customerRef = existing._id;
    }
    if (customerRef && !saveAsDraft) {
      await Customer.findByIdAndUpdate(customerRef, { $inc: { totalBills: 1, totalValue: calc.grandTotal } });
    }

    const order = await Order.create({
      billNo,
      billDate: billDate || new Date(),
      fy: useFY,
      billType: req.body.billType || 'ornaments',
      customer: { ref: customerRef, name: customer.name, phone: customer.phone || '', address: customer.address || '' },
      goldRate: billingRate,
      silverRate: silverBillingRate,
      items: calc.processedItems,
      exchangeItems: exchangeItems || [],
      goldValueTotal: calc.goldValueTotal, stoneValueTotal: calc.stoneValueTotal,
      makingChargesTotal: calc.makingChargesTotal, makingChargesWaived: calc.makingChargesWaived,
      gstOnGold: 0, gstOnGoldWaived: false,
      gstOnMakingCharges: 0, gstOnMakingChargesWaived: false,
      extraCharges: calc.processedExtras,
      extraChargesTotal: calc.extraChargesTotal, extraChargesWaived: calc.extraChargesWaived,
      subTotal: calc.subTotal,
      discount: calc.discountAmt,
      exchangeTotal: calc.exchangeTotal,
      totalTax: calc.totalTax,
      grandTotal: calc.grandTotal,
      netPayable: calc.netPayable,
      paymentMode: paymentMode || 'cash',
      amountPaid: Number(amountPaid) || 0,
      balanceDue: calc.netPayable - (Number(amountPaid) || 0),
      createdBy: req.user._id,
      notes: notes || '',
      status: saveAsDraft ? 'draft' : 'confirmed',
    });

    await AuditLog.create({
      user: req.user._id, username: req.user.username,
      action: saveAsDraft ? 'BILL_DRAFT' : 'BILL_CREATE', resourceType: 'Order', resourceId: order._id.toString(),
      details: { billNo, grandTotal: calc.grandTotal }, ip: req.ip, success: true
    });

    res.status(201).json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orders/:id - update order (draft or confirmed)
router.put('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status === 'cancelled') return res.status(400).json({ success: false, message: 'Cancelled orders cannot be edited' });

    const {
      customer, items, exchangeItems,
      discount, paymentMode, amountPaid, notes,
      extraCharges = [],
      confirmBill = false,
    } = req.body;

    if (!customer || !items || items.length === 0)
      return res.status(400).json({ success: false, message: 'Customer and items are required' });

    const billingRate = order.goldRate;
    const silverBillingRate = order.silverRate || 0;

    const calc = processOrder(items, exchangeItems, extraCharges, billingRate, silverBillingRate, discount);

    // Update customer ref
    let customerRef = order.customer.ref;
    if (customer.ref) customerRef = customer.ref;
    else if (customer.phone) {
      let existing = await Customer.findOne({ phone: customer.phone });
      if (!existing)
        existing = await Customer.create({ name: customer.name, phone: customer.phone, address: customer.address || '' });
      customerRef = existing._id;
    }

    const wasDraft = order.status === 'draft';
    const wasConfirmed = order.status === 'confirmed';

    // If confirming a draft, update customer stats
    if (wasDraft && confirmBill && customerRef) {
      await Customer.findByIdAndUpdate(customerRef, { $inc: { totalBills: 1, totalValue: calc.grandTotal } });
    }
    // If editing a confirmed order, adjust customer totalValue for the difference
    if (wasConfirmed && customerRef) {
      const diff = calc.grandTotal - order.grandTotal;
      if (diff !== 0) await Customer.findByIdAndUpdate(customerRef, { $inc: { totalValue: diff } });
    }

    // Preserve total paid from existing payments when editing confirmed order
    const totalPaidFromPayments = (order.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    const newAmountPaid = wasConfirmed ? totalPaidFromPayments : (Number(amountPaid) || 0);

    // Determine new status
    let newStatus;
    if (wasConfirmed) newStatus = 'confirmed'; // confirmed stays confirmed
    else newStatus = confirmBill ? 'confirmed' : 'draft';

    Object.assign(order, {
      customer: { ref: customerRef, name: customer.name, phone: customer.phone || '', address: customer.address || '' },
      items: calc.processedItems,
      exchangeItems: exchangeItems || [],
      goldValueTotal: calc.goldValueTotal, stoneValueTotal: calc.stoneValueTotal,
      makingChargesTotal: calc.makingChargesTotal, makingChargesWaived: calc.makingChargesWaived,
      gstOnGold: 0, gstOnGoldWaived: false,
      gstOnMakingCharges: 0, gstOnMakingChargesWaived: false,
      extraCharges: calc.processedExtras,
      extraChargesTotal: calc.extraChargesTotal, extraChargesWaived: calc.extraChargesWaived,
      subTotal: calc.subTotal,
      discount: calc.discountAmt,
      exchangeTotal: calc.exchangeTotal,
      totalTax: calc.totalTax,
      grandTotal: calc.grandTotal,
      netPayable: calc.netPayable,
      paymentMode: wasConfirmed ? order.paymentMode : (paymentMode || 'cash'),
      amountPaid: newAmountPaid,
      balanceDue: calc.netPayable - newAmountPaid,
      notes: notes || '',
      status: newStatus,
    });

    await order.save();

    const action = wasConfirmed ? 'ORDER_EDIT' : (confirmBill ? 'BILL_CONFIRM' : 'BILL_DRAFT_UPDATE');
    await AuditLog.create({
      user: req.user._id, username: req.user.username,
      action, resourceType: 'Order', resourceId: order._id.toString(),
      details: { billNo: order.billNo, grandTotal: calc.grandTotal }, ip: req.ip, success: true
    });

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, fy, billType, from, to } = req.query;
    const filter = {};
    if (fy) filter.fy = fy;
    if (billType) filter.billType = billType;
    if (from || to) {
      filter.billDate = {};
      if (from) filter.billDate.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        if (!to.includes('T')) toDate.setHours(23, 59, 59, 999);
        filter.billDate.$lte = toDate;
      }
    }
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ billDate: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('createdBy', 'name username');
    res.json({ success: true, orders, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/customer/:customerId — all orders for a customer (MUST be before /:id)
router.get('/customer/:customerId', protect, async (req, res) => {
  try {
    const orders = await Order.find({ 'customer.ref': req.params.customerId })
      .sort({ billDate: -1 })
      .select('billNo billDate grandTotal netPayable amountPaid balanceDue status paymentMode items');
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/analytics/summary — MUST be before /:id
router.get('/analytics/summary', protect, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const baseFilter = { status: { $ne: 'cancelled' } };

    const [todayStats, weekStats, monthStats, yearStats, pendingPayments] = await Promise.all([
      Order.aggregate([
        { $match: { ...baseFilter, billDate: { $gte: todayStart } } },
        { $group: { _id: null, count: { $sum: 1 }, sales: { $sum: '$grandTotal' }, paid: { $sum: '$amountPaid' } } }
      ]),
      Order.aggregate([
        { $match: { ...baseFilter, billDate: { $gte: weekStart } } },
        { $group: { _id: null, count: { $sum: 1 }, sales: { $sum: '$grandTotal' }, paid: { $sum: '$amountPaid' } } }
      ]),
      Order.aggregate([
        { $match: { ...baseFilter, billDate: { $gte: monthStart } } },
        { $group: { _id: null, count: { $sum: 1 }, sales: { $sum: '$grandTotal' }, paid: { $sum: '$amountPaid' } } }
      ]),
      Order.aggregate([
        { $match: { ...baseFilter, billDate: { $gte: yearStart } } },
        { $group: { _id: null, count: { $sum: 1 }, sales: { $sum: '$grandTotal' }, paid: { $sum: '$amountPaid' } } }
      ]),
      Order.aggregate([
        { $match: { ...baseFilter, balanceDue: { $gt: 0 } } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$balanceDue' } } }
      ]),
    ]);

    const extract = (arr) => arr[0] || { count: 0, sales: 0, paid: 0 };

    const [recentBills, pendingOrders, todayBills, statusCounts] = await Promise.all([
      Order.find(baseFilter)
        .sort({ billDate: -1 })
        .limit(10)
        .select('billNo billDate customer.name customer.phone grandTotal balanceDue status amountPaid'),
      Order.find({ ...baseFilter, balanceDue: { $gt: 0 } })
        .sort({ balanceDue: -1 })
        .limit(50)
        .select('billNo billDate customer.name customer.phone grandTotal netPayable amountPaid balanceDue'),
      Order.find({ ...baseFilter, billDate: { $gte: todayStart } })
        .sort({ billDate: -1 })
        .select('billNo billDate customer.name customer.phone grandTotal balanceDue status amountPaid'),
      Order.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
    ]);

    const statusMap = {};
    statusCounts.forEach(s => { statusMap[s._id] = s.count; });

    res.json({
      success: true,
      today: extract(todayStats),
      week: extract(weekStats),
      month: extract(monthStats),
      year: extract(yearStats),
      pending: pendingPayments[0] || { count: 0, total: 0 },
      pendingOrders,
      todayBills,
      recentBills,
      statusBreakdown: {
        confirmed: statusMap.confirmed || 0,
        draft: statusMap.draft || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('createdBy', 'name username');
    if (!order) return res.status(404).json({ success: false, message: 'Bill not found' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orders/:id/cancel
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Bill not found' });
    if (order.status === 'cancelled') return res.status(400).json({ success: false, message: 'Bill already cancelled' });
    order.status = 'cancelled';
    await order.save();
    if (order.customer.ref) {
      await Customer.findByIdAndUpdate(order.customer.ref, { $inc: { totalBills: -1, totalValue: -order.grandTotal } });
    }
    await AuditLog.create({ user: req.user._id, username: req.user.username, action: 'BILL_CANCEL', resourceType: 'Order', resourceId: order._id.toString(), ip: req.ip, success: true });
    res.json({ success: true, message: 'Bill cancelled', order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orders/:id/payment — record a payment against a bill
router.put('/:id/payment', protect, async (req, res) => {
  try {
    const { amount, mode, notes } = req.body;
    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ success: false, message: 'Payment amount is required' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Bill not found' });
    if (order.status === 'cancelled') return res.status(400).json({ success: false, message: 'Cannot pay a cancelled bill' });

    const payAmt = Number(amount);
    order.payments.push({ amount: payAmt, mode: mode || 'cash', notes: notes || '', recordedBy: req.user._id, date: new Date() });
    order.amountPaid += payAmt;
    order.balanceDue = Math.max(0, order.netPayable - order.amountPaid);

    await order.save();

    await AuditLog.create({
      user: req.user._id, username: req.user.username,
      action: 'PAYMENT_RECORD', resourceType: 'Order', resourceId: order._id.toString(),
      details: { billNo: order.billNo, amount: payAmt, totalPaid: order.amountPaid, balanceDue: order.balanceDue },
      ip: req.ip, success: true
    });

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
