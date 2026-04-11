// Bulk data import for Customers and Orders
// File parsing happens client-side (xlsx in browser); this endpoint receives JSON rows.
const express = require('express');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const DailyRate = require('../models/DailyRate');
const AuditLog = require('../models/AuditLog');
const { protect, adminOnly } = require('../middleware/auth');
const router = express.Router();

const MAX_ROWS = 2000;

// ─── helpers ────────────────────────────────────────────────
const cleanStr = (v) => (v == null ? '' : String(v).trim());
const cleanNum = (v) => {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const normPhone = (v) => cleanStr(v).replace(/[\s\-()]/g, '');
const parseDate = (v) => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  // Excel sometimes parses as JS Date string; also accept dd/mm/yyyy
  const s = String(v).trim();
  // dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
};
const getCurrentFY = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 4 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
};
const fyForDate = (d) => {
  const dt = new Date(d);
  const year = dt.getFullYear();
  const month = dt.getMonth() + 1;
  return month >= 4 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
};
const generateBillNo = async (fy, offset = 0) => {
  const prefix = 'INV';
  const fyShort = fy.replace('-', '');
  const lastOrder = await Order.findOne({ fy }).sort({ createdAt: -1 }).select('billNo');
  let seq = 1 + offset;
  if (lastOrder && lastOrder.billNo) {
    const match = lastOrder.billNo.match(/-(\d+)$/);
    if (match) seq = parseInt(match[1]) + 1 + offset;
  }
  return `${prefix}-${fyShort}-${String(seq).padStart(4, '0')}`;
};

// ─── POST /api/data-load/customers ──────────────────────────
// Body: { rows: [{name, phone, address}, ...], dryRun: bool }
router.post('/customers', protect, adminOnly, async (req, res) => {
  try {
    const { rows = [], dryRun = true } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ success: false, message: 'No rows provided' });
    if (rows.length > MAX_ROWS)
      return res.status(400).json({ success: false, message: `Too many rows. Max ${MAX_ROWS} per upload.` });

    const results = {
      total: rows.length,
      created: 0,
      duplicatesInFile: 0,
      duplicatesInDb: 0,
      errors: 0,
      details: [],   // per-row outcome
      sample: [],    // first 50 created customer previews
    };

    // Detect duplicates within the uploaded file by name+phone
    const seenInFile = new Set();
    const validRows = [];

    rows.forEach((raw, idx) => {
      const rowNo = idx + 2; // header is row 1 in user-facing terms
      const name = cleanStr(raw.name || raw.Name || raw.NAME);
      const phone = normPhone(raw.phone || raw.Phone || raw.PHONE || raw.mobile || raw.Mobile);
      const address = cleanStr(raw.address || raw.Address || raw.ADDRESS);

      if (!name) {
        results.errors++;
        results.details.push({ row: rowNo, status: 'error', reason: 'Name is required', name, phone });
        return;
      }
      const key = `${name.toLowerCase()}|${phone}`;
      if (seenInFile.has(key)) {
        results.duplicatesInFile++;
        results.details.push({ row: rowNo, status: 'duplicate-in-file', reason: 'Duplicate name+phone within uploaded file', name, phone });
        return;
      }
      seenInFile.add(key);
      validRows.push({ rowNo, name, phone, address });
    });

    // Check duplicates in DB by name+phone (Name+Phone combo per user choice)
    // Build OR query for batch lookup
    if (validRows.length) {
      const orQ = validRows.map(r => ({
        name: new RegExp('^' + r.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
        phone: r.phone || ''
      }));
      const existing = await Customer.find({ $or: orQ }).select('name phone');
      const existSet = new Set(existing.map(c => `${(c.name || '').toLowerCase()}|${normPhone(c.phone)}`));

      const toCreate = [];
      for (const r of validRows) {
        const key = `${r.name.toLowerCase()}|${r.phone}`;
        if (existSet.has(key)) {
          results.duplicatesInDb++;
          results.details.push({ row: r.rowNo, status: 'duplicate-in-db', reason: 'Already exists (name+phone match)', name: r.name, phone: r.phone });
        } else {
          toCreate.push(r);
        }
      }

      if (!dryRun && toCreate.length) {
        const created = await Customer.insertMany(
          toCreate.map(r => ({ name: r.name, phone: r.phone, address: r.address })),
          { ordered: false }
        );
        results.created = created.length;
        toCreate.forEach((r, i) => {
          results.details.push({ row: r.rowNo, status: 'created', name: r.name, phone: r.phone, _id: created[i]?._id });
        });
        results.sample = created.slice(0, 50).map(c => ({ _id: c._id, name: c.name, phone: c.phone, address: c.address }));
      } else {
        // dry-run: mark as 'will-create'
        toCreate.forEach(r => {
          results.details.push({ row: r.rowNo, status: 'will-create', name: r.name, phone: r.phone });
        });
        results.created = toCreate.length; // count what would be created
      }
    }

    if (!dryRun) {
      await AuditLog.create({
        user: req.user._id, username: req.user.username,
        action: 'DATA_IMPORT_CUSTOMERS', resourceType: 'Customer', resourceId: '',
        details: { total: results.total, created: results.created, dupFile: results.duplicatesInFile, dupDb: results.duplicatesInDb, errors: results.errors },
        ip: req.ip, success: true
      });
    }

    res.json({ success: true, dryRun, results });
  } catch (err) {
    console.error('Customer import error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/data-load/orders ─────────────────────────────
// Body: { rows: [...], dryRun: bool }
// Each row: { billNo?, billDate, customerName, customerPhone, customerAddress?,
//             itemName, metal, grossWeight, waste?, stoneValue?, makingCharge?,
//             qty?, goldRate?, paymentMode?, amountPaid?, discount?, notes? }
// Multiple rows with the same billNo are merged into a single multi-item order.
router.post('/orders', protect, adminOnly, async (req, res) => {
  try {
    const { rows = [], dryRun = true } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ success: false, message: 'No rows provided' });
    if (rows.length > MAX_ROWS)
      return res.status(400).json({ success: false, message: `Too many rows. Max ${MAX_ROWS} per upload.` });

    const todayRate = await DailyRate.findOne({ date: new Date().toISOString().split('T')[0] });
    const fallbackGold = todayRate?.goldRate || 0;
    const fallbackSilver = todayRate?.silverRate || 0;

    const results = {
      total: rows.length,
      ordersCreated: 0,
      itemsImported: 0,
      customersCreated: 0,
      errors: 0,
      details: [],
      sample: [],
    };

    // Group rows by virtual key: billNo (if given) else "AUTO-<rowIdx>"
    const groups = new Map();   // key -> { headerRow, items: [{rowNo, parsed}], errors: [] }
    rows.forEach((raw, idx) => {
      const rowNo = idx + 2;
      const billNo = cleanStr(raw.billNo || raw.BillNo || raw['Bill No'] || raw['bill no']);
      const customerName = cleanStr(raw.customerName || raw['Customer Name'] || raw['customer name'] || raw.name);
      const customerPhone = normPhone(raw.customerPhone || raw['Customer Phone'] || raw['customer phone'] || raw.phone);
      const customerAddress = cleanStr(raw.customerAddress || raw['Customer Address'] || raw['customer address'] || raw.address);
      const billDate = parseDate(raw.billDate || raw['Bill Date'] || raw['bill date'] || raw.date || raw.Date);
      const itemName = cleanStr(raw.itemName || raw['Item Name'] || raw['item name'] || raw.item || raw.Item);
      const metalRaw = cleanStr(raw.metal || raw.Metal).toLowerCase();
      const metal = metalRaw.startsWith('s') ? 'Silver' : 'Gold';
      const grossWeight = cleanNum(raw.grossWeight || raw['Gross Weight'] || raw['gross weight'] || raw.weight || raw.Weight);
      const waste = cleanNum(raw.waste || raw.Waste || raw.wastage || raw.Wastage);
      const stoneValue = cleanNum(raw.stoneValue || raw['Stone Value'] || raw['stone value'] || raw.stone || raw.Stone);
      const makingCharge = cleanNum(raw.makingCharge || raw['Making Charge'] || raw['making charge'] || raw.mc || raw.MC);
      const qty = cleanNum(raw.qty || raw.Qty || raw.quantity || raw.Quantity) || 1;
      const goldRate = cleanNum(raw.goldRate || raw['Gold Rate'] || raw['gold rate'] || raw.rate || raw.Rate);
      const paymentMode = (cleanStr(raw.paymentMode || raw['Payment Mode'] || raw['payment mode']) || 'cash').toLowerCase();
      const amountPaid = cleanNum(raw.amountPaid || raw['Amount Paid'] || raw['amount paid'] || raw.paid || raw.Paid);
      const discount = cleanNum(raw.discount || raw.Discount);
      const notes = cleanStr(raw.notes || raw.Notes);

      const rowErrors = [];
      if (!customerName) rowErrors.push('Customer name missing');
      if (!itemName) rowErrors.push('Item name missing');
      if (grossWeight <= 0) rowErrors.push('Gross weight must be > 0');

      const groupKey = billNo || `__AUTO_${idx}`;
      if (!groups.has(groupKey)) groups.set(groupKey, { billNo: billNo || '', items: [], errors: [], header: null });
      const g = groups.get(groupKey);
      // First row in the group sets header info
      if (!g.header) g.header = { customerName, customerPhone, customerAddress, billDate, paymentMode, amountPaid, discount, notes, goldRate };

      g.items.push({
        rowNo, itemName, metal, grossWeight, waste, stoneValue, makingCharge, qty, goldRate, errors: rowErrors
      });
      if (rowErrors.length) g.errors.push({ rowNo, reasons: rowErrors });
    });

    // Process each group
    let billNoOffset = 0;
    for (const [key, g] of groups) {
      const firstRow = g.items[0]?.rowNo || '?';
      if (g.errors.length) {
        results.errors += g.errors.length;
        g.errors.forEach(e => results.details.push({ row: e.rowNo, status: 'error', reason: e.reasons.join('; ') }));
        continue;
      }
      const h = g.header;

      try {
        // Find / create customer (Name + Phone combo)
        let customer = null;
        if (h.customerName) {
          const nameRe = new RegExp('^' + h.customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
          customer = await Customer.findOne({ name: nameRe, phone: h.customerPhone || '' });
          if (!customer) {
            if (!dryRun) {
              customer = await Customer.create({ name: h.customerName, phone: h.customerPhone, address: h.customerAddress });
              results.customersCreated++;
            }
          }
        }

        // Build items and totals
        let goldValueTotal = 0, makingChargesTotal = 0, stoneValueTotal = 0;
        const processedItems = g.items.map(it => {
          const rate = it.goldRate || h.goldRate || (it.metal === 'Silver' ? fallbackSilver : fallbackGold);
          const chargeable = it.grossWeight + it.waste;
          const metalValue = chargeable * rate;
          const lineMC = it.makingCharge;
          const lineStone = it.stoneValue;
          const lineQty = it.qty || 1;
          const goldVal = metalValue * lineQty;
          const stoneVal = lineStone * lineQty;
          const mcVal = lineMC * lineQty;
          const lineTotal = goldVal + mcVal + stoneVal;
          goldValueTotal += goldVal;
          stoneValueTotal += stoneVal;
          makingChargesTotal += mcVal;
          return {
            displayName: it.itemName,
            metal: it.metal,
            category: '',
            hsnCode: '',
            grossWeight: it.grossWeight,
            waste: it.waste,
            stoneWeight: 0,
            netWeight: it.grossWeight,
            goldRate: rate,
            goldValue: goldVal,
            makingCharge: lineMC,
            makingChargeWaived: false,
            stoneValue: stoneVal,
            lineTotal,
            qty: lineQty,
            notes: ''
          };
        });

        const subTotal = goldValueTotal + makingChargesTotal + stoneValueTotal;
        const discountAmt = h.discount || 0;
        const grandTotal = subTotal - discountAmt;
        const netPayable = grandTotal;
        const amtPaid = h.amountPaid || 0;

        const useFY = fyForDate(h.billDate);
        const finalBillNo = g.billNo || (await generateBillNo(useFY, billNoOffset));
        if (!g.billNo) billNoOffset++;

        if (!dryRun) {
          // Conflict check on billNo
          if (g.billNo) {
            const exists = await Order.findOne({ billNo: finalBillNo }).select('_id');
            if (exists) {
              results.errors++;
              results.details.push({ row: firstRow, status: 'error', reason: `Bill No ${finalBillNo} already exists`, billNo: finalBillNo });
              continue;
            }
          }
          const order = await Order.create({
            billNo: finalBillNo,
            billDate: h.billDate,
            fy: useFY,
            billType: 'ornaments',
            customer: { ref: customer?._id || null, name: h.customerName, phone: h.customerPhone, address: h.customerAddress },
            goldRate: processedItems[0]?.goldRate || fallbackGold,
            silverRate: fallbackSilver,
            items: processedItems,
            exchangeItems: [],
            goldValueTotal, stoneValueTotal,
            makingChargesTotal, makingChargesWaived: 0,
            gstOnGold: 0, gstOnGoldWaived: false,
            gstOnMakingCharges: 0, gstOnMakingChargesWaived: false,
            extraCharges: [], extraChargesTotal: 0, extraChargesWaived: 0,
            subTotal, discount: discountAmt, exchangeTotal: 0, totalTax: 0,
            grandTotal, netPayable,
            paymentMode: ['cash','card','upi','cheque','credit','mixed'].includes(h.paymentMode) ? h.paymentMode : 'cash',
            amountPaid: amtPaid,
            balanceDue: Math.max(0, netPayable - amtPaid),
            createdBy: req.user._id,
            notes: h.notes || 'Imported via Data Load',
            status: 'confirmed',
          });
          if (customer) {
            await Customer.findByIdAndUpdate(customer._id, { $inc: { totalBills: 1, totalValue: grandTotal } });
          }
          results.ordersCreated++;
          results.itemsImported += processedItems.length;
          if (results.sample.length < 50) {
            results.sample.push({ _id: order._id, billNo: order.billNo, customer: h.customerName, amount: grandTotal, items: processedItems.length });
          }
          g.items.forEach(it => results.details.push({ row: it.rowNo, status: 'created', billNo: finalBillNo, customer: h.customerName, amount: grandTotal }));
        } else {
          results.ordersCreated++;
          results.itemsImported += processedItems.length;
          g.items.forEach(it => results.details.push({ row: it.rowNo, status: 'will-create', billNo: finalBillNo, customer: h.customerName, amount: grandTotal }));
          if (results.sample.length < 50) {
            results.sample.push({ billNo: finalBillNo, customer: h.customerName, amount: grandTotal, items: processedItems.length });
          }
        }
      } catch (e) {
        results.errors++;
        results.details.push({ row: firstRow, status: 'error', reason: e.message });
      }
    }

    if (!dryRun) {
      await AuditLog.create({
        user: req.user._id, username: req.user.username,
        action: 'DATA_IMPORT_ORDERS', resourceType: 'Order', resourceId: '',
        details: { total: results.total, ordersCreated: results.ordersCreated, customersCreated: results.customersCreated, errors: results.errors },
        ip: req.ip, success: true
      });
    }

    res.json({ success: true, dryRun, results });
  } catch (err) {
    console.error('Order import error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
