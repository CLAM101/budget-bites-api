const express = require("express")
const router = express.Router()
const Restaurant = require("../models/restaurant")
const randomRest = require("randomrestgenerator")
const Subscriber = require("../models/subscriber");
const {faker} = require('@faker-js/faker')
const passport = require("passport");

// route for seeding test data


    passport.use(Subscriber.createStrategy());


    passport.serializeUser(function (user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function (id, done) {
        Subscriber.findById(id, function (err, user) {
            done(err, user);
        });
    });



router.post("/test", (req, res) => {

console.log(faker.name.firstName())
console.log(faker.random.word() + "@gmail.com")

   

})



// DATABASE SEEDER
// REGISTER USING PASSPORT JS
router.post("/register", async (req, res) => {
let userName = faker.name.firstName()
let email = userName + "@gmail.com"
let password = faker.random.word()

    Subscriber.register({
        username: userName,
        email: email

    }, password, async (err, subscriber) => {
        if (err) {
            console.log(err)
        } else {
            try {
             
                await passport.authenticate("local")(req, res, function () {
   console.log("working")
                    console.log("is authenticated")
                    res.status(201).json(newSubscriber)

                })
                const newSubscriber = await subscriber.save()

            } catch (err) {
                console.log("here!")
                res.status(400).json({
                    message: err.message
                })
            }
        }
    });
})


router.post("/populaterestdb", async (req, res) => {

    const randomRestaurant = randomRest()

    // CREATES A NEW RESTAURANT USING THE RESTAURANT MODEL RANDOM DETAIL FROM FAKER PACKAGE AS WELL AS THE ABOVE GENERATED RANDOM RESTAURANT DATA STORED IN THE menuITEMSS ARRAY
    const restaurant = new Restaurant({
        categories: randomRestaurant.categories,
        src: randomRestaurant.img,
        title: randomRestaurant.title,
        description: randomRestaurant.description,
        menu: randomRestaurant.menu,
        rating: randomRestaurant.rating,

    })
    // console.log(restaurant)

    try {
        const newRestaurant = await restaurant.save()
        res.status(201).json(newRestaurant)
    } catch (err) {
        res.status(400).json({
            message: err.message
        })
    }
})

module.exports = router