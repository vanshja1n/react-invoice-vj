import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  plan: {
    type: String,
    enum: ['free', 'premium'],
    default: 'free',
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'pending'],
    default: 'active',
  },
  subscriptionId: String,
  paymentProvider: String,
  startsAt: Date,
  endsAt: Date,
  canceledAt: Date,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
}, {
  timestamps: true,
});

export default mongoose.model('Subscription', subscriptionSchema);
