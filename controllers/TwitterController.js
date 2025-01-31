const { TwitterApi } = require("twitter-api-v2");
const fs = require("fs");
const path = require("path");
const { User, SocialMedia, Post } = require("../models/index.js");

const twitterAdd = async (req, res) => {
    try {

        const { displayName, platformUserName, username, accessSecret, id, accessToken, socialMediaID } = req.body;

        const findUser = await User.findById(req.user._id);

        const findSocialMediaAccount = await SocialMedia.findOne({
            platformName: "xtwitter",
            userId: req.user._id,
        });

        if (findSocialMediaAccount) {

            findSocialMediaAccount.accessToken = accessToken;
            findSocialMediaAccount.platformUserName = platformUserName;
            findSocialMediaAccount.accessSecret = accessSecret;

            await findSocialMediaAccount.save();

            global.io.to(findUser._id.toString()).emit("notification", {
                message: `${displayName} has logged into X (formerly Twitter) successfully.`,
                receiverId: findUser._id,
            });
            return res.status(200).json({
                success: true,
                message: "Social media account updated successfully",
                data: findSocialMediaAccount,
            });
        }

        const socialmediaAccountAdd = new SocialMedia({
            accessToken: accessToken,
            platformName: "xtwitter",
            platformUserName: platformUserName,
            userId: req.user._id,
            socialMediaID: socialMediaID, //? insert sub id
            createdBy: displayName,
            accessSecret: accessSecret,
        });

        await socialmediaAccountAdd.save();

        global.io.to(findUser._id.toString()).emit("notification", {
            message: `${displayName} has logged into X (formerly Twitter) successfully.`,
            receiverId: findUser._id,
        });
        // User is already authenticated
        return res.status(200).json({
            message: "Twitter Account Successfully Added",
            data: socialmediaAccountAdd,
        });

    } catch (error) {
        console.log("Error in authCheck controller", error.message);
        return res.status(500).json({ message: "Internal server error",errorMessage:error.message,error:error.message });

    }
}

module.exports = {
    twitterAdd,
};
