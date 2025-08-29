import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    enum: ["superadmin", "admin"],
    default: "admin"
  },
  active: {
    type: Boolean,
    default: true
  }
},{
  timestamps: true
})

export default mongoose.model("Admin", AdminSchema)