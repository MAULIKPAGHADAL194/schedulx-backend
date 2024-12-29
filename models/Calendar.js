const { string } = require("joi");
const mongoose = require("mongoose");

const calendarSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    socialMediaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "socialmedia",
        required: true
    },
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "post",
        required: true
    },
    scheduledTime: {
        type: Date
    },
},
    { timestamps: true }
);

const Calendar = mongoose.model("calendar", calendarSchema);

module.exports = Calendar;
