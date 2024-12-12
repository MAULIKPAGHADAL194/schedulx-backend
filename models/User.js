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
            unique: true,
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
        role: {
            type: String,
            enum: ['Solopreneurs', 'SmallBusinessOwners', 'SocialMediaManagers', 'ContentCreators', 'MarketingProfessionals'],
        },
        weekStart: {
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
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
    },
    { timestamps: true }
);

const user = mongoose.model("user", userSchema);

module.exports = user;
