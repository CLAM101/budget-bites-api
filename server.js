require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const passport = require("passport");
const Subscriber = require("./models/subscriber");
const Restaurant = require("./models/restaurant");
const session = require("express-session");
const Driver = require("./models/driver");
const Pusher = require("pusher");

// connects app to DB
mongoose.connect(process.env.DATABASE_URL);
const db = mongoose.connection;
// throws error if any conencton to DB errors
db.on("error", () => console.error(error));

//  logs if connection to DB is successfull
db.once("open", () => console.log("connected to database"));

//creates a new pusher instance
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  encrypted: true
});
const channel1 = "rests";

// Use JSON parser for all non-webhook routes
app.use((req, res, next) => {
  // console.log(req.originalUrl)
  if (req.originalUrl === "/subscribers/webhook") {
    next();
  } else {
    bodyParser.json()(req, res, next);
  }
});

// used to connect frontend to backend allowing credentials so that sessions work
// correctly
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use("/images", express.static(__dirname + "/images"));

// part of passport js used to serialzie a user
passport.serializeUser(function (user, done) {
  if (user instanceof Subscriber) {
    done(null, {
      id: user.id,
      type: "Subscriber"
    });
    console.log("sub user");
  } else if (user instanceof Restaurant) {
    console.log("rest user");
    done(null, {
      id: user.id,
      type: "Restaurant"
    });
  } else if (user instanceof Driver) {
    console.log("driver user");
    done(null, {
      id: user.id,
      type: "Driver"
    });
  }
});

// part of passport js used to deserialize the user
passport.deserializeUser(function (id, done) {
  console.log("de-serialize called");
  console.log("id type", id.type);
  console.log("ID", id);
  if (id.type === "Subscriber") {
    Subscriber.findById(id.id, function (err, user) {
      done(err, user);
    });
  } else if (id.type === "Restaurant") {
    Restaurant.findById(id.id, function (err, user) {
      done(err, user);
    });
  } else if (id.type === "Driver") {
    Driver.findById(id.id, function (err, user) {
      done(err, user);
    });
  }
});

// Initializes sessions
app.use(
  session({
    secret: ["secret", "othersecret", "someothersecret"],
    resave: true,
    saveUninitialized: true
  })
);

// initializes passport
app.use(passport.initialize());

// initializes the session
app.use(passport.session());

// stroes various routes based on their location
const subscribersRouter = require("./routes/subscribers");
const restaurantsRouter = require("./routes/restaurants");
const ordersRouter = require("./routes/orders");
const seederRouter = require("./routes/seeder");
const driverRouter = require("./routes/drivers");

// gets app to use routes
app.use("/subscribers", subscribersRouter);
app.use("/restaurants", restaurantsRouter);
app.use("/orders", ordersRouter);
app.use("/seeder", seederRouter);
app.use("/drivers", driverRouter);

// indecates successfull connection to DB and server startup
db.once("open", () => {
  app.listen(3000, () => {
    console.log("Server has started on port 3000");
  });

  // pusher and restStream configuration

  //mongo change stream restaurants
  const activeOrderCollection = db.collection("restaurants");

  // changestream watcher
  const restStream = activeOrderCollection.watch([], {
    fullDocument: "updateLookup"
  });

  // code triggered on change
  restStream.on("change", (change) => {
    // console.log("change", change);

    // console.log("change op type", change.operationType);

    const fullChange = change.fullDocument;

    // triggers if new rest subscriber inserted
    if (change.operationType === "insert") {
      // console.log("rest1", fullChange);
      pusher.trigger(
        "rests",
        "inserted",
        {
          result: fullChange
        },
        function (err) {
          if (err) {
            console.log(err);
          } else {
            console.log("inserted Trigger hit");
          }
        }
      );
    } else if (change.operationType === "delete") {
      // calls pusher api
      pusher.trigger(
        channel1,
        "deleted",
        {
          result: fullChange
        },
        function (err) {
          if (err) {
            console.log(err);
          } else {
            console.log("delete trigger hit");
          }
        }
      );

      // fires for update of existing db entry
    } else if (change.operationType === "update") {
      // console.log("restaurant update change", change);
      // console.log(
      //   "change full document active order length",
      //   change.fullDocument.activeOrders.length,
      //   JSON.stringify(change.fullDocument.activeOrders.length - 1)
      // );

      // determines length of update fields section of change
      const orderKeyLength = JSON.stringify(
        change.updateDescription.updatedFields
      ).length;

      // console.log(
      //   "order key length",
      //   orderKeyLength,
      //   "updatefield string",
      //   change.updateDescription.updatedFields[
      //     "activeOrders." +
      //       JSON.stringify(change.fullDocument.activeOrders.length - 1)
      //   ]
      // );

      // console.log(
      //   "change update fields",
      //   change.updateDescription.updatedFields
      // );

      let result = null;

      // determines index of order that restaurant has indecated is ready for collection
      function checkLength() {
        let orderIndex = "";
        switch (orderKeyLength) {
          case 48:
            orderIndex = JSON.stringify(
              change.updateDescription.updatedFields
            ).slice(15, 16);
            break;
          case 49:
            orderIndex = JSON.stringify(
              change.updateDescription.updatedFields
            ).slice(15, 17);
            // code block
            break;
          case 50:
            orderIndex = JSON.stringify(
              change.updateDescription.updatedFields
            ).slice(15, 18);
            break;
          default:
            orderIndex = JSON.stringify(
              change.updateDescription.updatedFields
            ).slice(15, 18);
        }
        return orderIndex;
      }

      if (
        // case for when a new order has been created
        JSON.stringify(change.updateDescription.updatedFields).includes(
          "prep"
        ) &&
        !change.updateDescription.updatedFields.activeOrders
      ) {
        // console.log(
        //   "orderIndex",
        //   checkLength(),
        //   "parse int",
        //   parseInt(checkLength()),
        //   "requested order",
        //   change.fullDocument.activeOrders[checkLength()]
        // );
        // constructs result object with extracted order ID and event type
        result = {
          eventType: "newOrder",
          orderId:
            change.updateDescription.updatedFields[
              "activeOrders." +
                JSON.stringify(change.fullDocument.activeOrders.length - 1)
            ]._id
        };
      } else if (
        // case for when driver has accepted a collection
        JSON.stringify(change.updateDescription.updatedFields).includes(
          "driver on way to collect"
        ) &&
        !change.updateDescription.updatedFields.activeOrders
      ) {
        result = "driver on way to collect";

        // case for when restaurant indecates order ready for collection
      } else {
        // console.log(
        //   "result on last else",
        //   change.fullDocument.activeOrders[checkLength()]
        // );
        result = change.fullDocument.activeOrders[checkLength()];
      }
      // calls pusher with result
      pusher.trigger(
        "rests",
        "updated",
        {
          result: result
        },
        function (err) {
          if (err) {
            console.log(err);
          } else {
            console.log("Update Trigger hit");
          }
        }
      );
    }
  });
});
