import mongoose from "mongoose";

const PermissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    default: ''
  }
})

const permissions = mongoose.models('permissions', PermissionSchema)

export default permissions;