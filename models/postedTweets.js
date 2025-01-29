const mongoose = require("mongoose");

const PostedTweetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    tweetId: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
});

const PostedTweets  = mongoose.model("PostedTweet", PostedTweetSchema);

module.exports = PostedTweets