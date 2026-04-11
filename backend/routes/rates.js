const express = require('express');
const https   = require('https');
const DailyRate      = require('../models/DailyRate');
const GoldMarketRate = require('../models/GoldMarketRate');
const AuditLog       = require('../models/AuditLog');
const { protect }    = require('../middleware/auth');
const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getIST() {
  const ist = new Date(Date.now() + 5.5 * 3600000);
  const iso = ist.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 19) };
}

function yesterday() {
  const { date } = getIST();
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Previous complete Mon–Sun week range */
function prevWeekRange() {
  const { date } = getIST();
  const today = new Date(date);
  const dow = today.getDay(); // 0=Sun…6=Sat
  const daysToMon = dow === 0 ? 6 : dow - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysToMon);
  const prevMon = new Date(thisMonday);
  prevMon.setDate(thisMonday.getDate() - 7);
  const prevSun = new Date(prevMon);
  prevSun.setDate(prevMon.getDate() + 6);
  return {
    from: prevMon.toISOString().slice(0, 10),
    to:   prevSun.toISOString().slice(0, 10),
  };
}

function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'GoldBillingApp/1.0', ...headers },
    }, (r) => {
      let data = '';
      r.on('data', chunk => data += chunk);
      r.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON from ' + url)); }
      });
    }).on('error', reject);
  });
}

// ── GoldPriceZ Poller ─────────────────────────────────────────────────────────

async function fetchAndStoreMarketRate() {
  const apiKey = process.env.GOLDPRICEZ_API_KEY;
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
    console.warn('[GoldPriceZ] GOLDPRICEZ_API_KEY not set — skipping fetch');
    return null;
  }

  const data = await fetchJSON(
    'https://goldpricez.com/api/rates/currency/inr/measure/gram',
    { 'X-API-KEY': apiKey }
  );

  // Parse known field names — GoldPriceZ may use different keys
  const rate24k = data.grams_24k  ?? data['24k']     ?? data.gram_24k  ??
                  data.rate_24k   ?? data['XAU_24K']  ?? null;
  if (!rate24k) throw new Error('Cannot parse 24K rate from GoldPriceZ response: ' + JSON.stringify(data));

  const rate22k = data.grams_22k  ?? data['22k']     ?? data.gram_22k  ??
                  data.rate_22k   ?? Math.round(rate24k * 22 / 24);

  const { date, time } = getIST();
  const doc = await GoldMarketRate.create({
    dateIST:   date,
    timeIST:   time,
    rate24k:   Math.round(rate24k),
    rate22k:   Math.round(rate22k),
    todayHigh: data.high  ?? data.today_high ?? null,
    todayLow:  data.low   ?? data.today_low  ?? null,
    askPrice:  data.ask   ?? data.ask_price  ?? null,
    bidPrice:  data.bid   ?? data.bid_price  ?? null,
    source:    'API',
  });
  console.log(`[GoldPriceZ] Stored: 24K=₹${doc.rate24k} 22K=₹${doc.rate22k} @ ${date} ${time}`);
  return doc;
}

let _pollingTimer = null;

function startMarketPolling() {
  if (_pollingTimer) return; // already started
  // Immediate first fetch, then every 5 minutes
  fetchAndStoreMarketRate().catch(err =>
    console.error('[GoldPriceZ] Initial fetch failed:', err.message)
  );
  _pollingTimer = setInterval(() => {
    fetchAndStoreMarketRate().catch(err =>
      console.error('[GoldPriceZ] Poll failed:', err.message)
    );
  }, 5 * 60 * 1000);
  console.log('[GoldPriceZ] Market polling started (every 5 min)');
}

// ── Market rate endpoints ─────────────────────────────────────────────────────

// GET /api/rates/market/latest
router.get('/market/latest', protect, async (req, res) => {
  try {
    const latest = await GoldMarketRate.findOne().sort({ dateIST: -1, timeIST: -1 });
    res.json({ success: true, rate: latest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rates/market/today — today high/low/open/current
router.get('/market/today', protect, async (req, res) => {
  try {
    const { date } = getIST();
    const rows = await GoldMarketRate.find({ dateIST: date }).sort({ timeIST: 1 });
    if (!rows.length) return res.json({ success: true, date, data: null });
    const rates24 = rows.map(r => r.rate24k);
    const rates22 = rows.map(r => r.rate22k);
    res.json({
      success: true,
      date,
      data: {
        open24k:    rows[0].rate24k,
        current24k: rows[rows.length - 1].rate24k,
        high24k:    Math.max(...rates24),
        low24k:     Math.min(...rates24),
        open22k:    rows[0].rate22k,
        current22k: rows[rows.length - 1].rate22k,
        high22k:    Math.max(...rates22),
        low22k:     Math.min(...rates22),
        askPrice:   rows[rows.length - 1].askPrice,
        bidPrice:   rows[rows.length - 1].bidPrice,
        lastUpdated: rows[rows.length - 1].timeIST,
        records:    rows.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rates/market/yesterday — OHLC for yesterday
router.get('/market/yesterday', protect, async (req, res) => {
  try {
    const yest = yesterday();
    const rows  = await GoldMarketRate.find({ dateIST: yest }).sort({ timeIST: 1 });
    if (!rows.length) return res.json({ success: true, date: yest, data: null });
    const rates24 = rows.map(r => r.rate24k);
    const rates22 = rows.map(r => r.rate22k);
    res.json({
      success: true,
      date: yest,
      data: {
        open24k:  rows[0].rate24k,
        high24k:  Math.max(...rates24),
        low24k:   Math.min(...rates24),
        close24k: rows[rows.length - 1].rate24k,
        open22k:  rows[0].rate22k,
        high22k:  Math.max(...rates22),
        low22k:   Math.min(...rates22),
        close22k: rows[rows.length - 1].rate22k,
        records:  rows.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rates/market/week — previous complete Mon–Sun week
router.get('/market/week', protect, async (req, res) => {
  try {
    const { from, to } = prevWeekRange();
    const rows = await GoldMarketRate.find({ dateIST: { $gte: from, $lte: to } });
    if (!rows.length) return res.json({ success: true, from, to, data: null });
    const rates24 = rows.map(r => r.rate24k);
    const rates22 = rows.map(r => r.rate22k);
    res.json({
      success: true,
      from, to,
      data: {
        high24k: Math.max(...rates24),
        low24k:  Math.min(...rates24),
        high22k: Math.max(...rates22),
        low22k:  Math.min(...rates22),
        records: rows.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rates/market/history?days=7 — per-day aggregated market data
router.get('/market/history', protect, async (req, res) => {
  try {
    const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 7));
    const cutoff = new Date(Date.now() - days * 86400000);
    const rows = await GoldMarketRate.find({ createdAt: { $gte: cutoff } }).sort({ dateIST: 1, timeIST: 1 });
    // Group by dateIST (rows already sorted by time within each day)
    const byDate = {};
    rows.forEach(r => {
      if (!byDate[r.dateIST]) byDate[r.dateIST] = [];
      byDate[r.dateIST].push(r);
    });
    const history = Object.entries(byDate).map(([date, pts]) => {
      const r24 = pts.map(p => p.rate24k);
      const r22 = pts.map(p => p.rate22k);
      return {
        date,
        open24k:  pts[0].rate24k,
        high24k:  Math.max(...r24),
        low24k:   Math.min(...r24),
        close24k: pts[pts.length - 1].rate24k,
        avg24k:   Math.round(r24.reduce((s, v) => s + v, 0) / r24.length),
        open22k:  pts[0].rate22k,
        high22k:  Math.max(...r22),
        low22k:   Math.min(...r22),
        close22k: pts[pts.length - 1].rate22k,
        records:  pts.length,
      };
    });
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rates/market/fetch — manual trigger (admin only)
router.post('/market/fetch', protect, async (req, res) => {
  try {
    const doc = await fetchAndStoreMarketRate();
    if (!doc) return res.status(503).json({ success: false, message: 'GOLDPRICEZ_API_KEY not configured' });
    res.json({ success: true, rate: doc });
  } catch (err) {
    res.status(502).json({ success: false, message: 'Fetch failed: ' + err.message });
  }
});

// ── Existing rate endpoints ───────────────────────────────────────────────────

// POST /api/rates
router.post('/', protect, async (req, res) => {
  try {
    const { date, goldRate, gold24K, silverRate, notes } = req.body;
    if (!goldRate) return res.status(400).json({ success: false, message: 'goldRate is required' });
    const rateDate = date || new Date().toISOString().split('T')[0];
    const rate = await DailyRate.findOneAndUpdate(
      { date: rateDate },
      { date: rateDate, goldRate, gold24K, silverRate, notes, setBy: req.user._id },
      { upsert: true, new: true, runValidators: true }
    );
    await AuditLog.create({ user: req.user._id, username: req.user.username, action: 'RATE_SET', resourceType: 'DailyRate', resourceId: rate._id.toString(), details: { goldRate, date: rateDate }, ip: req.ip, success: true });
    res.json({ success: true, rate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rates/today
router.get('/today', protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const rate = await DailyRate.findOne({ date: today }).populate('setBy', 'name username');
    res.json({ success: true, rate, hasRate: !!rate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rates/live — indicative international spot (kept for legacy / fallback)
router.get('/live', protect, async (req, res) => {
  try {
    const goldData = await fetchJSON('https://api.gold-api.com/price/XAU');
    if (!goldData?.price) throw new Error('Could not fetch gold price');
    const fxData = await fetchJSON('https://open.er-api.com/v6/latest/USD');
    if (!fxData?.rates?.INR) throw new Error('Could not fetch exchange rate');
    const gold24K = fxData.rates.INR * goldData.price / 31.1035;
    const gold22K = gold24K * (22 / 24);
    res.json({
      success: true,
      gold22K: Math.round(gold22K),
      gold24K: Math.round(gold24K),
      silverRate: null,
      source: 'international-spot',
      note: 'Indicative international spot price. Adjust to local IBJA/MCX rate before saving.',
    });
  } catch (err) {
    res.status(502).json({ success: false, message: 'Could not fetch live rate: ' + err.message });
  }
});

// GET /api/rates?from=&to=
router.get('/', protect, async (req, res) => {
  try {
    const { from, to, limit = 30 } = req.query;
    const filter = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to)   filter.date.$lte = to;
    }
    const rates = await DailyRate.find(filter).sort({ date: -1 }).limit(Number(limit)).populate('setBy', 'name username');
    res.json({ success: true, rates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rates/:date  (MUST stay last to avoid shadowing named routes above)
router.get('/:date', protect, async (req, res) => {
  try {
    const rate = await DailyRate.findOne({ date: req.params.date }).populate('setBy', 'name username');
    if (!rate) return res.status(404).json({ success: false, message: 'Rate not found for this date' });
    res.json({ success: true, rate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.startMarketPolling = startMarketPolling;
