const mongoose = require('mongoose');
const dailyRateSchema = new mongoose.Schema({
  date: { type: String, required: true },
  goldRate: { type: Number, required: true, min: 0 },
  gold24K: { type: Number, min: 0 },
  silverRate: { type: Number, min: 0 },
  setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, trim: true }
}, { timestamps: true });
dailyRateSchema.index({ date: 1 }, { unique: true });
module.exports = mongoose.model('DailyRate', dailyRateSchema);
