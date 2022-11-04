const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const cartSchema = new mongoose.Schema({
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

const favouritesSchema = new mongoose.Schema({
  favouritemeals: {
    type: Array
  },
  favouriteresturants: {
    type: Array
  }
});

const pendingItemsSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String
});

const pendingOrderSchema = new mongoose.Schema({
  userID: {
    type: String,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  items: [pendingItemsSchema],
  removeItem: {
    type: String
  },
  orderData: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String
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

const subscriberSchema = new mongoose.Schema({
  googleID: {
    type: String
  },
  facebookID: {
    type: String
  },
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
  orderHistory: {
    type: Array
  },
  favourites: {
    favouritesSchema
  },
  cart: [cartSchema],
  login: {
    type: String
  },
  pendingOrder: [pendingOrderSchema],
  stripeCustId: {
    type: String,
    required: true
  }
});

subscriberSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model("subscriber", subscriberSchema);
