import mongoose from 'mongoose';

const inventoryHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  productId: mongoose.Schema.Types.Mixed,
  productName: String,
  sku: String,
  action: String,
  previousStock: Number,
  quantityChanged: Number,
  newStock: Number,
  reference: String,
  createdAt: String,
}, {
  timestamps: false,
});

inventoryHistorySchema.index({ userId: 1, createdAt: -1 });
inventoryHistorySchema.index({ userId: 1, productId: 1 });
inventoryHistorySchema.index({ userId: 1, action: 1 });

export default mongoose.model('InventoryHistory', inventoryHistorySchema);
