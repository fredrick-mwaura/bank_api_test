import mongoose from "mongoose";

const PrivateApis = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    default: ""
  },
  key: {
    type: String,
    required: true,
    unique: true
  }
})

const Privates = mongoose.model('privates', PrivateApis)

export default Privates;