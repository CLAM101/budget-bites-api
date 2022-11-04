const express = require("express")
const router = express.Router()
const Order = require("../models/order")


// Getting All
router.get("/", async (req, res) => {
    try {
        const orders = await Order.find()
        res.json(orders)
    } catch (err) {
        res.status(500).json({
            message: err.message
        })
    }
})

// gets a specifid order based on its id as a param, this will be moved to the admin panel when created
router.get("/:id", getOrder, (req, res) => {
    res.json(res.order)
})

// updates and order baased on an order id param, this will be moved to the admen panel once created 
router.patch("/:id", getOrder, async (req, res) => {

    if (req.body.userID != null && req.body.removeItem != "true") {
        res.order.userID = req.body.userID
    }
    if (req.body.total != null && req.body.removeItem != "true") {
        res.order.total = req.body.total
    }
    if (req.body.items != null && req.body.removeItem != "true") {
        const currentItems = res.order.items
        const newItem = req.body.items
        currentItems.push(newItem)
    }
    if (req.body.removeItem === "true") {
        const userID = req.body.userID
        const ID = req.body.items._id

        await Order.updateOne({
            userID: userID
        }, {
            $pull: {
                items: {
                    _id: ID
                }
            }
        })

    }

    try {
        const updatedItems = await res.order.save()
        res.json(updatedItems)
    } catch (err) {
        console.log("Shit didnt work fam")
        res.status(400).json({
            message: err.message
        })
    }
})

// deletes an order based on an  id param, will be moved to admin panel once created
router.delete("/:id", getOrder, async (req, res) => {
    try {
        await res.order.remove()
        res.json({
            message: "Deleted Order"
        })
    } catch (err) {
        res.status(500).json({
            message: err.message
        })
    }
})

// will get an order based on id param, still not completed will add to admin panel and finish when moved to admin panel
async function getOrder(req, res, next) {

    let order
    try {
        order = await Order.findById(req.params.id)
        if (order === null) {
            return res.status(404).json({
                message: "Cannot Find Order"
            })
        }
    } catch (err) {
        return res.status(500).json({
            message: err.message
        })
    }
    res.order = order
    next()
}





module.exports = router