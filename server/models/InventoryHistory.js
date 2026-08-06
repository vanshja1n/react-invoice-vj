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
  updatedAt: String,   // added for incremental sync support
  deletedAt: String,   // soft-delete support
}, {
  timestamps: false,
});

inventoryHistorySchema.index({ userId: 1, createdAt: -1 });
inventoryHistorySchema.index({ userId: 1, productId: 1 });
inventoryHistorySchema.index({ userId: 1, action: 1 });
// Incremental sync: efficient range query by last-modified timestamp
inventoryHistorySchema.index({ userId: 1, updatedAt: 1 });

export default mongoose.model('InventoryHistory', inventoryHistorySchema);
