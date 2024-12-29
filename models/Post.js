const mongoose = require("mongoose");

// Instagram Schema
const instagramSchema = new mongoose.Schema({
    postType: {
        type: String,
        enum: ["post", "reel", "story"],
        default: "post", // Default post type
    },
    postId: {
        type: String,
    },
    socialMediaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "socialMedia",
        required: true,
    },
    hashtags: {
        type: [String], // Example: ["#eco", "#hydrate"]
    },
    mentions: {
        type: [String], // Example: ["@user1", "@user2"]
    },
    location: {
        type: String,
    },
    stickers: {
        type: [String], // Example: ["music"]
    },

});

// Twitter Schema
const twitterSchema = new mongoose.Schema({
    text: {
        type: String,
    },
    postId: {
        type: String,
    },
    socialMediaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "socialMedia",
        required: true,
    },
    hashtags: {
        type: [String], // Example: ["#eco", "#hydrate"]
    },
    mentions: {
        type: [String], // Example: ["@user1", "@user2"]
    },
    mediaUrls: {
        type: [String],
    },
    isThread: {
        type: Boolean,
        default: false,
    },
    firstComment: {
        type: String,
    },
});

// Pinterest Schema
const pinterestSchema = new mongoose.Schema({
    title: {
        type: String,
    },
    socialMediaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "socialMedia",
        required: true,
    },
    postId: {
        type: String,
    },
    description: {
        type: String,
    },
    mediaUrls: {
        type: [String],
    },
    destinationLink: {
        type: String,
    },
    boardName: {
        type: String,
    },
});

// LinkedIn Schema
const linkedinSchema = new mongoose.Schema({
    content: {
        type: String,
    },
    socialMediaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "socialMedia",
        required: true,
    },
    postId: {
        type: String,
    },
    mediaUrls: {
        type: [String],
    },
    altText: {
        type: String,
    },
    firstComment: {
        type: String,
    },
    hashtags: {
        type: [String], // Example: ["#eco", "#hydrate"]
    },
});

// Main Post Schema
const postSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
        },
        platformSpecific: {
            instagram: instagramSchema,
            xtwitter: twitterSchema,
            pinterest: pinterestSchema,
            linkedin: linkedinSchema,
        },
        status: {
            type: String,
            enum: ["posted", "scheduled", "draft"],
            default: "scheduled",
        },
        scheduledTime: {
            type: Date,
            required: true,

        },
        error: {
            type: String,
        },
        createdBy: {
            type: String,
            required: true,
        },
        lastModifiedBy: {
            type: String,
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

const Post = mongoose.model("post", postSchema);

module.exports = Post;
