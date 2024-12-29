const { TwitterApi } = require("twitter-api-v2");
const fs = require("fs");
const path = require("path");
const { User, SocialMedia, Post } = require("../models/index.js");

const twitterAdd = async (req, res) => {
    try {

        const { displayName, username, accessSecret, id, accessToken, socialMediaID } = req.body;

        const findSocialMediaAccount = await SocialMedia.findOne({
            platformName: "xtwitter",
            userId: req.user._id,
            socialMediaID: socialMediaID,
        });

        if (findSocialMediaAccount) {

            findSocialMediaAccount.accessToken = accessToken;
            findSocialMediaAccount.platformUserName = displayName;
            findSocialMediaAccount.accessSecret = accessSecret;

            await findSocialMediaAccount.save();

            global.io.emit('notification', {
                message: `${displayName} has logged in into xtwitter`,
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
            platformUserName: displayName,
            userId: req.user._id,
            socialMediaID: socialMediaID, //? insert sub id
            createdBy: displayName,
            accessSecret: accessSecret,
        });

        await socialmediaAccountAdd.save();

        global.io.emit('notification', {
            message: `${displayName} has logged in into xtwitter`,
        });

        // User is already authenticated
        return res.status(200).json({
            message: "Twitter Account Successfully Added",
            data: socialmediaAccountAdd,
        });

    } catch (error) {
        console.log("Error in authCheck controller", error.message);
        return res.status(500).json({ message: "Internal server error" });

    }
}

const twitterPost = async (req, res) => {
    try {
        const { tweetText } = req.body;
        const findSocialMediaAccount = await SocialMedia.findOne({ userId: req.user._id, platformName: "xtwitter" });

        if (!findSocialMediaAccount) {
            return res.status(404).json({ message: "Twitter account not found for this user." });
        }

        // Initialize a new Twitter client with user-specific tokens
        const userClient = new TwitterApi({
            appKey: process.env.TWITTERAPIKEY,
            appSecret: process.env.TWITTERAPISECRET,
            accessToken: findSocialMediaAccount.accessToken,
            accessSecret: findSocialMediaAccount.accessSecret,
        });


        const client = userClient.readWrite;

        let mediaData;
        if (req.file) { // Ensure the file is present
            const mediaFileBuffer = await fs.readFileSync(req.file.path);
            mediaData = await client.v1.uploadMedia(mediaFileBuffer, { type: 'image/jpeg' }); // Specify MIME type for images
        }

        // Create the tweet payload
        const tweetData = {
            text: tweetText,
        };

        if (mediaData) {
            // Attach the media_id_string from the media upload response
            tweetData.media = { media_ids: [mediaData] }; // Twitter expects an array of media_ids
        }

        // Post tweet using the v2 API
        const tweet = await client.v2.tweet(mediaData ? tweetData : { text: tweetText });

        if (tweet) {
            // console.log("tweet", tweet);
            const twitterPostAdd = new Post({
                userId: req.user._id,
                'platformSpecific.xtwitter.postId': tweet.data.id,
                'platformSpecific.xtwitter.mediaUrls': mediaData ? [mediaData] : [],
                'platformSpecific.xtwitter.text': tweetText
            });

            await twitterPostAdd.save();

            // console.log("Tweet successful:", twitterPostAdd);

            return res.status(200).json({ success: true, data: twitterPostAdd });
        } else {
            return res.status(500).json({ success: false, message: "Failed to post tweet" });
        }

    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: error.message, error: error });

    }
};

const twitterDelete = async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId, socialMediaId } = req.body;

        const user = await User.findById(userId);
        const socialMedia = await SocialMedia.findOne({
            _id: socialMediaId,
            userId: userId
        });

        if (!user || !socialMedia) {
            return res.status(404).json({ success: false, message: "User or social media account not found" });
        }


        const post = await Post.findOne({
            _id: postId,
            "platformSpecific.xtwitter.socialMediaId": socialMediaId,
            userId: userId
        });

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        if (post.status === 'posted') {
            const client = new TwitterApi({
                appKey: process.env.TWITTERAPIKEY,
                appSecret: process.env.TWITTERAPISECRET,
                accessToken: socialMedia.accessToken,
                accessSecret: socialMedia.accessSecret
            }).readWrite;

            await client.v2.deleteTweet(postId);
            if (post.platformSpecific.linkedin || post.platformSpecific.facebook || post.platformSpecific.instagram || post.platformSpecific.pinterest) {
                // Update post to remove Twitter data while keeping other platforms
                const updatedPost = await Post.findByIdAndUpdate(
                    postId,
                    {
                        $unset: { 'platformSpecific.xtwitter': 1 },
                    },
                    { new: true }
                );

                global.io.emit('notification', {
                    message: `${user.name} has deleted a post`,
                });

                return res.status(200).json({
                    success: true,
                    message: "Twitter content removed from multi-platform post",
                    data: updatedPost,
                });
            }
            const deletedPost = await Post.findByIdAndDelete(postId);

            global.io.emit('notification', {
                message: `${user.name} has deleted a post`,
            });

            return res.status(200).json({
                success: true,
                message: "Draft post deleted successfully from database",
                data: deletedPost,
            });
        }


        if (post.status === 'draft') {
            if (post.platformSpecific.linkedin || post.platformSpecific.facebook || post.platformSpecific.instagram || post.platformSpecific.pinterest) {
                // Update post to remove Twitter data while keeping other platforms
                const updatedPost = await Post.findByIdAndUpdate(
                    postId,
                    {
                        $unset: { 'platformSpecific.xtwitter': 1 },
                    },
                    { new: true }
                );

                global.io.emit('notification', {
                    message: `${user.name} has deleted a post`,
                });

                return res.status(200).json({
                    success: true,
                    message: "Twitter content removed from multi-platform post",
                    data: updatedPost,
                });
            }
            const deletedPost = await Post.findByIdAndDelete(postId);

            global.io.emit('notification', {
                message: `${user.name} has deleted a post`,
            });

            return res.status(200).json({
                success: true,
                message: "Draft post deleted successfully from database",
                data: deletedPost,
            });
        }

    } catch (error) {
        console.error("Error deleting tweet:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting tweet",
            error: error.message,
        });
    }
};

// twitterAnalytics from bhargav
const twitterAnalytics = async (req, res) => {
    try {
        const findSocialMediaAccount = await SocialMedia.findOne({
            userId: req.user._id,
            platformName: "xtwitter",
        });

        if (!findSocialMediaAccount) {
            return res
                .status(404)
                .json({ message: "Twitter account not found for this user." });
        }

        // Initialize a new Twitter client with user-specific tokens
        const twitterClient = new TwitterApi({
            appKey: process.env.TWITTERAPIKEY,
            appSecret: process.env.TWITTERAPISECRET,
            accessToken: findSocialMediaAccount.accessToken,
            accessSecret: findSocialMediaAccount.accessSecret,
        });

        // Attempt to fetch the user's tweets
        const { data: tweets, headers } = await twitterClient.v2.userTimeline(
            findSocialMediaAccount.socialMediaID,
            {
                max_results: 10,
                "tweet.fields": "public_metrics",
            }
        );

        return res.json({
            success: true,
            data: tweets,
        });
    } catch (error) {
        console.error("Error fetching Twitter posts:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const twitterUpdate = async (req, res) => {
    try {

        const { userId, socialMediaId, modelPostId, text, mediaUrls, isThread, firstComment, hashtags, status, scheduledTime } = req.body;

        const findUser = await User.findById(userId);

        if (!findUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const findSocialMediaAccount = await SocialMedia.findOne({
            platformName: "xtwitter",
            socialMediaID: socialMediaId,
            userId: findUser._id,
        });

        if (!findSocialMediaAccount) {
            return res.status(404).json({ success: false, message: "Social media account not found" });
        }

        const updatedPost = await Post.findOneAndUpdate(
            {
                platformSpecific: {
                    xtwitter: {
                        socialMediaId: findSocialMediaAccount._id,
                    }
                },
                userId: findUser._id,
                _id: modelPostId,
                status: 'draft',
            },
            {
                'platformSpecific.xtwitter.status': status,
                'platformSpecific.xtwitter.mediaUrls': mediaUrls,
                'platformSpecific.xtwitter.text': text,
                'platformSpecific.xtwitter.firstComment': firstComment,
                'platformSpecific.xtwitter.hashtags': hashtags,
                'platformSpecific.xtwitter.scheduledTime': scheduledTime,
                'platformSpecific.xtwitter.isThread': isThread,
            },
            { new: true }
        );

        if (!updatedPost) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        return res.status(200).json({ success: true, message: "Post is successfully updated", data: updatedPost });

    } catch (error) {
        console.error(error.message);
        return res
            .status(500)
            .json({ success: false, message: error.message, error: error });
    }
};

module.exports = {
    twitterAdd,
    twitterPost,
    twitterDelete,
    twitterAnalytics,
    twitterUpdate,
};
