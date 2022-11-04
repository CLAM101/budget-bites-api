const mongoose = require("mongoose");

const itemsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  categories: {
    type: Array,
    required: true
  },
  rating: {
    type: String
  },

  restaurantname: {
    type: String
  }
});

const orderSchema = new mongoose.Schema({
  userID: {
    type: String,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  items: [itemsSchema],
  removeItem: {
    type: String
  },
  orderData: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    required: true
  },
  stripePi: {
    type: String
  },
  stripeCharge: {
    type: String
  },
  destination: {
    type: Object
  }
});

module.exports = mongoose.model("order", orderSchema);
