const express = require("express");
const router = express.Router();
const Restaurant = require("../models/restaurant");
const Subscriber = require("../models/subscriber");
const passport = require("passport");
const randomRest = require("randomrestgenerator");
const LocalStrategy = require("passport-local");
const Order = require("../models/order");
const { trusted } = require("mongoose");
const storage = require("../helpers/storage");
const { eventNames } = require("../models/restaurant");
const Applicant = require("../models/applicant");

// passport strategy for restaurants
passport.use("restlocal", new LocalStrategy(Restaurant.authenticate()));

router.get("/test", async function (req, res, next) {
  console.log("user", req.user);

  try {
    res.status(201).json(req.user);
  } catch (error) {
    res.status(400).json(error);
  }
});

router.get("/getmenu", async function (req, res, next) {
  const rest = await Restaurant.findById(req.user._id, function (err, docs) {
    if (err) {
      console.log(err);
    } else {
      // console.log("founduser")
    }
  }).clone();

  const { sidesmenu, menu, itemTypes } = rest;

  const menuByItemType = [];

  itemTypes.forEach((itemType) => {
    let relevantItems = [];

    menu.filter((item) => {
      console.log("main meu filter item", item);
      if (item.itemType === itemType) {
        relevantItems.push(item);
      }
    });

    menuByItemType.push({
      type: itemType,
      items: relevantItems
    });
  });

  console.log("constructed menu", menuByItemType);

  try {
    res.status(201).json({ sidesmenu, menu, menuByItemType, itemTypes });
  } catch (error) {
    res.status(400).json(error);
  }
});

router.post("/addmenuitem", storage, async function (req, res, next) {
  // all new menu item detail from client request
  const {
    name,
    price,
    description,
    categories,
    //rating,
    // restaurantname,
    image,
    imageName,
    relatedSides,
    addons,
    itemType
  } = req.body;

  console.log("request body", req.body, "request user", req.user);

  const imagePath = "http://localhost:3000/images/" + imageName;

  const convertedAddons = JSON.parse(addons);
  const convertedSides = JSON.parse(relatedSides);
  const convertedCats = JSON.parse(categories);

  console.log(
    "addons",
    convertedAddons,
    "sides",
    convertedSides,
    "categories",
    convertedCats
  );

  const imageObject = {
    name: imageName,
    imagePath: imagePath
  };

  console.log("image Object", imageObject);

  const newMenuItem = {
    name: name,
    price: price,
    description: description,
    categories: convertedCats,
    rating: 5,
    restaurantname: req.user.title,
    image: imageObject,
    relatedSides: convertedSides,
    addons: convertedAddons,
    itemType: itemType
  };

  //console.log("initial new menu item", newMenuItem);

  const rest = await Restaurant.findById(req.user._id, function (err, docs) {
    if (err) {
      console.log(err);
    } else {
      // console.log("founduser")
    }
  }).clone();

  const restMenu = rest.menu;
  //console.log("initial rest menu length", restMenu.length);
  const restSidesMenu = rest.sidesmenu;
  const itemTypes = rest.itemTypes;
  // console.log("rest item types", itemTypes);

  if (itemTypes.length === 0) {
    itemTypes.push(itemType);
  } else {
    itemTypes.filter((option) => {
      // console.log("option on item types filer", option);
      if (option !== itemType) {
        itemTypes.push(itemType);
      } else {
        return;
      }
    });
  }

  console.log("related sides before filter", relatedSides);

  if (convertedSides && convertedSides.length !== 0) {
    await convertedSides.filter((option) => {
      newMenuItem.relatedSides.push(option);
    });
  }

  restMenu.push(newMenuItem);

  // console.log(
  //   "rest menu item based on initial length",
  //   restMenu[restMenu.length - 1],
  //   "sides menu",
  //   rest.sidesmenu
  // );

  restMenu[restMenu.length - 1].relatedSides.filter((option) => {
    // console.log("new rest menu entry side on filter", option);
    function checkDuplicates() {
      let duplicate = "";
      let itemName = option.name;
      // console.log(itemName)
      for (let i = 0; i < restSidesMenu.length; i++) {
        if (itemName === restSidesMenu[i].name) {
          duplicate = "duplicate";
        }
        // console.log("loop running")
      }
      // console.log(randomOrder)
      return duplicate;
    }

    if (checkDuplicates() === "duplicate") {
    } else {
      restSidesMenu.push(option);
    }
  });

  console.log(
    "updated new menu item",
    newMenuItem,
    "updated rest menu"
    //restMenu[12].relatedSides
  );

  try {
    const updatedRest = await rest.save();
    res.status(201).json(updatedRest);
  } catch (error) {
    res.status(400).json(error);
  }
});

router.post("/apply", async function (req, res, next) {
  console.log("body", req.body.name);

  const applicant = new Applicant({
    storename: req.body.storename,
    storeaddress: req.body.storeaddress,
    floorsuite: req.body.floorsuite,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    email: req.body.email,
    phone: req.body.phone
  });

  try {
    const newApplicant = await applicant.save();
    res.status(201).json(newApplicant);
  } catch (error) {
    res.status(400).json(error);
  }
});

router.post("/updateimage", storage, async function (req, res, next) {
  console.log("body", req.body);

  const imagePath = "http://localhost:3000/images/" + req.body.name;

  const rest = await Restaurant.findById(req.user._id, function (err, docs) {
    if (err) {
      console.log(err);
    } else {
      // console.log("founduser")
    }
  }).clone();

  console.log("found rest", rest);

  let restImage = rest.image;

  console.log("rest iamge", rest.image);

  restImage["name"] = req.body.name;
  restImage["imagePath"] = imagePath;

  console.log("rest image", restImage);

  try {
    let updatedRest = await rest.save();
    console.log("updated rest image path", updatedRest.image.imagePath);
    let responseObject = {
      _id: updatedRest._id,
      title: updatedRest.title,
      email: updatedRest.email,
      rating: updatedRest.rating,
      imagePath: updatedRest.image.imagePath,
      description: updatedRest.description
    };
    res.status(201).json(responseObject);
  } catch (err) {
    res.json(err);
  }
});

// creates a test order
router.post("/create-test-order", async (req, res) => {
  const order = req.body.order;

  // console.log("order on create test order", order)

  const newOrder = new Order({
    userID: order.userID,
    total: order.total,
    items: order.items,
    status: "prep",
    stripePi: "pi_3LObK2LRP6Gx7e161UOsiFn4",
    destination: order.destination
  });

  const rest = await Restaurant.findOne(
    {
      _id: "6341688be85e95c4a05a9b84"
    },
    function (err, docs) {
      if (err) {
        console.log(err);
      } else {
        console.log("founduser");
      }
    }
  ).clone();

  const sub = await Subscriber.findOne(
    {
      _id: "634169429c2c7c778804008b"
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
  let pendingOrder = sub.pendingOrder;

  activeOrders.push(newOrder);
  pendingOrder.push(newOrder);

  try {
    const updatedOrder = await newOrder.save();
    const updatedSub = await sub.save();
    const updatedRestaurant = await rest.save();
    res.json(updatedOrder, updatedSub, updatedRestaurant);
  } catch (err) {
    res.json(err);
  }
});

// gets all active orders of a specific restaurant based on the user id stroed in a cookie
router.get(
  "/getactiveorders",
  checkAuthentication,
  authRole("rest"),
  async (req, res) => {
    // console.log("the user", req);

    //  console.log("authcheck log", req.isAuthenticated())

    // finds restaurant based on suer id
    const rest = await Restaurant.findById(req.user._id, function (err, docs) {
      if (err) {
        console.log(err);
      } else {
        // console.log("founduser")
      }
    }).clone();

    // stores retireived restaurants active orders array
    let activeOrders = rest.activeOrders;

    // console.log("activeOrders", activeOrders);

    try {
      // sends back retrieved active orders array to client
      res.json(activeOrders);
    } catch (err) {
      res.status(500).json({
        message: err.message
      });
    }
  }
);

router.get(
  "/getprofile",
  checkAuthentication,
  authRole("rest"),
  async (req, res) => {
    // console.log("the user", req);

    //  console.log("authcheck log", req.isAuthenticated())

    // finds restaurant based on suer id
    const rest = await Restaurant.findById(req.user._id, function (err, docs) {
      if (err) {
        console.log(err);
      } else {
        // console.log("founduser")
      }
    }).clone();

    console.log("rest image in get profile ", rest.image.imagePath);

    // stores retireived restaurants active orders array
    let profileObject = {
      _id: rest._id,
      title: rest.title,
      email: rest.email,
      rating: rest.rating,
      imagePath: rest.image.imagePath,
      description: rest.description
    };

    // console.log("activeOrders", activeOrders);

    try {
      // sends back retrieved active orders array to client
      res.json(profileObject);
    } catch (err) {
      res.status(500).json({
        message: err.message
      });
    }
  }
);

//get order history endpoint
router.get(
  "/getorderhistory",
  checkAuthentication,
  authRole("rest"),
  async (req, res) => {
    // console.log("the user", req);

    //  console.log("authcheck log", req.isAuthenticated())

    // finds restaurant based on suer id
    const rest = await Restaurant.findById(req.user._id, function (err, docs) {
      if (err) {
        console.log(err);
      } else {
        // console.log("founduser")
      }
    }).clone();

    // stores retireived restaurants active orders array
    let orderHistory = rest.completedOrders;

    // console.log("activeOrders", orderHistory);

    try {
      // sends back retrieved active orders array to client
      res.status(200).json(orderHistory);
    } catch (err) {
      res.status(500).json({
        message: err.message
      });
    }
  }
);

// adjusts order status of a restuants active orders
router.post(
  "/rest-adj-order-status",
  checkAuthentication,
  authRole("rest"),
  async (req, res) => {
    // order id sent in requst from client
    const orderId = req.body.orderId;

    //  console.log("adjsut order status user", req.user);

    let inputs = {
      restId: req.user._id,
      orderId: orderId
    };

    let orderToChange = await checkForOrder(inputs);

    try {
      // console.log("order to change", orderToChange);

      // changes the status of the retrieved active order from "prep" to "ready for collection"
      orderToChange.orderToChange["status"] = "ready for collection";
      // updates status of order in mail orders collection
      await Order.updateOne(
        {
          _id: orderId
        },
        {
          status: "ready for collection"
        },
        function (err, docs) {
          if (err) {
            console.log(err);
          } else {
            // console.log("Updated Order", docs);
          }
        }
      ).clone();

      // saves changes to actie orders in restaurants collection
      const updatedOrder = await orderToChange.rest.save();
      res.json(updatedOrder);
    } catch (e) {
      console.log(e);
      res.json(e);
    }
  }
);

// REGISTER USING PASSPORT JS endpoint for registering a new restuarant, this will eventually be moved to the admin panel once created
router.post("/register", async (req, res) => {
  // stores random restaurant object provided by randomrestgen npm package I created for producing test data, this route will eventually be adusted to fill alld etail in based on what is provided by the client
  let restObject = req.body;

  console.log("request body", req.body);
  console.log("rest object", restObject);

  // stores username email and password provided by request from cleint
  const { username, email, password } = req.body;

  console.log("username", username, "email", email, "password", password);

  // creates a new restuarant in restaurants colelction useing detail provided in request from cleint and random dta provided by randomrest generator npm packege
  Restaurant.register(
    {
      username: req.body.username,
      email: req.body.email,
      src: req.body.src,
      title: req.body.title,
      description: req.body.description,
      menu: req.body.menu,
      rating: req.body.rating,
      categories: req.body.categories,
      image: req.body.image,
      location: req.body.location
    },
    req.body.password,
    async (err, restaurant) => {
      if (err) {
        console.log(err);
      } else {
        try {
          await passport.authenticate("restlocal")(req, res, function () {
            console.log("is authenticated");
            res.status(201).json(newRestaurant);
          });
          const newRestaurant = await restaurant.save();
        } catch (err) {
          res.status(400).json({
            message: err.message
          });
        }
      }
    }
  );
});

// logs in esisting restaurant based on credentials provided by client request
router.post("/login", (req, res) => {
  console.log("login called");

  console.log("reqeust body", req.body);

  const restaurant = new Restaurant({
    username: req.body.username,
    password: req.body.password
    // email: req.body.email,
  });

  req.login(restaurant, async function (err) {
    if (err) {
      console.log("error on login", err);
    } else {
      try {
        passport.authenticate("restlocal")(req, res, function () {
          //let { user } = res;
          console.log("rest login response", res.req.user);
          console.log("req in login", req.user);
          res.json({ user: req.user, status: 200 });
        });
      } catch (err) {
        res.status(400).json({
          message: err.message
        });
      }
    }
  });
});

// logout endpoint for restaurants
router.post("/logout", function (req, res, next) {
  console.log("logout user", req.user);

  req.logOut(req.user, function (err) {
    if (err) {
      console.log("error", err);
      return next(err);
    }
  });

  let authResult = req.isAuthenticated();

  if (authResult === true) {
    res.json({ status: 400, message: "logout unsuccessful" });
  } else if (authResult === false) {
    res.json({ status: 200, message: "logout successful" });
  }
});

router.post("/isloggedin", checkAuthentication, async (req, res) => {
  console.log("restaurant is logged in request body", req.body);

  const orderDetail = {
    restId: req.user._id,
    orderId: req.body.orderId
  };

  let orderCheck = await checkForOrder(orderDetail);

  try {
    // console.log("order check result rest logged in", orderCheck);
    // console.log("request data", req.user instanceof Restaurant);

    if (req.user instanceof Restaurant && orderCheck.orderToChange) {
      res.json(true);
    } else {
      res.json(false);
    }
  } catch (e) {
    console.log("catch error", e);
  }
});

router.post(
  "/logStatusCheck",
  checkAuthentication,
  // authRole("rest"),
  (req, res) => {
    console.log("log status check true");
    res.json({ response: true });
  }
);

// test endpoint for restaurants route
router.post("/test", checkAuthentication, (req, res) => {
  console.log("hello");
});

// RANDOM ORDER FILTER/GENERATOR
router.get("/randomorder", async (req, res) => {
  //USERS CHOSEN CATEGORIES SPH & NOP SENT THROUGH THE REQUEST
  const restCats = req.body.restcategories;
  const menuCats = req.body.menucats;
  var totalSpend = req.body.totalspend;
  const numberOfHeads = req.body.numberofheads;
  const spendPerHead = totalSpend / numberOfHeads;

  // console.log(spendPerHead)

  console.log("request body", req.body);
  console.log("menu cats", menuCats);

  let restOptions = await Restaurant.aggregate([
    {
      $match: {
        categories: {
          $in: restCats
        }
      }
    }
  ]);

  // console.log(restOptions)

  let eligibleRestOptions = [];

  // filters through restaurant options and spits put options that match the chosen paramaters sent by the client
  for (let i = 0; i < restOptions.length; i++) {
    restOptions[i].menu.filter(function checkOptions(option) {
      console.log("rest option", option);

      option.categories.filter((category) => {
        console.log("category", category);

        if (menuCats.includes(category)) {
          eligibleRestOptions.push(restOptions[i]);
        }
      });
    });
  }

  console.log(eligibleRestOptions);

  //STORES FULL RESULT OF BOTH RESTURANTS MATCHING USERS CHOSEN CATEGORIES AND menu ITEMS OF THOSE RESTURANTS MATCHING USERS CATEGORIES
  let randomRestOption =
    eligibleRestOptions[Math.floor(Math.random() * restOptions.length)];

  // console.log(randomRestOption.categories)

  //RESULT OF ALL menu ITEMS MATCHING USER CATEGORIES
  let menuOptions = [];

  // console.log(randomRestOption)

  // console.log(randomRestOption)

  // LOOPS THROUGH ALL RESTAURANT OPTIONS MENUS AND OUTPUTS MENU  ITEMS MATCHING THE USERS CHOSEN CATEGORIES
  await randomRestOption.menu.filter(function checkoptions(option) {
    for (let x = 0; x < option.categories.length; x++) {
      // console.log(option)

      option.categories.filter((category) => {
        if (menuCats.includes(category)) {
          // FILTERS RESULTS BASED ON TOTAL SPEND PER HEAD CHOSEN BY USER
          if (option.price <= spendPerHead) {
            menuOptions.push(option);
          } else if (spendPerHead === undefined) {
            menuOptions.push(option);
          }
        }
      });
    }
  });

  // defines a start time for random order generator to run
  const startingTime = Date.now();

  // defnes how long the generator will run for these two paramaters avoid an infinite loop encase there is not enough data to fill the random order result
  const timeTocancel = 4000;

  // console.log(menuOptions)

  let randomOrder = [];

  // will run the loop until number of heads is less than or equal to the random order result length
  while (randomOrder.length < numberOfHeads) {
    const currentTime = Date.now();

    // console.log(keepCalling)

    // will randomply spit out a menue option of the retireved elligble menue options
    let randommenuOption = await menuOptions[
      Math.floor(Math.random() * menuOptions.length)
    ];

    // console.log(randommenuOption)

    // will check to see if the random menue option is a duplicate of any options already in the random order result
    function checkDuplicates() {
      let duplicate = "";
      let itemName = randommenuOption.name;
      // console.log(itemName)
      for (let i = 0; i < randomOrder.length; i++) {
        if (itemName === randomOrder[i].name) {
          duplicate = "duplicate";
        }
        // console.log("loop running")
      }
      // console.log(randomOrder)
      return duplicate;
    }

    let checkduplicate = checkDuplicates();

    // will break the loop if its been running for longer than 4 seconds and hasnt filled the number of heads requirement
    if (currentTime - startingTime >= timeTocancel) break;

    if (checkduplicate === "duplicate") {
      // console.log("Found Duplicate")
    } else {
      randomOrder.push(randommenuOption);
    }
    randomOrder.length;
    // console.log(randommenuOption)
  }

  // console.log(spendPerHead)
  try {
    res.status(201).send({
      randomOrder
    });
  } catch (err) {
    console.log(err);
  }
});

// GENERAL FILTER
router.get("/filter", async (req, res) => {
  //USERS CHOSEN CATEGORIES SPH & NOP SENT THROUGH THE REQUEST
  const restCats = await req.body.restcategories;
  const menuCats = await req.body.menucats;
  var spendPerHead = await req.body.spendperhead;

  // RETURNS ONLY RESTURANT OPTIONS WITH CATEGORIES CONTAINING AT LEAST ONE OPTION IN THE USERS REQUESTED CATEGORIES
  let restOptions = await Restaurant.aggregate([
    {
      $match: {
        categories: {
          $in: restCats
        }
      }
    }
  ]);
  //RESULT OF ALL menu ITEMS MATCHING USER CATEGORIES
  let menuOptions = [];

  //FULL RESULT OF BOTH RESTURANTS MATCHING USERS CHOSEN CATEGORIES AND menu ITEMS OF THOSE RESTURANTS MATCHING USERS CATEGORIES

  // LOOPS THROUGH ALL RESTURANT OPTIONS menuS AND OUTPUTS menu ITEMS MATCHING THE USERS CHOSEN CATEGORIES
  for (let i = 0; i < restOptions.length; i++) {
    restOptions[i].menu.filter(function checkOptions(option) {
      option.categories.filter((category) => {
        if (menuCats.includes(category)) {
          // FILTERS RESULTS BASED ON TOTAL SPEND PER HEAD CHOSEN BY USER
          if (option.price <= spendPerHead) {
            menuOptions.push(option);
          } else if (spendPerHead === undefined) {
            menuOptions.push(option);
          }
        }
      });
    });
  }

  // console.log(result)
  try {
    // sends rest options and menue options result back to client
    res.status(201).send({
      menuOptions,
      restOptions
    });
  } catch (err) {
    if (err) {
      res.status(500).json({
        message: err.message
      });
    }
  }
});

// Getting All
router.get("/", async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
});

// Getting One
router.get("/:id", getRestaurant, (req, res) => {
  res.json(res.restaurant);
});

// Updating One
//// NEEDS PASSPORT JS FUNCTIONALITY
router.patch("/:id", getRestaurant, async (req, res) => {
  //// NEED TO ADD IS AUTHENTICATED VERIFICATION NEEDS TO BE ADDED FOR ACCESS TO EDIT RESTAURANT
  if (req.body.name != null) {
    res.restaurant.name = req.body.name;

    //// NEED TO CREATE LOOP THAT CHANGES ALL RESTAURANTNAME KEY VALUES IN THE RESTAURANTS menu IF THE RESTAURANTS NAME CHANGES
  }
  if (req.body.title != null) {
    res.restaurant.title = req.body.title;
  }
  if (req.body.description != null) {
    res.restaurant.description = req.body.description;
  }
  if (req.body.menuitem != null) {
    const currentmenu = res.restaurant.menu;
    const newmenuItem = req.body.menuitem;
    if (req.body.menuitem.categories.includes(res.restaurant.categories)) {
      console.log("working");
      //// NEED TO ADD SECOND CHECK TO MAKSE SURE RESTAURANT EDIT menu IS THE CORRECT ONE
      currentmenu.push(newmenuItem);
    } else {
      console.log(
        "error, menu item does not contain correct primary category matching your restaurant"
      );
    }
  }
  try {
    const updatedRestaurant = await res.restaurant.save();
    res.json(updatedRestaurant);
  } catch (err) {
    res.status(400).json({
      message: err.message
    });
  }
});

// Deleting One
//// NEEDS PASSPORT JS FUNCTIONALITY will be added to admin panel once created
router.delete("/:id", getRestaurant, async (req, res) => {
  try {
    await res.restaurant.remove();
    res.json({
      message: "Deleted Restaurant"
    });
  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
});

// function to get restaurant based on id provided in params will be moved to admin panel later on
async function getRestaurant(req, res, next) {
  let restaurant;
  try {
    restaurant = await Restaurant.findById(req.params.id);
    if (restaurant == null) {
      return res.status(404).json({
        message: "cannot find Restaurant"
      });
    }
  } catch (err) {
    // return res.status(500).json({
    //     message: err.message
    // })
  }
  res.restaurant = restaurant;
  next();
}

// checks authentications tatus of a user
function checkAuthentication(req, res, next) {
  // console.log("request user", req.user)
  if (req.isAuthenticated()) {
    //req.isAuthenticated() will return true if user is logged in
    console.log("authenticated");
    next();
  } else {
    res.json({ response: false });
  }
}

// checks role of user trying toa ccess certain endpoints
function authRole(role) {
  return (req, res, next) => {
    // console.log("auth role user type", req.user instanceof Subscriber)
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

async function checkForOrder(inputs) {
  console.log("inputs in check for order", inputs);
  let rest;

  try {
    rest = await Restaurant.findById(inputs.restId, function (err, docs) {
      if (err) {
        console.log(err);
      } else {
        console.log("founduser");
        // console.log("docs", docs);
      }
    }).clone();
    // console.log("restaurant", rest);

    // stroes retrieved active orders
    let activeOrders = rest.activeOrders;
    let orderToChange;

    //console.log("active orders check for order", activeOrders);

    // fiters active orders to find the relevant order based on order id sent in request by client
    activeOrders.filter(function checkOption(option) {
      if (option.id === inputs.orderId) {
        orderToChange = option;
      }
    });

    return {
      orderToChange: orderToChange,
      rest: rest
    };
  } catch (e) {
    console.log("catch error", e);
  }
}

module.exports = router;
