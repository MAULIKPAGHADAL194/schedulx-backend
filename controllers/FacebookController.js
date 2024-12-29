const SocialMedia = require("../models/SocialMedia");
// const { FacebookApi } = require("facebook-api-v2");
const fs = require("fs");
const path = require("path");
const axios = require('axios');
const qs = require('querystring');

const facebookAdd = async (req, res) => {
    try {

        const { socialMediaEmail, displayName, socialMediaID, accessToken } = req.body;

        const findSocialMediaAccount = await SocialMedia.findOne({
            platformName: "facebook",
            userId: req.user._id,
            socialMediaID: socialMediaID,
        });
        if (findSocialMediaAccount) {

            findSocialMediaAccount.accessToken = accessToken;
            findSocialMediaAccount.platformUserName = displayName;

            await findSocialMediaAccount.save();

            global.io.emit('notification', {
                message: `${displayName} has logged in into facebook`,
            });

            return res.status(200).json({
                success: true,
                message: "Social media account updated successfully",
                data: findSocialMediaAccount,
            });
        }

        const socialmediaAccountAdd = new SocialMedia({
            accessToken: accessToken,
            socialMediaEmail: socialMediaEmail,
            platformName: 'facebook',
            platformUserName: displayName,
            userId: req.user._id,
            socialMediaID: socialMediaID, //? insert sub id
            createdBy: displayName,
        });

        global.io.emit('notification', {
            message: `${displayName} has logged in into facebook`,
        });

        await socialmediaAccountAdd.save();

        // User is already authenticated
        return res.status(200).json({
            message: "Facebook Account Successfully Added",
            data: socialmediaAccountAdd,
        });

    } catch (error) {
        console.log("Error in authCheck controller", error.message);
        return res.status(500).json({ message: "Internal server error" });

    }
}
const successFacebookLogin = async (req, res) => {
    try {
        if (!req.user) {
            res.redirect('/failure');
        }

        const { emails, displayName, id, provider, accessToken } = req.user;
        const findSocialMediaAccount = await SocialMedia.findOne({
            platformName: provider,
            socialMediaID: id,
        });
        if (findSocialMediaAccount) {

            findSocialMediaAccount.accessToken = accessToken;
            findSocialMediaAccount.platformUserName = displayName;

            await findSocialMediaAccount.save();

            global.io.emit('notification', {
                message: `${displayName} has logged in`,
            });

            return res.status(200).json({
                success: true,
                message: "Social media account updated successfully",
                data: findSocialMediaAccount,
            });
        }

        const socialmediaAccountAdd = new SocialMedia({
            accessToken: accessToken,
            socialMediaEmail: emails[0].value,
            platformName: provider,
            platformUserName: displayName,
            userId: "675afbb55243cfd7a7b5d70a",
            socialMediaID: id, //? insert sub id
            createdBy: displayName,
        });

        await socialmediaAccountAdd.save();

        global.io.emit('notification', {
            message: `${displayName} has logged in`,
        });

        // User is already authenticated
        return res.status(200).json({
            message: "User successfully login",
            data: socialmediaAccountAdd,
        });
    } catch (error) {
        console.log("Error in authCheck controller", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

const failureFacebookLogin = async (req, res) => {
    try {
        global.io.emit('notification', {
            message: `Error in facebook login`,
        });
        res.send("Error");
    } catch (error) {
        console.log("Error in authCheck controller", error.message);
        res.status(500).json({ message: "Internal server error", error: error });
    }
}

const facebookGet = async (req, res) => {
    try {
        const findSocialMediaAccount = await SocialMedia.find({
            platformName: "facebook",
        });
        res.status(200).json({ success: true, data: findSocialMediaAccount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const facebookPost = async (req, res) => {
    try {
        const { text } = req.body;
        const findSocialMediaAccount = await SocialMedia.findOne({ userId: req.user._id, platformName: "facebook" });

        if (!findSocialMediaAccount) {
            return res.status(404).json({ message: "Facebook account not found for this user." });
        }

        // Prepare post data
        let postData = {
            message: text,
            access_token: findSocialMediaAccount.accessToken
        };

        console.log(findSocialMediaAccount.socialMediaID);


        // Make the post request
        const postResponse = await axios.post(
            `https://graph.facebook.com/v21.0/${findSocialMediaAccount.socialMediaID}/feed`,
            qs.stringify({
                message: text,
                access_token: findSocialMediaAccount.accessToken
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        )

        if (postResponse.data && postResponse.data.id) {
            return res.status(200).json({
                success: true,
                message: "Posted successfully to Facebook",
                data: postResponse.data
            });
        } else {
            throw new Error("Failed to get post ID from Facebook response");
        }

    } catch (error) {
        console.error("Detailed error information:");

        // console.error("Facebook post error:", error);
        return res.status(500).json({
            success: false,
            message: "Error posting to Facebook",
            error: error
        });
    }
};

module.exports = {
    facebookAdd,
    successFacebookLogin,
    failureFacebookLogin,
    facebookPost,
    facebookGet
};
