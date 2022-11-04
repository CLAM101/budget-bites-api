const express = require("express");
const router = express.Router();
const passport = require("passport");
const LocalStrategy = require("passport-local");
const Driver = require("../models/driver");
const Subscriber = require("../models/subscriber");
const Restaurant = require("../models/restaurant");
const Order = require("../models/order");
let distance = require("google-distance-matrix");
const order = require("../models/order");

//google distance matrix initialization
distance.key(process.env.GOOGLE_API_KEY);
distance.mode("driving");

// LOCAL STRATEGY FOR DRIVER MONGOOSE MODEL
passport.use("drivelocal", new LocalStrategy(Driver.authenticate()));

// TEST ROUTE
router.post("/test", checkAuthentication, authRole("drive"), (req, res) => {
  let origins = ["Scottburgh"];
  let destinations = ["Durban"];

  distance.matrix(origins, destinations, function (err, distances) {
    if (err) {
      console.log(err);
    } else {
      console.log("distances response", distances.rows[0].elements);
    }
  });

  res.json("distances fired");
});

router.post(
  "/get-order-history",
  checkAuthentication,
  authRole("drive"),
  async (req, res) => {
    //console.log("request in get order history", req);

    let driver = await Driver.findById(req.user._id, (err, docs) => {
      if (err) {
        console.log("error getting driver in get order hist", err);
      } else {
        // console.log("found driver in get order hist", docs);
      }
    }).clone();

    try {
      let orderHistory = driver.completedOrders;

      console.log("orderHistory", orderHistory);

      res.status(200).json({ orderHistory });
    } catch (error) {
      res.status(400).json("error getting driver");
    }
  }
);

router.post(
  "/get-order-status",
  checkAuthentication,
  authRole("drive"),
  async (req, res) => {
    console.log("get order satus driver ID", req.user._id);

    const driver = await Driver.findById(req.user._id, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        // console.log("found user", user);
      }
    }).clone();

    const activeOrder = driver.activeOrder[0];

    //console.log("active order in get order status", activeOrder);

    if (activeOrder) {
      let restaurant = await Restaurant.findOne(
        {
          ["activeOrders"]: {
            $elemMatch: {
              "_id": activeOrder._id
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
      let restLocation = restaurant.location;
      res.status(200).json({ activeOrder, restLocation });
    } else {
      res.status(400).json("No active order currently");
    }
  }
);

// verifys logged status for persistence of logged state
router.post(
  "/logStatusCheck",
  checkAuthentication,
  authRole("drive"),
  async (req, res) => {
    res.json(true);
  }
);

router.post(
  "/confirm-pickup",
  checkAuthentication,
  authRole("drive"),
  async (req, res) => {
    const orderId = req.body.orderId;

    // updates sub order status returns order and updated sub
    const updatedSub = await updateOrderStatus(
      Subscriber,
      "out for delivery",
      orderId,
      "pendingOrder"
    );

    const updatedDriver = await updateOrderStatus(
      Driver,
      "out for delivery",
      orderId,
      "activeOrder"
    );

    //updates rest order status returns order and updated rest
    const updatedRest = await updateOrderStatus(
      Restaurant,
      "out for delivery",
      orderId,
      "activeOrders"
    );

    //updates order status in main orders collection
    await Order.updateOne(
      {
        _id: orderId
      },
      {
        status: "out for delivery"
      },
      function (err, docs) {
        if (err) {
          console.log(err);
        } else {
          // console.log("Updated Order confirm pickup ", docs);
        }
      },
      (e) => {
        console.log("callback order update one", e);
      }
    ).clone();

    //error handling and respone
    try {
      res.status(200).json({ updatedRest, updatedSub, updatedDriver });
    } catch (error) {
      res.status(400).json("error message", error);
    }
  }
);

// verifys drivers logged in status and order eligability based on proximity to restaurant
router.post(
  "/isloggedin",
  checkAuthentication,
  authRole("drive"),
  async (req, res) => {
    //console.log("request data", req.user instanceof Driver);
    console.log("request body  is logged in", req.body);

    // finds relevant restaurant based on order ID
    let restaurant = await Restaurant.findOne(
      {
        "activeOrders": {
          $elemMatch: {
            "_id": req.body.orderId
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

    const order = await Order.findById(req.body.orderId, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        // console.log("found user", user);
      }
    }).clone();

    let restLocation = restaurant.location;

    // driver location recieved from driver mobile client
    let driverLocation =
      JSON.stringify(req.body.newLocation.coords.latitude) +
      ", " +
      JSON.stringify(req.body.newLocation.coords.longitude);

    let orderDestination =
      JSON.stringify(order.destination.coords.latitude) +
      ", " +
      JSON.stringify(order.destination.coords.longitude);

    console.log("order destination in logged check", order.destination);

    let origins = [driverLocation, restLocation];
    let destinations = [restLocation, orderDestination];

    try {
      //calculates distance from driver to restaurant with the available collection
      distance.matrix(origins, destinations, function (err, distances) {
        if (!err) {
          console.log(
            "returned distances",
            distances.rows[0].elements[0].distance.value
          );

          // if driver is varified and close enough returns true, if not returns false
          if (distances.rows[0].elements[0].distance.value < 10000) {
            res.status(200).json({
              status: true,
              restLocation: restLocation,
              travelInfo: distances,
              restName: restaurant.title
            });
          } else {
            res.status(400).json(false);
          }
        }
      });

      // console.log("lat", latitude, "long", longitude, "is logged check found restaurant location", restLocation, "driver location", driverLocation)
    } catch (error) {
      console.log("driver is logged try catch error", error);
    }
  }
);

// complete order route
router.post(
  "/complete-order",
  checkAuthentication,
  authRole("drive"),
  async (req, res) => {
    // order id from request body
    const orderId = req.body.orderId;

    console.log("order ID, complete order", orderId);

    //updates driver order status returns order and updated driver
    const driver = await updateOrderStatus(
      Driver,
      "completed",
      orderId,
      "activeOrder"
    );

    // console.log("driver", driver);

    // stores active order
    const driverActiveOrder = driver.order;

    //stores drivers completed orders array
    const driverCompletedOrders = driver.updatedDocument.completedOrders;

    // oushers active order into completed orders
    driverCompletedOrders.push(driverActiveOrder);

    //updates sub order status returns order and updated sub
    const sub = await updateOrderStatus(
      Subscriber,
      "completed",
      orderId,
      "pendingOrder"
    );

    // stores the subs pendign order
    const subPendOrder = sub.order;

    // stores sub order history
    const subOrderHist = sub.updatedDocument.orderHistory;

    // console.log("sub order history", subOrderHist);

    // pushes roder to subs order history
    subOrderHist.push(subPendOrder);

    // saves changes
    const updatedSub = await sub.updatedDocument.save();

    console.log(
      "active order driver",
      req.user.activeOrder[0].items[0].restaurantname
    );

    //updates rest order status returns order and updated rest
    const restaurant = await updateOrderStatus(
      Restaurant,
      "completed",
      orderId,
      "activeOrders"
    );

    // stores rest completed orders
    const restCompletedOrders = restaurant.updatedDocument.completedOrders;

    // console.log("rest active orders", restActiveOrders);

    //stores teh active order
    let restActiveOrder = restaurant.order;

    console.log("restactive order", restaurant.order);

    // pushers order into completed orders
    restCompletedOrders.push(restActiveOrder);

    // console.log("driver id for driver update", driver._id);

    //removes complted order from active orders
    await Driver.updateOne(
      {
        _id: driver.updatedDocument._id
      },
      {
        $pull: {
          activeOrder: {
            _id: orderId
          }
        }
      },
      function (err, docs) {
        if (err) {
          console.log(err);
        } else {
          // console.log("successfully updated driver", docs);
        }
      }
    ).clone();

    // changes order status in main orders collection
    console.log("order ID for order update", orderId);
    await Order.updateOne(
      {
        _id: orderId
      },
      {
        status: "completed"
      },
      function (err, docs) {
        if (err) {
          console.log(err);
        } else {
          //  console.log("Updated Order", docs);
        }
      }
    ).clone();

    //removes completed order from rests active orders

    console.log(
      "extracted rest name",
      restaurant.order.items[0].restaurantname
    );

    await Restaurant.updateOne(
      {
        title: restaurant.order.items[0].restaurantname
      },
      {
        $pull: {
          activeOrders: {
            _id: orderId
          }
        }
      },
      function (err, docs) {
        if (err) {
          console.log(err);
        } else {
          // console.log("sucessfully updated restaurant", docs);
        }
      }
    ).clone();

    console.log("subscriber user id for sub update", restaurant.order.userID);

    //removes completed order from rests active orders
    await Subscriber.updateOne(
      {
        _id: restaurant.order.userID
      },
      {
        $pull: {
          pendingOrder: {
            _id: orderId
          }
        }
      },
      function (err, docs) {
        if (err) {
          console.log(err);
        } else {
          // console.log("sucessfully updated subsriber", docs);
        }
      }
    ).clone();

    try {
      // saves changes
      const updatedRestaurant = await restaurant.updatedDocument.save();

      // saves changes
      const updatedDriver = await driver.updatedDocument.save();
      // response with updated docs
      res.status(200).json(updatedRestaurant, updatedSub, updatedDriver);
      // catches and sends error response
    } catch (e) {
      console.log(e);
      res.status(400).json("error message", e);
    }
  }
);
// endpoint for driver to accept or decline a new order that has come in, this will be attached to a button brought up by pusher on the client side, the button will hit this endpoint.
router.post(
  "/accept-or-decline",
  checkAuthentication,
  authRole("drive"),
  async (req, res) => {
    // uder id passed in from client side
    const orderId = req.body.orderId;

    //console.log("user input orderId", orderId, "user id", req.user._id);

    //finds the logged in driver
    const driver = await Driver.findById(req.user._id, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        // console.log("found user", user);
      }
    }).clone();

    // console.log("driver", driver);

    //finds the order in question
    const availOrder = await Order.findById(orderId, (err, item) => {
      if (err) {
        console.log(err);
      } else {
        console.log("found order", item);
      }
    }).clone();

    //updates rest order status returns order and updated rest
    const restaurant = await updateOrderStatus(
      Restaurant,
      "driver on way to collect",
      orderId,
      "activeOrders"
    );

    //console.log("restaurant", restaurant);

    //updates sub order status returns order and updated sub

    const sub = await updateOrderStatus(
      Subscriber,
      "driver on way to collect",
      orderId,
      "pendingOrder"
    );

    console.log(
      "driver active orders array",
      driver.activeOrder,
      "avail roder",
      sub.order
    );
    // console.log("sub pend order", subPendOrder);

    // changes the status of the order for the drive and the subscriber as well
    availOrder["status"] = "driver on way to collect";

    // psuhes the order into the drivers active orders
    driver.activeOrder.push(sub.order);

    try {
      // saves all changes to DB and provides a response to the client
      const updatedRest = await restaurant.updatedDocument.save();
      const updatedDriver = await driver.save();
      const updatedOrder = await availOrder.save();
      const updatedSub = await sub.updatedDocument.save();

      res.status(200).json({
        updatedDriver,
        updatedOrder,
        updatedSub,
        updatedRest
      });
      // catches and responds with error message
    } catch (e) {
      res.status(200).json("error message", e);
    }
  }
);

// LOGIN USING PASSPORT JS logs in the driver
router.post("/login", (req, res) => {
  console.log("driver login called");

  const driver = new Driver({
    username: req.body.username,
    password: req.body.password
    //  email: req.body.email,
  });
  req.login(driver, async function (err) {
    if (err) {
      console.log(err);
    } else {
      try {
        passport.authenticate("drivelocal")(req, res, function () {
          console.log("Authenticated");
          // console.log(req)
          res.status(201).json(req.user);
        });
      } catch (err) {
        console.log("error on driver login", err);
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
    console.log(e);
  }

  res.json(req.isAuthenticated());
  console.log("logout called");
});

// test endpoint for restaurants route
router.post("/test", checkAuthentication, (req, res) => {
  console.log("hello");
});

// REGISTER USING PASSPORT JS registers a new driver
router.post("/register", async (req, res) => {
  Driver.register(
    {
      username: req.body.username,
      email: req.body.email
    },
    req.body.password,
    async (err, driver) => {
      if (err) {
        console.log(err);
      } else {
        try {
          await passport.authenticate("drivelocal")(req, res, function () {
            console.log("is authenticated");
            res.status(201).json(newDriver);
          });
          const newDriver = await driver.save();
        } catch (err) {
          res.status(400).json({
            message: err.message
          });
        }
      }
    }
  );
});

// function for checking logged in status of drivers
function checkAuthentication(req, res, next) {
  // console.log("request body sub", req.user)
  if (req.isAuthenticated()) {
    //req.isAuthenticated() will return true if user is logged in
    console.log("authenticated");
    next();
  } else {
    res.json("Please log in");
  }
}

// checks role of the user limiting access to certain endpoints based on user type
function authRole(role) {
  return (req, res, next) => {
    console.log("auth role user type", req.user instanceof Driver);
    if (req.user instanceof Subscriber && role === "sub") {
      next();
      console.log("correct role sub");
    } else if (req.user instanceof Restaurant && role === "rest") {
      next();
      console.log("correct role rest");
    } else if (req.user instanceof Driver && role === "drive") {
      next();
    } else {
      res.status(401);
      return res.send("wrong role acccess denied");
    }
  };
}

async function updateOrderStatus(Collection, statusString, orderId, arrayName) {
  console.log("update order status function order id", orderId);

  let document = await Collection.findOne(
    {
      [arrayName]: {
        $elemMatch: {
          "_id": orderId
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

  console.log("found document", document);
  console.log("array name", arrayName);

  const orders = document[arrayName];
  let order;

  //console.log("found orders", orders)

  orders.filter((option) => {
    if (option.id === orderId) {
      order = option;
    }
  });

  order["status"] = statusString;

  let updatedDocument = await document.save();

  if (updatedDocument) {
    return {
      updatedDocument: updatedDocument,
      order: order
    };
  }
}

module.exports = router;
