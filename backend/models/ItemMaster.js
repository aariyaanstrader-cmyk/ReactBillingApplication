const mongoose = require('mongoose');
const itemMasterSchema = new mongoose.Schema({
  metal: { type: String, required: true, enum: ['Gold', 'Silver', 'Other'] },
  category: { type: String, required: true },
  itemType: { type: String, required: true },
  subType: { type: String, default: '' },
  displayName: { type: String, required: true },
  hsnCode: { type: String, default: '' },
  defaultUnit: { type: String, enum: ['grams', 'piece', 'set'], default: 'grams' },
  hasStoneWeight: { type: Boolean, default: false },
  hasMakingCharge: { type: Boolean, default: true },
  hasWastage: { type: Boolean, default: false },
  hasVatGrams: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });
itemMasterSchema.index({ metal: 1, category: 1, itemType: 1 });
itemMasterSchema.index({ displayName: 'text' });
module.exports = mongoose.model('ItemMaster', itemMasterSchema);
