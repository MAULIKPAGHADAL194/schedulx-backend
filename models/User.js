const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
        },
        password: {
            type: String,
            required: true,
        },
        phoneNumber: {
            type: Number,
        },
        resetPasswordExpires: {
            type: Date,
        },
        resetPasswordToken: {
            type: String,
        },
        thirdParty: {
            provider: {
                type: String,
                enum: ['google', 'facebook'],
            },
            providerid: {
                type: String,
            },
            sub: {
                type: String,
            }
        },
        role: {
            type: String,
            enum: ['Solopreneurs', 'SmallBusinessOwners', 'SocialMediaManagers', 'ContentCreators', 'MarketingProfessionals'],
        },
        weekStart: {
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            default: 'Sunday',
        },
        isActive: {
            type: Number,
            default: 1,
            enum: [0, 1],
        },
        createdBy: {
            type: String,
            required: true,
        },
        lastModifiedBy: {
            type: String,
        },
        twitter: {
            followers: {
                type: Number,
            },
            following: {
                type: Number,
            },
            tweets: {
                type: Number,
            },
            listed: {
                type: Number,
            },
            profileImage: {
                type: String,
            },
            location: {
                type: String,
            },
            createdAt: {
                type: Date,
            },
        },
    },
    { timestamps: true }
);

const user = mongoose.model("user", userSchema);

module.exports = user;
