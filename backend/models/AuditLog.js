const mongoose = require('mongoose');
const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: { type: String },
  action: {
    type: String, required: true,
    enum: [
      'LOGIN','LOGOUT','LOGIN_FAILED',
      'BILL_CREATE','BILL_CANCEL','BILL_DRAFT','BILL_DRAFT_UPDATE','BILL_CONFIRM','ORDER_EDIT','PAYMENT_RECORD',
      'RATE_SET',
      'CUSTOMER_CREATE','CUSTOMER_UPDATE',
      'ITEM_CREATE','ITEM_UPDATE',
      'TAX_CONFIG_UPDATE',
      'USER_CREATE','USER_UPDATE','PASSWORD_CHANGE',
      'DATA_IMPORT_CUSTOMERS','DATA_IMPORT_ORDERS'
    ]
  },
  resourceType: { type: String, default: '' },
  resourceId: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String, default: '' },
  success: { type: Boolean, default: true }
}, { timestamps: true });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ user: 1 });
auditLogSchema.index({ action: 1 });
module.exports = mongoose.model('AuditLog', auditLogSchema);
