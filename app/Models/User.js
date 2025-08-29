import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email:{
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    unique: true,
    minlength: 6,
  },
  isEmailVerified: {
    type: String,
    enum: ["true", "false"],
    default: "false"
  },
  emailVerificationToken: {
    type: String,
    default: null,
  },
  emailVerificationExpires: {
    type: Date,
    default: null,
  },
  emailVerifiedAt: {
    type: Date,
    default: null
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  snn: {
    encrypted: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true }
  },

  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  accountType: {
    type: String,
    enum: ['checking', 'savings', 'business'],
    // required: true
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'KES'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'frozen'],
    default: 'active',
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // required: true
  },
  dailyTransactionLimit: {
    type: Number,
    default: 500000,
  },
  role: {
    type: String,
    enum: 'user',
  }
},
{
  timestamps: true
})

export default mongoose.model('users', userSchema)