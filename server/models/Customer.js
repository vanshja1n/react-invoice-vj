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
  createdAt: String,
  updatedAt: String,
}, {
  timestamps: false,
});

customerSchema.index({ userId: 1, createdAt: -1 });
customerSchema.index({ userId: 1, email: 1 }, { sparse: true });

export default mongoose.model('Customer', customerSchema);
