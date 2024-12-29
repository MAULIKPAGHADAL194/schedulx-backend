const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema({
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "post",
        required: true
    },
    socialMediaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "socialMedia",
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    platformSpecificPostId: {
        type: String,
        required: true
    },
    like: {
        type: Number,
        required: true,
        default: 0
    },
    comment: {
        type: Number,
        required: true,
        default: 0
    },
    share: {
        type: Number,
        required: true,
        default: 0
    },
    impressions: {
        type: Number,
        required: true,
        default: 0
    },
    engagements: {
        type: Number,
        required: true,
        default: 0
    },
},
    { timestamps: true }
);

const Analytics = mongoose.model("analytics", analyticsSchema);

module.exports = Analytics;
