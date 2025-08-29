import mongoose from "mongoose";

const RolesSchema = new mongoose.Schema({
  name:{
    type: String,
    required: true,
    unique: true,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user'
  },
  description: {
    type: String,
    default: ''
  },
  Permissions: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'permissions',
    default: []
  }
})

const Role = mongoose.models('roles', RolesSchema)

export default Role;