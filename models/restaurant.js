const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const imageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  imagePath: { type: String, required: true }
});

const addOnItemArraySchema = new mongoose.Schema({
  addonname: {
    type: String
  },
  addonoptions: [Object]
});

const sideItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  description: {
    type: String
  },
  imageName: {
    type: String
  },
  imagePath: {
    type: String
  }
});

const menuItemSchema = new mongoose.Schema({
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
    type: Number
  },
  restaurantname: {
    type: String,
    require: true
  },

  image: imageSchema,

  relatedSides: [sideItemSchema],
  addons: [addOnItemArraySchema],
  itemType: {
    type: String,
    required: true
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
  items: [menuItemSchema],
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

const restaurantSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  email: {
    type: String
  },
  title: {
    type: String
    // required: true
  },
  description: {
    type: String
    // required: true
  },
  menu: [menuItemSchema],
  sidesmenu: [sideItemSchema],
  addonmenu: [addOnItemArraySchema],
  rating: {
    type: String
  },
  categories: {
    type: Array
  },
  subscribeData: {
    type: Date,
    required: true,
    default: Date.now
  },
  activeOrders: [activeOrderSchema],
  completedOrders: {
    type: Array
  },
  location: {
    type: String
  },
  image: imageSchema,
  itemTypes: [String]
});

restaurantSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("restaurant", restaurantSchema);
