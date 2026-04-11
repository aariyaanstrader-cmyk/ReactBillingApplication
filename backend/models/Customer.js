const mongoose = require('mongoose');
const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  totalBills: { type: Number, default: 0 },
  totalValue: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
customerSchema.index({ phone: 1 });
customerSchema.index({ name: 'text' });
module.exports = mongoose.model('Customer', customerSchema);
