const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

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

const activeOrderSchema = new mongoose.Schema({
  userID: {
    type: String,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  items: [itemsSchema],
  orderData: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String
  },
  destination: {
    type: Object
  }
});

const driverSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  email: {
    type: String
  },
  subscribeData: {
    type: Date,
    required: true,
    default: Date.now
  },
  completedOrders: {
    type: Array
  },
  activeOrder: [activeOrderSchema]
});

driverSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("drivers", driverSchema);
