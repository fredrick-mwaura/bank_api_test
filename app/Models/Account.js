import mongoose from "mongoose";

const AccountSchema = new mongoose.Schema({
  
    accountNumber: {
      type: String,
      unique: true,
      required: true,
    },
    accountType: {
      type: String,
      enum: ['checking', 'savings', 'business'],
      required: true,
    },
    balance:{
      type: Number,
      default: 0,
      min: 0,
      required: true
    },
    currency: {
      type: String,
      default: 'KES'
    },
    status: {
      type: String,
      enum: ["active", "inactive", "frozen"],
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
  },
  {
    timestamps: true  
  },
)

export default mongoose.model("Account", AccountSchema)