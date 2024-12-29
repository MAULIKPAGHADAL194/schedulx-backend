const { Post, SocialMedia, User, Analytics } = require("../models/index.js");
const { checkFileExists } = require('../utils/fileUtils');
const path = require('path');

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

        const detail = await Post.create({ ...req.body, createdBy: req.user.name });

        global.io.emit('notification', {
            message: `${req.user.name} has created a new post`,
        });

        return res.status(200).json({ success: true, data: detail });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

const PostsGet = async (req, res) => {
    try {
        const { status, platformName } = req.query;

        let filter = { userId: req.user._id };
        filter = status ? { ...filter, status } : filter;

        // Filter social media accounts by platformName if specified
        const socialMediaFilter = { userId: req.user._id };
        if (platformName) {
            socialMediaFilter.platformName = platformName;
        }

        const findUserSocialMediaAccount = await SocialMedia.find(socialMediaFilter)
            .select('-createdAt -updatedAt -__v -lastModifiedBy -accessToken -accessSecret');

        if (!findUserSocialMediaAccount.length) {
            return res.status(404).json({
                success: false,
                message: "No social media accounts found for this user.",
            });
        }

        const allPosts = await Post.find({
            ...filter,
            $or: findUserSocialMediaAccount.map(account => ({
                [`platformSpecific.${account.platformName.toLowerCase() === 'xtwitter' ? 'xtwitter' : account.platformName.toLowerCase()}.socialMediaId`]: account._id
            }))
        }).select('-createdAt -updatedAt -__v -lastModifiedBy');

        const analytics = allPosts.length ? await Analytics.find({
            postId: { $in: allPosts.map(post => post._id) }
        }).select('-createdAt -updatedAt -__v') : [];

        // Create analytics lookup map
        const analyticsMap = analytics.reduce((acc, analytic) => {
            if (!acc[analytic.postId]) {
                acc[analytic.postId] = [];
            }
            acc[analytic.postId].push(analytic);
            return acc;
        }, {});

        const postsBySocialMediaId = allPosts.reduce((acc, post) => {
            if (!post?.platformSpecific) return acc;

            Object.entries(post.platformSpecific).forEach(([platform, data]) => {
                if (!data?.socialMediaId) return;

                const socialMediaIdStr = data.socialMediaId.toString();
                if (!acc[socialMediaIdStr]) {
                    acc[socialMediaIdStr] = [];
                }

                const platformSpecificId = data.postId || data.tweetId || data.id;

                const postAnalytics = [
                    ...(analyticsMap[post._id.toString()] || []),
                    ...(platformSpecificId ? (analyticsMap[platformSpecificId.toString()] || []) : [])
                ].filter(analytic => analytic?.socialMediaId?.toString() === socialMediaIdStr);

                acc[socialMediaIdStr].push({
                    _id: post._id,
                    userId: post.userId,
                    status: post.status,
                    scheduledTime: post.scheduledTime,
                    createdAt: post.createdAt,
                    platformSpecific: { [platform]: data },
                    analytics: postAnalytics
                });
            });
            return acc;
        }, {});

        // Map social media accounts with their posts
        const socialMediaWithPosts = findUserSocialMediaAccount.map(socialMedia => ({
            ...socialMedia.toObject(),
            posts: postsBySocialMediaId[socialMedia._id] || []
        }));

        return res.status(200).json({
            success: true,
            data: socialMediaWithPosts
        });
    } catch (error) {
        console.error('PostsGet Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

const PostGet = async (req, res) => {
    try {
        let { id } = req.params
        const detail = await Post.findById(id)
        return res.status(200).json({ success: true, data: detail })
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message })
    }
};

const PostUpdate = async (req, res) => {
    try {
        let { id } = req.params

        const existingPost = await Post.findById(id);

        if (!existingPost) {
            return res.status(404).json({
                success: false,
                error: "Post not found"
            });
        }

        // Check if post is in draft status
        if (existingPost.status !== "draft") {
            return res.status(403).json({
                success: false,
                error: "Only draft posts can be updated"
            });
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

        global.io.emit('notification', {
            message: `${req.user.name} has updated a post`,
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
        let { id } = req.params

        const detail = await Post.findByIdAndDelete(id)
        return res.status(200).json({ success: true, data: detail })
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message })
    }
};

const UpdateScheduleTime = async (req, res) => {
    try {
        const { scheduledTime, postId, socialMediaId } = req.body;
        const detail = await Post.findByIdAndUpdate(postId, { scheduledTime }, { new: true });
        return res.status(200).json({ success: true, data: detail })
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message })
    }
};

module.exports = { PostAdd, PostsGet, PostGet, PostUpdate, PostDelete, UpdateScheduleTime };
