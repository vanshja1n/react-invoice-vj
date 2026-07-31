import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  companyName: String,
  companyAddress: String,
  companyPhone: String,
  companyEmail: String,
  companyLogo: String,
  gstNumber: String,
  defaultTax: Number,
  defaultCurrency: String,
  defaultNotes: String,
  defaultTerms: String,
  defaultInvoiceTemplate: String,
  theme: String,
}, {
  timestamps: true,
});

export default mongoose.model('Settings', settingsSchema);
