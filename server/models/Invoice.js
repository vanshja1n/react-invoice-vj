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
    price: Number, // Changed from unitPrice to match client schema
    tax: Number, // Changed from taxRate to match client schema
    sku: String,
    discount: Number,
    unit: String, // Added to match client schema
  }],
  subtotal: Number,
  taxAmount: Number,
  discountAmount: Number,
  shippingCharges: Number, // Added to match client schema
  total: Number,
  amount: Number, // Ensure consistency with total field
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
