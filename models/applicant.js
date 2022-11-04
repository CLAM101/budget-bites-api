const mongoose = require("mongoose");

const applicantSchema = new mongoose.Schema({
  storename: {
    type: String,
    required: true
  },
  storeaddress: {
    type: String,
    required: true
  },
  floorsuite: {
    type: String
    // required: true
  },
  firstname: {
    type: String,
    required: true
  },
  lastname: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  }
});
module.exports = mongoose.model("applicant", applicantSchema);
