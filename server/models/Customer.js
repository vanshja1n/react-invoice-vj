import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
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
  email: String,
  phone: String,
  address: String,
  gstNumber: String,
  company: String,
  notes: String, // Added for customer notes
  createdAt: String,
  updatedAt: String,
  deletedAt: String,   // soft-delete support for incremental sync
}, {
  timestamps: false,
});

customerSchema.index({ userId: 1, createdAt: -1 });
customerSchema.index({ userId: 1, email: 1 }, { sparse: true });
// Incremental sync: efficient range query by last-modified timestamp
customerSchema.index({ userId: 1, updatedAt: 1 });

export default mongoose.model('Customer', customerSchema);
