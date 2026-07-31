import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId;
    },
  },
  name: {
    type: String,
    trim: true,
  },
  googleId: {
    type: String,
    sparse: true,
  },
  avatar: {
    type: String,
  },
}, {
  timestamps: true,
});

export default mongoose.model('User', userSchema);
