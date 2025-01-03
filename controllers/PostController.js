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
            createdPosts.push(linkedinDetail);
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
            createdPosts.push(twitterDetail);
        }

        // Emit notification for each created post
        createdPosts.forEach(post => {
            global.io.emit('notification', {
                message: `${req.user.name} has created a new post on ${post.platform}`,
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
                    analytics: postAnalytics,
                    error: post.error
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

// const PostDelete = async (req, res) => {
//     try {
//         let { id } = req.params

//         const PostDetail = await Post.findById(id);

//         if (!PostDetail) {
//             return res.status(404).json({ success: false, message: "Post Data not Found!" });
//         }

//         const user = await User.findById(PostDetail.userId);

//         const socialMediaAccounts = await SocialMedia.find({
//             $or: [
//                 ...(PostDetail.platformSpecific.instagram?.socialMediaId ? [{ _id: PostDetail.platformSpecific.instagram.socialMediaId }] : []),
//                 ...(PostDetail.platformSpecific.xtwitter?.socialMediaId ? [{ _id: PostDetail.platformSpecific.xtwitter.socialMediaId }] : []),
//                 ...(PostDetail.platformSpecific.pinterest?.socialMediaId ? [{ _id: PostDetail.platformSpecific.pinterest.socialMediaId }] : []),
//                 ...(PostDetail.platformSpecific.linkedin?.socialMediaId ? [{ _id: PostDetail.platformSpecific.linkedin.socialMediaId }] : [])
//             ]
//         });

//         if (!user || !socialMediaAccounts) {
//             return res.status(404).json({ success: false, message: "User or social media account not found" });
//         }

//         if (PostDetail.status === 'posted' && socialMediaAccounts.platformName === "linkedin") {
//             const headers = {
//                 Authorization: `Bearer ${socialMediaAccounts.accessToken}`
//             }

//             await axios.delete(`${process.env.LINKEDINAPI_BASE_URL}/ugcPosts/${PostDetail.platformSpecific.linkedin.postId}`, { headers });

//             if (PostDetail.platformSpecific.xtwitter || PostDetail.platformSpecific.facebook || PostDetail.platformSpecific.instagram || PostDetail.platformSpecific.pinterest) {
//                 // Update post to remove Twitter data while keeping other platforms
//                 const updatedPost = await Post.findByIdAndUpdate(
//                     postId,
//                     {
//                         $unset: { 'platformSpecific.linkedin': 1 },
//                         $set: { 'platformSpecific': PostDetail.platformSpecific.filter(p => p !== 'linkedin') }
//                     },
//                     { new: true }
//                 );

//                 global.io.emit('notification', {
//                     message: `${name} has deleted a post`,
//                 });

//                 return res.status(200).json({
//                     success: true,
//                     message: "Linkedin content removed from multi-platform post",
//                     data: updatedPost,
//                 });
//             }

//             const deletedPost = await Post.findByIdAndDelete(id);

//             global.io.emit('notification', {
//                 message: `${user.name} has deleted a post`,
//             });

//             return res.status(200).json({
//                 success: true,
//                 message: "Draft post deleted successfully from database",
//                 data: deletedPost,
//             });
//         }

//         if (PostDetail.status === 'draft' && socialMediaAccounts.platformName === "linkedin") {
//             if (PostDetail.platformSpecific.xtwitter || PostDetail.platformSpecific.facebook || PostDetail.platformSpecific.instagram || PostDetail.platformSpecific.pinterest) {
//                 // Update post to remove Twitter data while keeping other platforms
//                 const updatedPost = await Post.findByIdAndUpdate(
//                     id,
//                     {
//                         $unset: { 'platformSpecific.linkedin': 1 },
//                     },
//                     { new: true }
//                 );

//                 global.io.emit('notification', {
//                     message: `${user.name} has deleted a post`,
//                 });

//                 return res.status(200).json({
//                     success: true,
//                     message: "Linkedin content removed from multi-platform post",
//                     data: updatedPost,
//                 });
//             }

//             const deletedPost = await Post.findByIdAndDelete(id);

//             global.io.emit('notification', {
//                 message: `${user.name} has deleted a post`,
//             });

//             return res.status(200).json({
//                 success: true,
//                 message: "Draft post deleted successfully from database",
//                 data: deletedPost,
//             });
//         }

//         if (PostDetail.status === 'posted' && socialMediaAccounts.platformName === "xtwitter") {

//             const client = new TwitterApi({
//                 appKey: process.env.TWITTERAPIKEY,
//                 appSecret: process.env.TWITTERAPISECRET,
//                 accessToken: socialMediaAccounts.accessToken,
//                 accessSecret: socialMediaAccounts.accessSecret
//             }).readWrite;

//             await client.v2.deleteTweet(PostDetail.platformSpecific.xtwitter.postId);
//             if (PostDetail.platformSpecific.linkedin || PostDetail.platformSpecific.facebook || PostDetail.platformSpecific.instagram || PostDetail.platformSpecific.pinterest) {
//                 // Update post to remove Twitter data while keeping other platforms
//                 const updatedPost = await Post.findByIdAndUpdate(
//                     id,
//                     {
//                         $unset: { 'platformSpecific.xtwitter': 1 },
//                     },
//                     { new: true }
//                 );

//                 global.io.emit('notification', {
//                     message: `${user.name} has deleted a post`,
//                 });

//                 return res.status(200).json({
//                     success: true,
//                     message: "Twitter content removed from multi-platform post",
//                     data: updatedPost,
//                 });
//             }
//             const deletedPost = await Post.findByIdAndDelete(id);

//             global.io.emit('notification', {
//                 message: `${user.name} has deleted a post`,
//             });

//             return res.status(200).json({
//                 success: true,
//                 message: "Draft post deleted successfully from database",
//                 data: deletedPost,
//             });
//         }

//         if (PostDetail.status === 'draft' && socialMediaAccounts.platformName === "xtwitter") {
//             if (PostDetail.platformSpecific.linkedin || PostDetail.platformSpecific.facebook || PostDetail.platformSpecific.instagram || PostDetail.platformSpecific.pinterest) {
//                 // Update post to remove Twitter data while keeping other platforms
//                 const updatedPost = await Post.findByIdAndUpdate(
//                     id,
//                     {
//                         $unset: { 'platformSpecific.xtwitter': 1 },
//                     },
//                     { new: true }
//                 );

//                 global.io.emit('notification', {
//                     message: `${user.name} has deleted a post`,
//                 });

//                 return res.status(200).json({
//                     success: true,
//                     message: "Twitter content removed from multi-platform post",
//                     data: updatedPost,
//                 });
//             }
//             const deletedPost = await Post.findByIdAndDelete(id);

//             global.io.emit('notification', {
//                 message: `${user.name} has deleted a post`,
//             });

//             return res.status(200).json({
//                 success: true,
//                 message: "Draft post deleted successfully from database",
//                 data: deletedPost,
//             });
//         }

//     } catch (error) {
//         return res.status(500).json({ success: false, error: error.message })
//     }
// };

const PostDelete = async (req, res) => {
    try {
        let { id } = req.params;

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

        const platformActions = {
            linkedin: async () => {
                const headers = { Authorization: `Bearer ${socialMediaAccounts.accessToken}` };
                await axios.delete(`${process.env.LINKEDINAPI_BASE_URL}/ugcPosts/${PostDetail.platformSpecific.linkedin.postId}`, { headers });
                return await Post.findByIdAndUpdate(id, { $unset: { 'platformSpecific.linkedin': 1 } }, { new: true });
            },
            xtwitter: async () => {
                const client = new TwitterApi({
                    appKey: process.env.TWITTERAPIKEY,
                    appSecret: process.env.TWITTERAPISECRET,
                    accessToken: socialMediaAccounts.accessToken,
                    accessSecret: socialMediaAccounts.accessSecret
                }).readWrite;
                await client.v2.deleteTweet(PostDetail.platformSpecific.xtwitter.postId);
                return await Post.findByIdAndUpdate(id, { $unset: { 'platformSpecific.xtwitter': 1 } }, { new: true });
            }
        };

        const action = PostDetail.status === 'posted' ? platformActions[Object.keys(platformActions).find(key => socialMediaAccounts.platformName === key)] : null;

        if (action) {
            const updatedPost = await action();
            global.io.emit('notification', { message: `${user.name} has deleted a post` });
            return res.status(200).json({ success: true, message: `${action.name} content removed from multi-platform post`, data: updatedPost });
        }

        const deletedPost = await Post.findByIdAndDelete(id);
        global.io.emit('notification', { message: `${user.name} has deleted a post` });
        return res.status(200).json({ success: true, message: "Draft post deleted successfully from database", data: deletedPost });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
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
