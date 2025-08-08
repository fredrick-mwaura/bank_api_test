import mongoose from "mongoose";

export const VerificationShema = new mongoose.Schema({
  token: {
    type: String,
    maxlength: 255,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  type: {
    type: String,
    required: true,
    maxlength: 255
  },
  createdAt: {
    type: String,
    default: Date.now,
  }

})

export default mongoose.model('Verification', VerificationShema)