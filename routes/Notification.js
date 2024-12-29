const express = require("express")
const { authMiddleware } = require("../middleware/authMiddleware")
const { createNotification, allNotification, singleNotification, updateNotification, deleteNotification } = require("../controllers/NotificationController")
const router = express.Router()


// Create Notification
router.post("/create" , authMiddleware , createNotification)

// All Notification
router.get("/allnotification" , authMiddleware , allNotification)

// Single Notification
router.get("/single-notification/:id" , authMiddleware , singleNotification)

// Update Notification
router.put("/update/:id" , authMiddleware , updateNotification)


// Delete Notification
router.delete("/delete/:id" , authMiddleware , deleteNotification)

module.exports = router