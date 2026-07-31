import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  sku: String,
  category: String,
  description: String,
  image: String,
  costPrice: Number,
  sellingPrice: Number,
  currentStock: Number,
  lowStockAlert: Number,
  unit: String,
  taxRate: Number,
  hsnCode: String,
  createdAt: String,
  updatedAt: String,
}, {
  timestamps: false,
});

productSchema.index({ userId: 1, createdAt: -1 });
productSchema.index({ userId: 1, category: 1 });
productSchema.index({ userId: 1, sku: 1 }, { sparse: true });

export default mongoose.model('Product', productSchema);
