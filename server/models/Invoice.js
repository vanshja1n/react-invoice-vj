import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  invoiceNumber: String,
  status: String,
  clientName: String,
  clientEmail: String,
  clientPhone: String,
  clientAddress: String,
  billingAddress: String, // Added to match client schema
  shippingAddress: String, // Added to match client schema
  companyName: String,
  companyAddress: String,
  companyEmail: String,
  companyPhone: String,
  companyLogo: String,
  gstNumber: String, // Keep original for backward compatibility
  companyGst: String, // Added to match client schema
  clientGst: String, // Added to match client schema
  issueDate: String,
  dueDate: String,
  items: [{
    productId: mongoose.Schema.Types.Mixed,
    name: String,
    description: String,
    quantity: Number,
    price: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    sku: String,
    discount: { type: Number, default: 0 },
    unit: { type: String, default: 'pcs' },
  }],
  subtotal: Number,          // lowercase — original Mongoose field
  subTotal: Number,          // camelCase — canonical client field (alias)
  taxAmount: Number,
  discountAmount: Number,
  shippingCharges: Number,
  total: Number,
  amount: Number,            // alias kept for backward compat
  grandTotal: Number,        // alias used by PDF templates
  taxRate: Number,
  discountRate: Number,
  customerId: mongoose.Schema.Types.Mixed,
  currency: String,
  template: String,
  notes: String,
  terms: String,
  paidAt: String,
  signature: String,
  createdAt: String,
  updatedAt: String,
}, {
  timestamps: false,
});

invoiceSchema.index({ userId: 1, createdAt: -1 });
invoiceSchema.index({ userId: 1, invoiceNumber: 1 });
invoiceSchema.index({ userId: 1, status: 1 });

export default mongoose.model('Invoice', invoiceSchema);
