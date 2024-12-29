const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    message: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["unread", "read"],
        required: true
    },
    action: {
        type: String,
        enum: ["reminder", "system"],
        required: true
    }
},
    { timestamps: true }
);

const Notification = mongoose.model("notification", notificationSchema);

module.exports = Notification;
