import mongoose from "mongoose";

const DeviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  identifier: {
    type: String,
    required: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  email: {
    type: String,
  },
  deviceId: {
    type: String,
    required: true
  },
  pushToken:{
    type: String,
  },
  lastUsed: {
    type: Date
  }

},{
  timestamps: true
})

export default mongoose.model("device", DeviceSchema)
