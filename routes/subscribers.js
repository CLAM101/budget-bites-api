const express = require("express");
const router = express.Router();
const Subscriber = require("../models/subscriber");
const Restaurant = require("../models/restaurant");
const passport = require("passport");
const Order = require("../models/order");
const bodyParser = require("body-parser");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const facebookStrategy = require("passport-facebook").Strategy;
const stripe = require("stripe")(
  "sk_test_51LHhW8LRP6Gx7e16fmd1i0mP8HN53ueorPvcttySNxYMs1uy4cGLKiGI9ZLV79ePJPwvZaqLPiwpgetH4CZwMarx00ktNp8w1B"
);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const LocalStrategy = require("passport-local");

passport.use("sublocal", new LocalStrategy(Subscriber.authenticate()));

// Google auth routes
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/subscribers/google/callback"
    },
    function (accessToken, refreshToken, profile, email, done) {
      //check user table for anyone with a facebook ID of profile.id

      const ID = JSON.stringify(email.id);

      console.log(ID);
      Subscriber.findOne(
        {
          googleID: ID
        },
        function (err, user) {
          if (err) {
            return done(err);
          }
          //No user was found... so create a new user with values from Facebook (all the profile. stuff)
          if (!user) {
            const subscriber = new Subscriber({
              googleID: ID,
              username: email.displayName,
              email: email.emails[0].value,
              provider: "google",
              //now in the future searching on User.findOne({'facebook.id': profile.id } will match because of this next line
              google: profile._json
            });
            subscriber.save(function (err) {
              if (err) console.log(err);
              return done(err, user);
            });
          } else {
            //found user. Return
            return done(err, user);
          }
        }
      );
    }
  )
);

router.get(
  "/google",

  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
);

router.get(
  "/google/callback",

  passport.authenticate("google", {
    successRedirect: "https://www.youtube.com/",
    failureRedirect: "/login/failed"
  })
);

// Facebook Auth Routes
passport.use(
  new facebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/subscribers/facebook/callback",
      profileFields: ["email", "displayName", "name"]
    },
    function (accessToken, refreshToken, profile, done) {
      //check user table for anyone with a facebook ID of profile.id
      console.log(profile);

      const ID = JSON.stringify(profile.id);

      console.log(ID);
      Subscriber.findOne(
        {
          facebookID: ID
        },
        function (err, user) {
          if (err) {
            return done(err);
          }
          //No user was found... so create a new user with values from Facebook (all the profile. stuff)
          if (!user) {
            const subscriber = new Subscriber({
              facebookID: ID,
              username: profile.displayName,
              email: profile._json.email,
              provider: profile.provider,
              //now in the future searching on User.findOne({'facebook.id': profile.id } will match because of this next line
              facebook: profile._json
            });
            subscriber.save(function (err) {
              if (err) console.log(err);
              return done(err, user);
            });
          } else {
            //found user. Return
            return done(err, user);
          }
        }
      );
    }
  )
);

router.get(
  "/facebook",
  passport.authenticate("facebook", {
    scope: ["email"]
  })
);

router.get(
  "/facebook/callback",
  passport.authenticate("facebook", {
    successRedirect: "https://www.youtube.com/",
    failureRedirect: "/login/failed"
  })
);

// test endpoint for subscribers route
router.post("/test", checkAuthentication, authRole("sub"), async (req, res) => {
  res.status(201).send("workign test");
});

// Edit cart (user must be authenticated)
router.patch(
  "/editcart",
  checkAuthentication,
  authRole("sub"),
  async (req, res) => {
    let menuItem = null;
    let wrongRest = false;
    let noItem = false;
    let existingPendingOrder = false;
    // DETERMINES IF USER IS AUTH AND IF ADD OR REMOVE ITEM MAKE SURE ADD OR REMOVE PROP IS OUTSIDE OF CART ITEM OBECT
    if (req.body.addOrRemoveItem === "add") {
      var sub;
      // FINDS SUBSCRIBER BASED ON REQUEST
      sub = await Subscriber.findById(req.user._id, function (err, docs) {
        if (err) {
          console.log(err);
        } else {
          console.log("founduser1");
        }
      }).clone();
      // console.log(sub.cart)

      //  STORES SUBSCRIBERS CART IN A VARIABLE
      const currentCart = sub.cart;

      // STORES ITEM ID SENT BY FRONTEND IN A VARIABLE
      const itemId = req.body.itemId;

      // FINDS THE RESTAURANT THAT HAS THE UNIQUE menu ITEM SELECTED BY THE USER
      let restaurant = await Restaurant.findOne(
        {
          menu: {
            $elemMatch: {
              _id: itemId
            }
          }
        },
        function (err, docs) {
          if (err) {
            console.log(err);
          } else {
            // console.log("found restaurant")
            // console.log(docs.menu)
          }
        }
      ).clone();

      // console.log(menuItem)

      function addCartItem() {
        const item = restaurant.menu;
        for (let i = 0; i < item.length; i++) {
          if (item[i].id === itemId) {
            menuItem = item[i];
          }
        }
        // console.log(menuItem)
        // CREATES NEW CART ITEM VARIABLE FROM PULLED menuITEM
        let newCartItem = {
          name: menuItem.name,
          price: menuItem.price,
          description: menuItem.description,
          categories: menuItem.categories,
          rating: menuItem.rating,
          restaurantname: menuItem.restaurantname
        };

        console.log(newCartItem);
        console.log("function called");

        // PUSHES NEW CART ITEM INTO THE SUBSCRIBERS CART AND GENERATES A NEW UNIQUE OBJECT ID (THIS IS SO THAT THE USER CAN REMOVE UNIQUES ITEMS FROM THEIR CART EVEN IF ITS A DUPLICATE menu ITEM)
        currentCart.push(newCartItem);
      }
      console.log("im here");
      console.log(restaurant);
      // console.log(currentCart[0].restaurantname)
      // console.log(restaurant.title)
      // GOES THROUGH FOUND RESTAURANTS menu AND STORES THE CORRECT menu ITEM IN A VARIABLE BASED ON ITS OBJECT ID
      if (restaurant) {
        console.log("im working");

        if (currentCart[0] === undefined) {
          addCartItem();
        } else if (restaurant.title === currentCart[0].restaurantname) {
          addCartItem();
        } else if (restaurant.title != currentCart[0].restaurantname) {
          wrongRest = true;
        }
      } else if (!restaurant) {
        noItem = true;
      }

      //    DETERMINES IF USER IS AUTH AND IF ADD OR REMOVE ITEM MAKE SURE REMOVE ITEM PROP IS NOT IN CARTITEM OBJECT
    } else if (req.body.addOrRemoveItem === "remove") {
      var sub;
      sub = await Subscriber.findById(req.user._id, function (err, docs) {
        if (err) {
          console.log(err);
        } else {
          console.log("founduser");
        }
      }).clone();

      // REMOVES A CART ITEM BASED ON ITEM ID MUST PASS IN CART ITEM ID ONLY REMOVES OFF OF SPCIFIC ITEM ID
      const cartItemId = req.body.itemId;
      await Subscriber.updateOne(
        {
          _id: sub._id
        },
        {
          $pull: {
            cart: {
              _id: cartItemId
            }
          }
        }
      );
    } else {
      existingPendingOrder = true;
      console.log("not reading");
    }

    console.log(wrongRest);
    console.log(noItem);
    console.log(existingPendingOrder);

    try {
      // console.log(menuItem)
      // SAVES THE CHANGES IN THE SUBSCRIBERS COLLECTION
      console.log("here");
      if (
        wrongRest === false &&
        noItem === false &&
        existingPendingOrder === false
      ) {
        const updatedSubscriber = await sub.save();
        res.status(200).json(updatedSubscriber);
        // THROWS ERROR IF BAD REQUEST
      } else if (wrongRest === true) {
        res
          .status(404)
          .json(
            "you are trying to add an item from a different restuarant to your cart"
          );
      } else if (noItem === true) {
        res.status(404).json("item does not exist");
      } else if (existingPendingOrder === true) {
        res
          .status(404)
          .json(
            "please complete or cancel your last order before starting a new one"
          );
      }
    } catch (err) {
      console.log(err);
    }
  }
);

// Create Order (user must be authenticated)
router.post("/createorder", checkAuthentication, async (req, res) => {
  try {
    // FINDS SUBSCRIBER BASED ON REQUEST ID
    const sub = await Subscriber.findById(req.user._id, function (err, docs) {
      if (err) {
        console.log(err);
      } else {
        console.log("founduser");
      }
    }).clone();

    //STORES/TARGETS THE PENDING ORDER OF SUBSCRIBER
    const pendingOrder = await sub.pendingOrder;

    //DETERMINES IF THE USER ALREADY HAS A PENDING ORDER, IF USER HAS PENDING ORDERS THEY WILL BE BLOCKED FROM CREATING A NEW ORDER UNTIL THE PREVIOUS ORDER IS CONFIRMED OR CANCELLED

    // IDENTIFIES SPECIFIC CART BASED ON REQUEST
    const cart = req.user.cart;

    //MAPS THE PRICE OF EACH CART ITEM TO AN ARRAY
    const itemTotals = cart.map((prop) => prop.price);

    //FUNCTION FOR SUMMING ALL VALUES IN AN ARRAY
    const reducer = (accumulator, curr) => accumulator + curr;

    //USES REDUCER FUNCTION TO SUM ALL PRICES OF ITEMS IN CART
    const total = itemTotals.reduce(reducer);

    //CREATES A NEW ORDER USING THE ABOVE STORED VARIABLES
    const order = new Order({
      userID: req.user._id,
      total: total,
      items: cart,
      confirmed: false
    });

    // PUSHES NEW PENDING ORDER INTO SUBSCRIBERS PENDING ORDER ARRAY
    await pendingOrder.push(order);

    // SAVES THE NEW ORDER TO THE MAIN ORDERS COLLECTION  & THE SUBS PENDING ORDER
    const newOrder = await order.save();
    const newPendingOrder = await sub.save();

    //SENDS BACK BOTH THE ORDERS COLLECTION AND USERS ORDER HISTORY ARRAY
    res.status(201).send({
      newOrder,
      newPendingOrder
    });
  } catch (err) {
    res.status(400).json({
      message: err.message
    });
  }
});

// GET ONE SUBSCRIBER BASED ON REQUEST ID USING PASSPORT IDEALLY USED FOR DATA NEEDED FOR THE PAYMENT PAGE AFTER MAKING AN ORDER
router.get("/getone", checkAuthentication, async (req, res) => {
  const sub = await Subscriber.findById(req.user._id, function (err, docs) {
    if (err) {
      console.log(err);
    } else {
      console.log("founduser");
    }
  }).clone();

  try {
    res.json(sub);
  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
});

// GETS ALL SUBSCRIBERS
router.get("/getall", checkAuthentication, async (req, res) => {
  try {
    const subscribers = await Subscriber.find();
    res.json(subscribers);
  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
});

// gets all payment methods attached to a specific user
router.get(
  "/getpaymentmethods",
  checkAuthentication,
  authRole("sub"),
  async (req, res) => {
    // stores the stripe customer id of the retireved user
    const stripeCustomerId = req.user.stripeCustId;

    // retrieves the customer froms tripe DB
    const customer = await stripe.customers.retrieve(stripeCustomerId);

    // lists all payment methods attached to the retreived customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: "card"
    });
    try {
      res.json({
        paymentMethods
      });
    } catch (e) {
      console.log(e);
    }
  }
);

// edits the payment methods of a specific user in client request
router.post(
  "/editpaymentmethods",
  checkAuthentication,
  authRole("sub"),
  async (req, res) => {
    // stores card number provided by client
    const subCard = req.body.card;

    // stores billing details provided by client
    const subBillingDetails = req.body.billingdetails;

    // stores the intended action provided by client in body
    const intendedAction = req.body.intendedaction;

    // stores the payment method to be removed provided by client
    const paymentMethodRemove = req.body.paymentmethod;

    // stores customer id of requesting user on cleitn side
    const stripeCustomerId = req.user.stripeCustId;

    console.log("stripe customer id", stripeCustomerId);

    // retreives the customer in stripe DB useing retieved customer Id from user on client side
    const customer = await stripe.customers.retrieve(stripeCustomerId);

    console.log("customer id", customer);

    // determinse if the cleitn ash requested to add  payment method
    if (intendedAction === "addcard") {
      // creates the new payment method based on detail provided by client in request
      const paymentMethod = await stripe.paymentMethods.create({
        type: "card",
        card: {
          number: subCard.number,
          exp_month: subCard.exp_month,
          exp_year: subCard.exp_year,
          cvc: subCard.cvc
        },
        billing_details: subBillingDetails
      });

      // attaches the payment method to the customer using the customers strime customer id
      const attachedPaymentMethod = await stripe.paymentMethods.attach(
        paymentMethod.id,
        {
          customer: customer.id
        }
      );

      console.log("payment method", attachedPaymentMethod);

      // sends back added paymetn method if successfull
      res.json({
        attachedPaymentMethod
      });

      // determines iof the user chsoe to remove a payment method
    } else if (intendedAction === "deletecard") {
      // detaches the payment method from the user
      const removedpaymentMethod = await stripe.paymentMethods.detach(
        paymentMethodRemove
      );

      // if successfull sends back removed paymetn method to client
      res.json({
        removedpaymentMethod
      });
    }
  }
);

router.post(
  "/logStatusCheck",
  checkAuthentication,
  authRole("sub"),
  async (req, res) => {
    res.json(true);
  }
);

// puts together an order object based on detail in clients cart ahead of them confirming the order
router.get(
  "/checkout",
  checkAuthentication,
  authRole("sub"),
  async (req, res) => {
    // FINDS SUBSCRIBER BASED ON REQUEST
    let sub = await Subscriber.findById(req.user._id, function (err, docs) {
      if (err) {
        console.log(err);
      } else {
        console.log("founduser1");
      }
    }).clone();

    console.log("sub", sub);

    const cart = sub.cart;

    console.log("cart", cart);

    //MAPS THE PRICE OF EACH CART ITEM TO AN ARRAY
    const itemTotals = cart.map((prop) => prop.price);

    //FUNCTION FOR SUMMING ALL VALUES IN AN ARRAY
    const reducer = (accumulator, curr) => accumulator + curr;

    //USES REDUCER FUNCTION TO SUM ALL PRICES OF ITEMS IN CART
    const total = itemTotals.reduce(reducer);

    console.log("total", total);

    let orderObject = {
      cart: cart,
      total: total
    };

    try {
      res.status(200).json(orderObject);
    } catch (e) {
      res.status(400).json({ message: e });
    }
  }
);

// endpoint for refunding an existing order
router.post("/refund-order", async (req, res) => {
  // stores the order id provided by the clietn on request
  let orderID = req.body.orderID;

  // finds the subscriber the order is attached to
  let sub = await Subscriber.findOne(
    {
      pendingOrder: {
        $elemMatch: {
          _id: orderID
        }
      }
    },
    function (err, docs) {
      if (err) {
        console.log(err);
      } else {
        // console.log("found restaurant")
        // console.log(docs.menu)
      }
    }
  ).clone();

  // console.log(sub)

  // stores the pending orders array of the retrieved sub
  let pendingOrders = sub.pendingOrder;

  let chargeId;

  // filters through the subs pending orders to find the relevant order to be refunded and stores the Stripe chare ID of the relevant order
  pendingOrders.filter(function checkOptions(option) {
    if (option.id === orderID) {
      chargeId = option.stripeCharge;
    }
  });

  //calls stripe providing the charege ID of the order and requesting refund

  const refund = await stripe.refunds.create({ charge: chargeId });

  try {
    // sends back refunded order once sucessfull
    res.status(200).json({
      refund
    });

    // if error throws error back to cleint
  } catch (e) {
    res.status(401).json({
      error: {
        message: e.message
      }
    });
  }

  console.log("Charge ID", chargeId);
});

// calls stripe and creates a payment intenet for the users order, this co0mes after hitting the checkout endpoint
router.post(
  "/create-payment-intent",
  checkAuthentication,
  authRole("sub"),
  async (req, res) => {
    var sub;
    // FINDS SUBSCRIBER BASED ON REQUEST
    sub = await Subscriber.findById(req.user._id, function (err, docs) {
      if (err) {
        console.log(err);
      } else {
        console.log("founduser1");
      }
    }).clone();

    const cart = sub.cart;

    // console.log("cart", cart)

    //MAPS THE PRICE OF EACH CART ITEM TO AN ARRAY
    const itemTotals = cart.map((prop) => prop.price);

    //FUNCTION FOR SUMMING ALL VALUES IN AN ARRAY
    const reducer = (accumulator, curr) => accumulator + curr;

    //USES REDUCER FUNCTION TO SUM ALL PRICES OF ITEMS IN CART
    const total = itemTotals.reduce(reducer);

    // console.log("total", total)

    let orderObject = {
      cart: cart,
      total: total * 100
    };

    // console.log("sub", sub, "order Object", orderObject)

    const { paymentMethodType, currency } = req.body;

    // console.log(req.user._id)

    const paymentIntent = await stripe.paymentIntents.create({
      payment_method_types: [paymentMethodType],
      amount: orderObject.total,
      currency: currency,
      receipt_email: req.user.email,
      customer: sub.stripeCustId
    });
    try {
      //  console.log(paymentIntent.client_secret);
      res.status(200).json({
        clientSecret: paymentIntent.client_secret
      });
    } catch (e) {
      res.status(401).json({
        error: {
          message: e.message
        }
      });
    }

    //    console.log(req.body.paymentMethodType)
  }
);

// stripe webhook actions (still need webhook secret and a few other payments related fucntionality)
router.post(
  "/webhook",
  bodyParser.raw({
    type: "application/json"
  }),
  async (req, res) => {
    console.log("called");
    const sig = req.headers["stripe-signature"];
    let event;
    // console.log("type", typeof sig)
    // console.log("type", typeof req.body)
    try {
      // console.log("request", req)
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log(event);
    } catch (err) {
      console.log(`❌ Error message: ${err.message}`);
      return res.status(400).send(`webhook Error: ${err.message}`);
    }
    console.log("✅ Success:", event.id);

    // PAYMENT INTENT CREATED
    if (event.type === "payment_intent.created") {
      const paymentIntent = event.data.object;
      // console.log(`[${event.id}] PaymentIntent (${paymentIntent.id}):${paymentIntent.status}`);
      res.json({
        recieved: true
      });

      // PAYMENT INTENT SUCCEEDED
    } else if (event.type === "payment_intent.succeeded") {
      const confirmedPaymentIntent = event.data.object;

      // console.log("payment intent", paymentIntent.customer)

      const sub = await Subscriber.findOne(
        {
          stripeCustId: confirmedPaymentIntent.customer
        },
        function (err, docs) {
          if (err) {
            console.log(err);
          } else {
            console.log("founduser");
          }
        }
      ).clone();

      const pendingOrder = sub.pendingOrder;

      const cart = sub.cart;

      // console.log("cart", cart, "event object after succeed", confirmedPaymentIntent.id)

      //MAPS THE PRICE OF EACH CART ITEM TO AN ARRAY
      const itemTotals = cart.map((prop) => prop.price);

      //FUNCTION FOR SUMMING ALL VALUES IN AN ARRAY
      const reducer = (accumulator, curr) => accumulator + curr;

      //USES REDUCER FUNCTION TO SUM ALL PRICES OF ITEMS IN CART
      const total = itemTotals.reduce(reducer);

      // console.log("total", total)

      let orderObject = {
        cart: cart,
        total: total
      };

      let restName = orderObject.cart[0].restaurantname;

      const rest = await Restaurant.findOne(
        {
          title: restName
        },
        function (err, docs) {
          if (err) {
            console.log(err);
          } else {
            console.log("founduser");
          }
        }
      ).clone();

      let activeOrders = rest.activeOrders;

      //CREATES A NEW ORDER USING THE ABOVE STORED VARIABLES
      const order = new Order({
        userID: sub._id,
        total: orderObject.total,
        items: orderObject.cart,
        status: "prep",
        stripePi: confirmedPaymentIntent.id
      });

      // PUSHES NEW PENDING ORDER INTO SUBSCRIBERS PENDING ORDER ARRAY
      pendingOrder.push(order);
      activeOrders.push(order);

      //EMPTIES THE SUBSCRIBERS CART
      orderObject.cart.splice(0, orderObject.cart.length);

      // pendingOrder.splice(0, pendingOrder.length);

      // saves all changes made to collections
      const updatedOrder = await order.save();
      const updatedSub = await sub.save();
      const updatedRestaurant = await rest.save();

      // sends back updated detail saved in collections
      res.json({
        updatedOrder,
        updatedSub,
        updatedRestaurant,
        recieved: true
      });

      // if result sent back froms tripe is charge succeeded an order is created
    } else if (event.type === "charge.succeeded") {
      // stores various detail from the event sent abck by stripe
      let { id, customer, payment_intent } = event.data.object;

      // fiinds the subscriber relevant to the order and payment made
      const sub = await Subscriber.findOne(
        {
          stripeCustId: customer
        },
        function (err, docs) {
          if (err) {
            console.log(err);
          } else {
            console.log("founduser");
          }
        }
      ).clone();

      // stores the subs pending orders array
      let pendingOrders = sub.pendingOrder;

      // console.log(
      //   "charge ID",
      //   id,
      //   "customer",
      //   customer,
      //   "payment intent id",
      //   payment_intent,
      //   "subscriber",
      //   sub,
      //   "pending orders",
      //   pendingOrders
      // );
      let order;

      //  console.log("payment intent", payment_intent);

      // finds the relevant order based on the payment intent ID
      pendingOrders.filter(function checkOptions(option) {
        if (option.stripePi === payment_intent) {
          // console.log(option)
          order = option;
        }
        // console.log("this is the option", option.stripePi)
      });

      // stores the strioe charege id in the order
      order["stripeCharge"] = id;
      // console.log("order", order);

      // saves the changes in the subscribers colelction
      let updatedSub = await sub.save();
      // console.log(updatedSub);

      // sends a resposne tos tripe indecating the confirmation was recieved
      res.json({
        recieved: true
      });

      // if event trype froms tripe is refunded below blockw will run
    } else if (event.type === "charge.refunded") {
      // stores the charge id  attached to teh refund sent by stripe
      let refundChargeId = event.data.object.id;

      // finds the relevant subscriber based on the customer id sent in the event object by stripe
      const sub = await Subscriber.findOne(
        {
          stripeCustId: event.data.object.customer
        },
        function (err, docs) {
          if (err) {
            console.log(err);
          } else {
            console.log("founduser");
          }
        }
      ).clone();

      // stores the retireved subs pending orders array
      const pendingOrders = sub.pendingOrder;

      // stores the retrieved subs order history array
      const orderHistory = sub.orderHistory;

      console.log("pending orders", pendingOrders);

      let orderToMove;

      // filters through the subs pending orders and picks out the one matching the charege ID sent bys tripe
      pendingOrders.filter(function checkOption(option) {
        if (option.stripeCharge === refundChargeId) {
          orderToMove = option;
        }
      });

      console.log("order to move id", orderToMove.id);

      // updates the relevant order in the orders colllection based on the id of the retrieved order will update status to refunded
      await Order.updateOne(
        {
          _id: orderToMove.id
        },
        {
          status: "refunded"
        },
        function (err, docs) {
          if (err) {
            console.log(err);
          } else {
            console.log("Updated Order", docs);
          }
        }
      ).clone();

      // udpates the retrieved order from the sub to refunded
      orderToMove["status"] = "refunded";

      console.log("order to move with updated status", orderToMove);

      // pushes the refunded order into the subs order history array
      orderHistory.push(orderToMove);

      // saves the changes to the sub
      let updatedSub = await sub.save();

      // removes the order fro the subs pending orders array
      await Subscriber.updateOne(
        {
          stripeCustId: event.data.object.customer
        },
        {
          $pull: {
            pendingOrder: {
              stripeCharge: refundChargeId
            }
          }
        }
      );

      console.log("updated sub", updatedSub);
      // response sent back to stripe confirming reciept of event
      res.json({
        recieved: true
      });
    }
  }
);

// config for mobile, not relevant yet
router.get("/config", async (req, res) => {
  res.json({
    publishablekey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});

// DELIVERS ALL DATA NEEDED FOR LOGGED IN HOMEPAGE BASED ON IF THE USER IS AUTHENTICATED
router.get(
  "/loggedin",
  checkAuthentication,
  authRole("sub"),
  async (req, res) => {
    try {
      const subscribers = await Subscriber.findById(
        req.user._id,
        function (err, docs) {
          if (err) {
            console.log(err);
          } else {
            console.log("Found User!");
          }
        }
      ).clone();

      res.json(subscribers);
    } catch (err) {
      res.status(500).json({
        message: err.message
      });
    }
  }
);

// // Getting One
router.get("/:id", getSubscriber, (req, res) => {
  res.json(res.subscriber);
});

// LOGIN USING PASSPORT JS
router.post("/login", (req, res) => {
  const subscriber = new Subscriber({
    username: req.body.username,
    password: req.body.password
    //email: req.body.email,
  });
  req.login(subscriber, async function (err) {
    if (err) {
      console.log(err);
    } else {
      try {
        passport.authenticate("sublocal")(req, res, function () {
          console.log("Authenticated");
          // console.log(req)
          res.status(201).json("authenticated");
        });
      } catch (err) {
        res.status(400).json({
          message: err.message
        });
      }
    }
  });
});

router.post("/logout", async function (req, res, next) {
  console.log("logout user", req.user);

  try {
    req.logOut(req.user, function (err) {
      if (err) {
        console.log("error", err);
        return next(err);
      }
    });
  } catch (e) {
    res.json.status(400).json({ message: e });
    console.log(e);
  }

  res.json(req.isAuthenticated());
  console.log("logout called");
});

// REGISTER USING PASSPORT JS
router.post("/register", async (req, res) => {
  const customer = await stripe.customers.create({
    name: req.body.username,
    email: req.body.email
  });

  console.log("request body", req);

  Subscriber.register(
    {
      username: req.body.username,
      email: req.body.email,
      stripeCustId: customer.id
    },
    req.body.password,
    async (err, subscriber) => {
      if (err) {
        console.log(err);
      } else {
        try {
          await passport.authenticate("sublocal")(req, res, function () {
            console.log("is authenticated");
            res.status(201).json(newSubscriber);
          });
          const newSubscriber = await subscriber.save();
        } catch (err) {
          res.status(400).json({
            message: err.message
          });
        }
      }
    }
  );
});

// UPDATES ONE SUBSCRIBER BASED ON THE SUBSCRIBERS ID
router.patch("/:id", getSubscriber, async (req, res) => {
  if (req.body.email != null) {
    res.subscriber.email = req.body.email;
  }
  if (req.body.password != null) {
    res.subscriber.password = req.body.password;
  }
  try {
    const updatedSubscriber = await res.subscriber.save();
    res.json(updatedSubscriber);
  } catch (err) {
    res.status(400).json({
      message: err.message
    });
  }
});

// DELETES ONE SUBSCRIBER BASED ON THE SUBSCRIBERS ID
router.delete("/:id", getSubscriber, async (req, res) => {
  try {
    await res.subscriber.remove();
    res.json({
      message: "Deleted Subscriber"
    });
  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
});

// FUNCTION FOR GETTING A SPECIFIC SUBSCRIBER FROM THE SUBSCRIBERS COLLECTION BASED ON A PRIOVIDED ID IN THE REQUEST PARAMATERS
async function getSubscriber(req, res, next) {
  let subscriber;
  try {
    subscriber = await Subscriber.findById(req.params.id);
    if (subscriber == null) {
      return res.status(404).json({
        message: "cannot find subscriber"
      });
    }
  } catch (err) {
    return res.status(500).json({
      message: err.message
    });
  }
  res.subscriber = subscriber;
  next();
}

// function for checkign authentication of the user
function checkAuthentication(req, res, next) {
  // console.log("request body sub", req.user)
  if (req.isAuthenticated()) {
    //req.isAuthenticated() will return true if user is logged in
    console.log("authenticated");
    next();
  } else {
    res.json(false);
  }
}

// function for checking the role of the sub to protect endpoints from uatherized user types
function authRole(role) {
  return (req, res, next) => {
    //  console.log("auth role user type", req.user instanceof Subscriber)
    if (req.user instanceof Subscriber && role === "sub") {
      next();
      console.log("correct role sub");
    } else if (req.user instanceof Restaurant && role === "rest") {
      next();
      console.log("correct role rest");
    } else {
      res.status(401);
      return res.send("wrong role acccess denied");
    }
  };
}

module.exports = router;
