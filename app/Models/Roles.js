import mongoose from "mongoose";

const RolesSchema = new mongoose.Schema({
  name:{
    type: String,
    required: true,
    unique: true,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user'
  },
  Permissions: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'permissions',
    // default: ""
  }
})

const Role = mongoose.model('roles', RolesSchema)

export default Role;