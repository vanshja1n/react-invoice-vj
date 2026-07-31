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
  companyName: String,
  companyAddress: String,
  companyEmail: String,
  companyPhone: String,
  companyLogo: String,
  gstNumber: String,
  issueDate: String,
  dueDate: String,
  items: [{
    productId: mongoose.Schema.Types.Mixed,
    name: String,
    description: String,
    quantity: Number,
    unitPrice: Number,
    taxRate: Number,
    sku: String,
    discount: Number,
  }],
  subtotal: Number,
  taxAmount: Number,
  discountAmount: Number,
  total: Number,
  amount: Number,
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
