const mongoose = require('mongoose');
const taxLineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rate: { type: Number, required: true, min: 0, max: 100 },
  isDefault: { type: Boolean, default: true },
  isOptional: { type: Boolean, default: false },
  applyOn: { type: String, enum: ['total', 'makingCharge', 'goldValue'], default: 'total' },
  description: { type: String, default: '' }
}, { _id: false });
const taxConfigSchema = new mongoose.Schema({
  fy: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  taxes: [taxLineSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
module.exports = mongoose.model('TaxConfig', taxConfigSchema);
