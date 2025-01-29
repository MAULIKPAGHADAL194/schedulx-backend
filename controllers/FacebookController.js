const SocialMedia = require("../models/SocialMedia");
const fs = require("fs");
const path = require("path");

const facebookAdd = async (req, res) => {
    try {
        const { socialMediaEmail, displayName, socialMediaID, accessToken } =
            req.body;
        const findUser = await User.findById(req.user._id);

        const findSocialMediaAccount = await SocialMedia.find({
            platformName: "facebook",
            userId: req.user._id,
            socialMediaID: socialMediaID,
        });
        if (findSocialMediaAccount.length > 0) {
            const socialmediaAccountUpdate = await SocialMedia.findByIdAndUpdate(findSocialMediaAccount._id, {
                accessToken: accessToken,
                socialMediaEmail: socialMediaEmail,
                platformUserName: displayName,
                userId: req.user._id,
                socialMediaID: socialMediaID, //? insert sub id
                createdBy: displayName,
            }, { new: true });

            if (!socialmediaAccountUpdate) {
                return res.status(500).json({ message: "facebook not add" });

            }

            global.io.to(findUser._id.toString()).emit("notification", {
                message: `${displayName} has logged into Facebook successfully.`,
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
            socialMediaEmail: socialMediaEmail,
            platformName: "facebook",
            platformUserName: displayName,
            userId: req.user._id,
            socialMediaID: socialMediaID, //? insert sub id
            createdBy: displayName,
        });
        await socialmediaAccountAdd.save();

        if (!socialmediaAccountAdd) {
            return res.status(500).json({ message: "facebook not add" });

        }

        global.io.to(findUser._id.toString()).emit("notification", {
            message: `${displayName} has logged into Facebook successfully.`,
            receiverId: findUser._id,
        });

        return res.status(200).json({
            message: "Facebook Account Successfully Added",
            data: socialmediaAccountAdd,
        });
    } catch (error) {
        console.log("Error in authCheck controller", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    facebookAdd,
};
