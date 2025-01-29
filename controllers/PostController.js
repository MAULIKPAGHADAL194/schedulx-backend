const { Post, SocialMedia, User, Analytics } = require("../models/index.js");
const { checkFileExists } = require('../utils/fileUtils');
const path = require('path');
const axios = require('axios');
const { TwitterApi } = require("twitter-api-v2");
const redisClient = require("../utils/Redis.js");
const CACHE_EXPIRY = 3600;

const PostAdd = async (req, res) => {
    try {
        const {
            userId,
            socialMediaId,
            postId,
            platformSpecific,
            status,
            scheduledTime,
        } = req.body;

        if (req.user._id !== userId) {
            return res.status(403).json({ success: false, error: "User not found" });
        }
        const findUser = await User.findById(req.user._id);

        const socialMedia = await SocialMedia.find({ _id: socialMediaId, userId: userId });

        if (!socialMedia) {
            return res.status(404).json({ success: false, error: "Social media not found" });
        }

        // Validate media files
        const platforms = ['instagram', 'xtwitter', 'pinterest', 'linkedin'];
        for (const platform of platforms) {
            if (platformSpecific?.[platform]?.mediaUrls) {
                const mediaUrls = platformSpecific[platform].mediaUrls;
                for (const mediaUrl of mediaUrls) {
                    const cleanMediaUrl = mediaUrl.replace(/^uploads[\/\\]/, '');
                    const filePath = path.join(__dirname, '../uploads', cleanMediaUrl);
                    const exists = await checkFileExists(filePath);
                    if (!exists) {
                        return res.status(400).json({
                            success: false,
                            error: `Media file ${mediaUrl} not found in uploads folder`
                        });
                    }
                }
            }
        }

        const createdPosts = [];

        // Post to LinkedIn if data exists
        if (platformSpecific.linkedin) {
            const linkedinPost = {
                userId: userId, // Include userId here
                platformSpecific: { linkedin: platformSpecific.linkedin }, // Include platformSpecific data
                createdBy: req.user.name,
                status,
                scheduledTime,
            };
            const linkedinDetail = await Post.create(linkedinPost);
            await Analytics.create({
                postId: linkedinDetail._id,
                socialMediaId: linkedinDetail.platformSpecific.linkedin.socialMediaId,
                userId: linkedinDetail.userId,
                platformSpecificPostId: linkedinDetail.platformSpecific.linkedin._id, // Use linkedinDetail instead
            });
            createdPosts.push({ ...linkedinDetail.toObject(), platform: 'LinkedIn' });
        }

        // Post to Twitter if data exists
        if (platformSpecific.xtwitter) {
            const twitterPost = {
                userId: userId, // Include userId here
                platformSpecific: { xtwitter: platformSpecific.xtwitter }, // Include platformSpecific data
                createdBy: req.user.name,
                status,
                scheduledTime,
            };
            const twitterDetail = await Post.create(twitterPost);
            await Analytics.create({
                postId: twitterDetail._id,
                socialMediaId: twitterDetail.platformSpecific.xtwitter.socialMediaId,
                userId: twitterDetail.userId,
                platformSpecificPostId: twitterDetail.platformSpecific.xtwitter._id, // Use linkedinDetail instead
            });
            createdPosts.push({ ...twitterDetail.toObject(), platform: 'xtwitter' });
        }

        // Emit notification for each created post
        createdPosts.forEach(post => {
            global.io.to(findUser._id.toString()).emit("notification", {
                message: `${req.user.name} has created a new post on ${post.platform} successfully.`,
                receiverId: findUser._id,
            });
        });

        return res.status(200).json({ success: true, data: createdPosts });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

const PostsGet = async (req, res) => {
    try {
        const { status, platformName } = req.query;

        // Prepare filters
        const userId = req.user._id;
        const filter = { userId, ...(status && { status }) };
        const socialMediaFilter = { userId, ...(platformName && { platformName }) };

        const cacheKey = `posts_${userId}_${status || ''}_${platformName || ''}`;
        const cachedPosts = await redisClient.get(cacheKey);

        // Fetch user social media accounts
        const socialMediaAccounts = await SocialMedia.find(socialMediaFilter)
            .select('-createdAt -updatedAt -__v -lastModifiedBy -accessToken -accessSecret');

        if (!socialMediaAccounts.length) {
            return res.status(404).json({ success: false, message: "No social media accounts found." });
        }

        // Fetch posts and analytics
        const allPosts = await Post.find({
            ...filter,
            $or: socialMediaAccounts.map(({ platformName, _id }) => ({
                [`platformSpecific.${platformName.toLowerCase() === 'xtwitter' ? 'xtwitter' : platformName.toLowerCase()}.socialMediaId`]: _id
            }))
        }).select('-createdAt -updatedAt -__v -lastModifiedBy');

        const analytics = await Analytics.find({
            postId: { $in: allPosts.map(post => post._id) }
        }).select('-createdAt -updatedAt -__v');

        const analyticsMap = analytics.reduce((acc, item) => {
            acc[item.postId] = [...(acc[item.postId] || []), item];
            return acc;
        }, {});

        // Map posts with analytics by social media account
        const postsBySocialMediaId = socialMediaAccounts.map(account => {
            const posts = allPosts.filter(post =>
                Object.values(post.platformSpecific || {}).some(data =>
                    data?.socialMediaId?.toString() === account._id.toString()
                )
            ).map(post => ({
                ...post.toObject(),
                analytics: analyticsMap[post._id] || [],
            }));



            // Only return account if it has posts
            return posts.length > 0 ? { ...account.toObject(), posts } : null;
        }).filter(Boolean); // Filter out null values
        await redisClient.set(cacheKey, JSON.stringify(postsBySocialMediaId), { EX: CACHE_EXPIRY });
        res.status(200).json({ success: true, data: postsBySocialMediaId });
    } catch (error) {
        console.error('PostsGet Error:', error);
        res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
};

const PostGet = async (req, res) => {
    try {
        let { id } = req.params;

        const cacheKey = `post_${id}`;
        const cachedPost = await redisClient.get(cacheKey);

        const detail = await Post.findById(id);

        await redisClient.set(cacheKey, JSON.stringify(detail), { EX: CACHE_EXPIRY });

        return res.status(200).json({ success: true, data: detail });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

const PostUpdate = async (req, res) => {
    try {
        let { id } = req.params

        const findUser = await User.findById(req.user._id);


        const existingPost = await Post.findById(id);

        if (!existingPost) {
            return res.status(404).json({
                success: false,
                error: "Post not found"
            });
        }

        if (existingPost.status !== "draft" && !(existingPost.status === "scheduled" && existingPost.scheduledTime > new Date())) {
            return res.status(403).json({
                success: false,
                error: "Only draft posts or scheduled posts with future times can be updated"
            });
        }

        const platforms = ['instagram', 'xtwitter', 'pinterest', 'linkedin'];
        for (const platform of platforms) {
            if (req.body.platformSpecific?.[platform]?.mediaUrls) {
                const mediaUrls = req.body.platformSpecific[platform].mediaUrls;
                for (const mediaUrl of mediaUrls) {
                    const cleanMediaUrl = mediaUrl.replace(/^uploads[\/\\]/, '');
                    const filePath = path.join(__dirname, '../uploads', cleanMediaUrl);
                    const exists = await checkFileExists(filePath);
                    if (!exists) {
                        return res.status(400).json({
                            success: false,
                            error: `Media file ${mediaUrl} not found in uploads folder`
                        });
                    }
                }
            }
        }

        const updatedPost = await Post.findByIdAndUpdate(
            id,
            {
                'platformSpecific.instagram.postType': req.body.platformSpecific?.instagram?.postType,
                'platformSpecific.instagram.hashtags': req.body.platformSpecific?.instagram?.hashtags,
                'platformSpecific.instagram.mentions': req.body.platformSpecific?.instagram?.mentions,
                'platformSpecific.instagram.location': req.body.platformSpecific?.instagram?.location,
                'platformSpecific.instagram.stickers': req.body.platformSpecific?.instagram?.stickers,
                'platformSpecific.instagram.firstComment': req.body.platformSpecific?.instagram?.firstComment,
                'platformSpecific.xtwitter.text': req.body.platformSpecific?.xtwitter?.text,
                'platformSpecific.xtwitter.hashtags': req.body.platformSpecific?.xtwitter?.hashtags,
                'platformSpecific.xtwitter.mentions': req.body.platformSpecific?.xtwitter?.mentions,
                'platformSpecific.xtwitter.mediaUrls': req.body.platformSpecific?.xtwitter?.mediaUrls,
                'platformSpecific.xtwitter.isThread': req.body.platformSpecific?.xtwitter?.isThread,
                'platformSpecific.xtwitter.firstComment': req.body.platformSpecific?.xtwitter?.firstComment,
                'platformSpecific.pinterest.title': req.body.platformSpecific?.pinterest?.title,
                'platformSpecific.pinterest.description': req.body.platformSpecific?.pinterest?.description,
                'platformSpecific.pinterest.mediaUrls': req.body.platformSpecific?.pinterest?.mediaUrls,
                'platformSpecific.pinterest.destinationLink': req.body.platformSpecific?.pinterest?.destinationLink,
                'platformSpecific.pinterest.boardName': req.body.platformSpecific?.pinterest?.boardName,
                'platformSpecific.linkedin.content': req.body.platformSpecific?.linkedin?.content,
                'platformSpecific.linkedin.mediaUrls': req.body.platformSpecific?.linkedin?.mediaUrls,
                'platformSpecific.linkedin.altText': req.body.platformSpecific?.linkedin?.altText,
                'platformSpecific.linkedin.firstComment': req.body.platformSpecific?.linkedin?.firstComment,
                'platformSpecific.linkedin.hashtags': req.body.platformSpecific?.linkedin?.hashtags,
                'scheduledTime': req.body.scheduledTime,
                'status': req.body.status,
            },
            { new: true }
        );

        global.io.to(findUser._id.toString()).emit("notification", {
            message: `${req.user.name} has successfully updated a post.`,
            receiverId: findUser._id,
        });
        return res.status(200).json({
            success: true,
            data: updatedPost
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message })
    }
};

const PostDelete = async (req, res) => {
    try {
        let { id } = req.params;

        const findUser = await User.findById(req.user._id);

        const PostDetail = await Post.findById(id);
        if (!PostDetail) {
            return res.status(404).json({ success: false, message: "Post Data not Found!" });
        }

        const user = await User.findById(PostDetail.userId);
        const socialMediaAccounts = await SocialMedia.find({
            $or: [
                ...(PostDetail.platformSpecific.instagram?.socialMediaId ? [{ _id: PostDetail.platformSpecific.instagram.socialMediaId }] : []),
                ...(PostDetail.platformSpecific.xtwitter?.socialMediaId ? [{ _id: PostDetail.platformSpecific.xtwitter.socialMediaId }] : []),
                ...(PostDetail.platformSpecific.pinterest?.socialMediaId ? [{ _id: PostDetail.platformSpecific.pinterest.socialMediaId }] : []),
                ...(PostDetail.platformSpecific.linkedin?.socialMediaId ? [{ _id: PostDetail.platformSpecific.linkedin.socialMediaId }] : [])
            ]
        });

        if (!user || !socialMediaAccounts.length) {
            return res.status(404).json({ success: false, message: "User or social media account not found" });
        }

        // Handle LinkedIn deletion
        if (PostDetail.status === 'posted' && socialMediaAccounts.some(account => account.platformName === "linkedin")) {
            const headers = { Authorization: `Bearer ${socialMediaAccounts[0].accessToken}` };
            await axios.delete(`${process.env.LINKEDINAPI_BASE_URL}/ugcPosts/${PostDetail.platformSpecific.linkedin.postId}`, { headers });
        }

        // Handle Twitter deletion
        if (PostDetail.status === 'posted' && socialMediaAccounts.some(account => account.platformName === "xtwitter")) {
            const twitterAccount = socialMediaAccounts.find(account => account.platformName === "xtwitter");
            if (twitterAccount) {
                const client = new TwitterApi({
                    appKey: process.env.TWITTERAPIKEY,
                    appSecret: process.env.TWITTERAPISECRET,
                    accessToken: twitterAccount.accessToken,
                    accessSecret: twitterAccount.accessSecret
                });

                await client.v2.deleteTweet(PostDetail.platformSpecific.xtwitter.postId);
            }
        }

        // Delete the post if it's a draft or if no social media accounts are linked
        const deletedPost = await Post.findByIdAndDelete(id);

        global.io.to(findUser._id.toString()).emit("notification", {
            message: `${user.name} has successfully deleted a post.`,
            receiverId: findUser._id,
        });

        return res.status(200).json({ success: true, message: "Draft post deleted successfully from database", data: deletedPost });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

const UpdateScheduleTime = async (req, res) => {
    try {
        const { scheduledTime, postId, socialMediaId, status } = req.body;
        const detail = await Post.findByIdAndUpdate(postId, { scheduledTime, status }, { new: true });
        return res.status(200).json({ success: true, data: detail })
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message })
    }
};

module.exports = { PostAdd, PostsGet, PostGet, PostUpdate, PostDelete, UpdateScheduleTime };
