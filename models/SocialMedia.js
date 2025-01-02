const mongoose = require("mongoose");

const socialMediaSchema = new mongoose.Schema(
    {
        accessToken: {
            type: String,
        },
        accessSecret: {
            type: String,
        },
        platformName: {
            type: String,
            required: true,
        },
        socialMediaID: {
            type: String,
            required: true,
        },
        socialMediaEmail: {
            type: String,
        },
        platformUserName: {
            type: String,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
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
        timestamps: true,
    }
);

const SocialMedia = mongoose.model("socialMedia", socialMediaSchema);

module.exports = SocialMedia;
