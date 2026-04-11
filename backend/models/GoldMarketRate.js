const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  dateIST:   { type: String, required: true }, // YYYY-MM-DD (IST)
  timeIST:   { type: String, required: true }, // HH:MM:SS   (IST)
  rate24k:   { type: Number, required: true }, // ₹/gram 24K
  rate22k:   { type: Number, required: true }, // ₹/gram 22K
  todayHigh: { type: Number },
  todayLow:  { type: Number },
  askPrice:  { type: Number },
  bidPrice:  { type: Number },
  source:    { type: String, default: 'API' }, // 'API' | 'FALLBACK'
}, { timestamps: true });

schema.index({ dateIST: 1, createdAt: -1 });

module.exports = mongoose.model('GoldMarketRate', schema);
