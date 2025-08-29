import mongoose from "mongoose";

const AdminLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
    index: true,
  },

  action: {
    type: String,
    required: true,
    index: true,
  },

  resource: {
    type: String,
    required: true,
    index: true,
  },

  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
  },

  category: {
    type: String,
    enum: [
      "authentication",
      "admin_action",
      "user_management",
      "system",
      "security",
      "compliance",
    ],
    required: true,
    index: true,
  },

  severity: {
    type: String,
    enum: ["info", "warning", "error", "critical"],
    default: "info",
    index: true,
  },

  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  ipAddress: {
    type: String,
    index: true,
  },

  userAgent: {
    type: String,
  },

  sessionId: {
    type: String,
    index: true,
  },
}, {
  timestamps: true,
});

export default mongoose.model("AdminLog", AdminLogSchema);