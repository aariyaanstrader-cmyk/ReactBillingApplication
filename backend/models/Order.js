const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
  itemRef: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemMaster' },
  displayName: { type: String, required: true },
  metal: { type: String }, category: { type: String },
  hsnCode: { type: String, default: '' },
  grossWeight: { type: Number, default: 0 },
  waste: { type: Number, default: 0 },               // grams added to weight for metal value calc
  stoneWeight: { type: Number, default: 0 },
  netWeight: { type: Number, default: 0 },
  metal: { type: String, enum: ['Gold', 'Silver'], default: 'Gold' },
  goldRate: { type: Number, required: true },
  goldValue: { type: Number, default: 0 },
  makingCharge: { type: Number, default: 0 },        // flat ₹ amount
  makingChargeWaived: { type: Boolean, default: false },
  stoneValue: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 },           // goldValue + active MC + stoneValue
  qty: { type: Number, default: 1 },
  notes: { type: String, default: '' }
}, { _id: true });

const exchangeItemSchema = new mongoose.Schema({
  description: { type: String, default: 'Old Gold' },
  metal: { type: String, enum: ['Gold','Silver'], default: 'Gold' },
  grossWeight: { type: Number, required: true },
  purity: { type: Number, default: 22 },
  exchangeRate: { type: Number, required: true },
  exchangeValue: { type: Number, required: true },
  notes: { type: String, default: '' }
}, { _id: true });

const extraChargeSchema = new mongoose.Schema({
  name: { type: String, required: true },    // 'Handling', 'Delivery', 'Travel', 'Quality Test'
  amount: { type: Number, default: 0 },
  waived: { type: Boolean, default: false }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  billNo: { type: String, required: true, unique: true },
  billDate: { type: Date, required: true, default: Date.now },
  fy: { type: String, required: true },
  billType: { type: String, default: 'ornaments' },
  customer: {
    ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '' }
  },
  goldRate: { type: Number, required: true },
  silverRate: { type: Number, default: 0 },

  items: [billItemSchema],
  exchangeItems: [exchangeItemSchema],

  // Charge totals (before waivers)
  goldValueTotal: { type: Number, default: 0 },
  stoneValueTotal: { type: Number, default: 0 },
  makingChargesTotal: { type: Number, default: 0 },     // gross making charges billed
  makingChargesWaived: { type: Number, default: 0 },    // amount waived

  // GST
  gstOnGold: { type: Number, default: 0 },              // 3% on gold value
  gstOnGoldWaived: { type: Boolean, default: false },
  gstOnMakingCharges: { type: Number, default: 0 },     // 5% on net making charges
  gstOnMakingChargesWaived: { type: Boolean, default: false },

  // Extra charges
  extraCharges: [extraChargeSchema],
  extraChargesTotal: { type: Number, default: 0 },      // sum of non-waived extras
  extraChargesWaived: { type: Number, default: 0 },     // sum of waived extras

  // Totals
  subTotal: { type: Number, default: 0 },               // goldValue + net MC + stone
  discount: { type: Number, default: 0 },
  exchangeTotal: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },               // gstOnGold + gstOnMC
  grandTotal: { type: Number, default: 0 },
  netPayable: { type: Number, default: 0 },

  paymentMode: { type: String, enum: ['cash','card','upi','cheque','credit','mixed'], default: 'cash' },
  amountPaid: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },

  payments: [{
    amount: { type: Number, required: true },
    mode: { type: String, enum: ['cash','card','upi','cheque','credit'], default: 'cash' },
    date: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['draft','confirmed','cancelled'], default: 'confirmed' }
}, { timestamps: true });

orderSchema.index({ billDate: -1 });
orderSchema.index({ 'customer.phone': 1 });
orderSchema.index({ 'customer.ref': 1 });
orderSchema.index({ fy: 1 });
orderSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Order', orderSchema);
