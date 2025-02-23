const { Post, SocialMedia, Analytics, User } = require("../models/index.js");
const cron = require("node-cron");
const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs').promises;
const axios = require('axios');
const { v2: cloudinary } = require("cloudinary");
const path = require('path');

//! Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDNAME,
    api_key: process.env.CLOUDAPIKEY,
    api_secret: process.env.CLOUDAPISECRET,
});

// Validate cron job is running
function getCurrentISTTime() {
    return new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'long'
    });
}

function getCurrentISTDate() {
    return new Date(new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata'
    }));
}

let isCronRunning = false;
let isCronRunning2 = false;
let isCronRunning3 = false;

cron.schedule('*/1 * * * *', async () => {
    try {

        while (isCronRunning3 || isCronRunning2) {
            console.log('Waiting for the first cron job to complete...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        if (isCronRunning) {
            console.log('Previous cron job still running, skipping...');
            return;
        }

        isCronRunning = true;
        // console.log('Starting cron job at:', getCurrentISTTime());

        const posts = await Post.find({
            status: 'scheduled',
        });

        for (const post of posts) {
            try {
                if (post.scheduledTime <= getCurrentISTDate()) {
                    // Create an array to store platform processing promises
                    const platformPromises = [];

                    // Get all relevant social media accounts for this post
                    const platforms = ['instagram', 'xtwitter', 'pinterest', 'linkedin'];
                    const socialMediaIds = platforms
                        .map(platform => post.platformSpecific[platform]?.socialMediaId)
                        .filter(Boolean);

                    const socialMediaAccounts = await SocialMedia.find({
                        _id: { $in: socialMediaIds }
                    });


                    if (!socialMediaAccounts || socialMediaAccounts.length === 0) {
                        console.log(`No social media accounts found for post ${post._id}`);
                        continue;
                    }

                    // Process each social media account
                    for (const socialMedia of socialMediaAccounts) {
                        // Check if media exists before processing
                        if (socialMedia.platformName.toLowerCase() === 'xtwitter') {
                            console.log("Calling processTwitterPost");
                            platformPromises.push(processTwitterPost(post, socialMedia));
                        } else if (socialMedia.platformName.toLowerCase() === 'linkedin') {
                            console.log("Calling processLinkedinPost");
                            platformPromises.push(processLinkedinPost(post, socialMedia));
                        }
                    }

                    // Wait for all platform posts to complete
                    await Promise.all(platformPromises);
                }
            } catch (postError) {
                console.log(`Error processing post ${post._id}:`);
                console.log(`Error processing post ${post._id}:`, postError.message);

                // Update post status to failed
                await Post.findByIdAndUpdate(post._id, {
                    status: 'failed',
                    error: postError.message
                });
            }
        }

    } catch (error) {
        console.log('Critical error in cron job:', error.message);
    } finally {
        isCronRunning = false;
        // console.log('Cron job completed at:', getCurrentISTTime());
    }
});

async function processTwitterPost(post, socialMedia) {
    try {
        // Initialize a new Twitter client with user-specific tokens
        const userClient = new TwitterApi({
            appKey: process.env.TWITTERAPIKEY,
            appSecret: process.env.TWITTERAPISECRET,
            accessToken: socialMedia.accessToken,
            accessSecret: socialMedia.accessSecret,
        });

        // Use readWrite instead of v2 to access all necessary methods
        const client = userClient.readWrite;

        let mediaData = [];
        let cloudinaryUrl;

        if (post.platformSpecific.xtwitter?.mediaUrls && post.platformSpecific.xtwitter.mediaUrls.length > 0) {
            for (const mediaPath of post.platformSpecific.xtwitter.mediaUrls) {
                const mediaFileBuffer = await fs.readFile(mediaPath);

                const cloudinaryResult = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload(mediaPath, { resource_type: "auto" }, (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    });
                });

                cloudinaryUrl = cloudinaryResult.secure_url;

                // Determine media type from file extension
                const fileExtension = mediaPath.split('.').pop().toLowerCase();
                const mimeType = fileExtension === 'mp4' ? 'video/mp4' : 'image/jpeg';

                // Upload media using v1 endpoint
                const uploadedMedia = await client.v1.uploadMedia(mediaFileBuffer, {
                    type: mimeType,
                    mimeType: mimeType
                });

                mediaData.push(uploadedMedia);

                const isMediaUsedInOtherPosts = await checkMediaUsage(mediaPath);
                if (!isMediaUsedInOtherPosts) {
                    fs.unlink(mediaPath, (err) => {
                        if (err) {
                            // console.log(`Error removing file: ${err}`);
                            return;
                        }

                        console.log(`File ${mediaPath} has been successfully removed.`);
                    });
                }
            }
        }

        const hashtags = post.platformSpecific.xtwitter.hashtags || [];
        const hashtagText = hashtags.map((tag) => `#${tag}`).join(' ');

        const mentions = post.platformSpecific.xtwitter.mentions || [];
        const mentionText = mentions.map((mention) => `@${mention}`).join(' ');

        const tweetData = {
            text: `${post.platformSpecific.xtwitter.text} ${hashtagText} ${mentionText}`.trim(),
        };

        if (mediaData.length > 0) {
            tweetData.media = { media_ids: mediaData };
        }

        // Post tweet using the v2 API
        const tweet = await client.v2.tweet(tweetData);
        console.log('Tweet Posted Successfully:', tweet);

        if (!tweet) {
            throw new Error("Failed to post tweet", postData);
        }

        // Handle first comment if present
        if (post.platformSpecific.xtwitter.firstComment && tweet.data.id) {
            const tweetComment = await client.v2.tweet({
                text: post.platformSpecific.xtwitter.firstComment,
                reply: {
                    in_reply_to_tweet_id: tweet.data.id
                }
            });
            if (!tweetComment) {
                throw new Error("Failed to post comment", postData);
            }
        }

        if (tweet) {
            const twitterPostAdd = await Post.findByIdAndUpdate(post._id, {
                status: 'posted',
                lastModifiedBy: post.createdBy,
                'platformSpecific.xtwitter.postId': tweet.data.id,
                'platformSpecific.xtwitter.mediaUrls': cloudinaryUrl ? [cloudinaryUrl] : [],
                'platformSpecific.xtwitter.text': post.platformSpecific.xtwitter.text,
                'platformSpecific.xtwitter.hashtags': hashtags,
                'platformSpecific.xtwitter.mentions': mentions
            }, { new: true });

            if (!twitterPostAdd) {
                throw new Error('Failed to update post status in database');
            }

            await Analytics.create({
                postId: twitterPostAdd._id,
                socialMediaId: socialMedia._id,
                userId: post.userId,
                platformSpecificPostId: twitterPostAdd.platformSpecific.xtwitter._id,
            });

            const findUser = await User.findById(post.userId);

            global.io.to(findUser._id.toString()).emit("notification", {
                message: `Post successfully uploaded to Twitter under the username ${socialMedia.platformUserName ?? socialMedia.platformUserName}`,
                receiverId: findUser._id,
            });

            console.log({ success: true, data: twitterPostAdd });
        } else {
            throw new Error("Failed to post tweet");
        }

    } catch (error) {
        console.error('Twitter post processing error:', {
            postId: post._id,
            message: error.message,
            error: error,
        });
    }
}

async function processLinkedinPost(post, socialMedia) {
    try {
        const userInfoResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${socialMedia.accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });

        // if (userInfoResponse) {
        //     console.log("userProfile", userInfoResponse.data);
        // }
        // else {
        //     console.log("userProfile not found ");
        // }

        const headers = {
            Authorization: `Bearer ${socialMedia.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        };

        let mediaAsset = null;
        let mediaType = null;
        let cloudinaryUrl;

        // Handle media upload if mediaType and filePath are provided
        if (post.platformSpecific.linkedin?.mediaUrls?.length > 0) {

            const filePath = post.platformSpecific.linkedin.mediaUrls[0];
            // Fix: Get mediaType from the file mimetype
            const fileExtension = path.extname(filePath).toLowerCase();
            mediaType = fileExtension === '.mp4' ? 'video' : 'image';

            // Upload to Cloudinary first
            const cloudinaryResult = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload(filePath, { resource_type: "auto" }, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });

            cloudinaryUrl = cloudinaryResult.secure_url;

            // Step 1: Register media upload
            const registerResponse = await axios.post(
                `${process.env.LINKEDINAPI_BASE_URL}/assets?action=registerUpload`,
                {
                    registerUploadRequest: {
                        recipes: [`urn:li:digitalmediaRecipe:${mediaType === 'image' ? 'feedshare-image' : 'feedshare-video'}`],
                        owner: `urn:li:person:${socialMedia.socialMediaID}`,
                        serviceRelationships: [
                            { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
                        ],
                    },
                },
                { headers }
            );


            const uploadUrl = registerResponse.data.value.uploadMechanism[
                'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
            ].uploadUrl;

            mediaAsset = registerResponse.data.value.asset;

            // Check if uploadUrl and asset exist
            if (!uploadUrl || !mediaAsset) {
                console.log({ success: false, message: 'Error registering media upload.' });
            }

            // Step 2: Upload the media file
            const file = await fs.readFile(filePath);

            await axios.put(uploadUrl, file, {
                headers: { 'Content-Type': 'application/octet-stream' },
            });

            const isMediaUsedInOtherPosts = await checkMediaUsage(filePath);
            if (!isMediaUsedInOtherPosts) {
                fs.unlink(filePath, (err) => {
                    if (err) {
                        // console.log(`Error removing file: ${err}`);
                        return;
                    }

                    console.log(`File ${filePath} has been successfully removed.`);
                });
            }
        }

        // Step 3: Create the post
        const postBody = {
            author: `urn:li:person:${socialMedia.socialMediaID}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: { text: post.platformSpecific.linkedin.content },
                    shareMediaCategory: mediaType ? (mediaType === 'image' ? 'IMAGE' : 'VIDEO') : 'NONE',
                    media: mediaAsset
                        ? [
                            {
                                status: 'READY',
                                media: mediaAsset,
                                description: { text: 'Uploaded via API' },
                                title: { text: 'My Media Post' },
                            },
                        ]
                        : [],
                },
            },
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        };

        const response = await axios.post(`${process.env.LINKEDINAPI_BASE_URL}/ugcPosts`, postBody, { headers });

        // console.log('Post body:', postBody, response.data.id);
        if (response.data && response.data.id) {
            const linkedinPostAdd = await Post.findByIdAndUpdate(post._id, {
                status: 'posted',
                lastModifiedBy: post.createdBy,
                'platformSpecific.linkedin.postId': response.data.id,
                'platformSpecific.linkedin.mediaUrls': cloudinaryUrl ? [cloudinaryUrl] : [],
                'platformSpecific.linkedin.content': post.platformSpecific.linkedin.content
            }, { new: true });

            if (!linkedinPostAdd) {
                throw new Error('Failed to update post status in database');
            }
            const findUser = await User.findById(post.userId);
            global.io.to(findUser._id.toString()).emit("notification", {
                message: `Post successfully uploaded to LinkedIn under the username ${socialMedia.platformUserName ?? socialMedia.platformUserName}`,
                receiverId: findUser._id,
            });

            console.log({ success: true, data: linkedinPostAdd });
        } else {
            console.log({ success: false, message: "Failed to post linkedin post" });
        }
    } catch (error) {
        console.error('LinkedIn post processing error:', {
            postId: post._id,
            error: error.message,
            stack: error.stack
        });
    }
};

cron.schedule('*/20 * * * *', async () => {
    try {
        while (isCronRunning) {
            console.log('Waiting for the first cron job to complete...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        if (isCronRunning2) {
            console.log('Second cron job still running, skipping...');
            return;
        }

        isCronRunning2 = true;

        const posts = await Post.find({
            status: 'posted',
            'platformSpecific.xtwitter.postId': { $exists: true }
        });

        // Group posts by socialMediaId
        const postsBySocialMedia = {};
        for (const post of posts) {
            if (post.platformSpecific.xtwitter.socialMediaId) {
                if (!postsBySocialMedia[post.platformSpecific.xtwitter.socialMediaId]) {
                    postsBySocialMedia[post.platformSpecific.xtwitter.socialMediaId] = [];
                }
                postsBySocialMedia[post.platformSpecific.xtwitter.socialMediaId].push(post);
            }
        }

        // Process each social media account once
        for (const socialMediaId of Object.keys(postsBySocialMedia)) {
            try {
                const socialMedia = await SocialMedia.findById(socialMediaId);

                if (!socialMedia) {
                    console.log(`Social media not found for ID ${socialMediaId}`);
                    continue;
                }

                if (socialMedia.platformName.toLowerCase() === 'xtwitter') {
                    // Pass all posts for this social media account
                    await twitterAnalytics(postsBySocialMedia[socialMediaId], socialMedia);
                }
            } catch (error) {
                console.log(`Error processing social media ${socialMediaId}:`, error.message);
            }
        }
    } catch (error) {
        console.log('Critical error in cron job:', error.message);
    } finally {
        isCronRunning2 = false;
    }
});

async function twitterAnalytics(posts, socialMedia) {
    try {
        console.log(`[${getCurrentISTTime()}] Starting Twitter analytics fetch for ${posts.length} posts`);

        const twitterClient = new TwitterApi({
            appKey: process.env.TWITTERAPIKEY,
            appSecret: process.env.TWITTERAPISECRET,
            accessToken: socialMedia.accessToken,
            accessSecret: socialMedia.accessSecret,
        });

        const userDetails = await twitterClient.v2.user(socialMedia.socialMediaID, {
            "user.fields": ["public_metrics", "description", "created_at", "profile_image_url", "location"]
        });

        if (userDetails.data) {
            // Log user details
            console.log("User Details:", {
                username: userDetails.data.username,
                metrics: {
                    followers: userDetails.data.public_metrics.followers_count,
                    following: userDetails.data.public_metrics.following_count,
                    tweets: userDetails.data.public_metrics.tweet_count,
                    listed: userDetails.data.public_metrics.listed_count
                },
                profileImage: userDetails.data.profile_image_url,
                location: userDetails.data.location,
                createdAt: userDetails.data.created_at
            });

            await User.findByIdAndUpdate(socialMedia.userId, {
                twitter: {
                    followers: userDetails.data.public_metrics.followers_count,
                    following: userDetails.data.public_metrics.following_count,
                    tweets: userDetails.data.public_metrics.tweet_count,
                    listed: userDetails.data.public_metrics.listed_count,
                    profileImage: userDetails.data.profile_image_url,
                    location: userDetails.data.location,
                    createdAt: userDetails.data.created_at
                }
            });
        }

        const allTweets = await twitterClient.v2.userTimeline(socialMedia.socialMediaID, {
            max_results: 100,
            "tweet.fields": ["public_metrics", "created_at"]
        });

        // Process each tweet
        const allTweetsAnalytics = [];
        for (const tweet of allTweets.data.data) {
            const metrics = tweet.public_metrics;
            allTweetsAnalytics.push({
                tweetId: tweet.id,
                createdAt: tweet.created_at,
                metrics: {
                    likes: metrics.like_count,
                    replies: metrics.reply_count,
                    retweets: metrics.retweet_count,
                    impressions: metrics.impression_count,
                    quotes: metrics.quote_count
                }
            });
        }

        // Match tweets with posts and update analytics
        for (const post of posts) {
            // Find matching tweet for this post
            const matchingTweet = allTweetsAnalytics.find(tweet =>
                tweet.tweetId === post.platformSpecific?.xtwitter?.postId
            );

            if (matchingTweet) {
                const metrics = matchingTweet.metrics;
                const totalEngagements = metrics.likes + metrics.replies +
                    metrics.retweets + metrics.quotes;

                const existingAnalytics = await Analytics.findOne({
                    postId: post._id,
                });

                if (existingAnalytics) {
                    await Analytics.findByIdAndUpdate(
                        existingAnalytics._id,
                        {
                            like: metrics.likes,
                            comment: metrics.replies,
                            share: metrics.retweets,
                            impressions: metrics.impressions,
                            engagements: totalEngagements
                        },
                        { new: true }
                    );
                }
            }
        }

    } catch (error) {
        console.log(`[${getCurrentISTTime()}] Error handling analytics:`, error.message, error);
    }
}

async function checkMediaUsage(mediaPath) {
    const posts = await Post.find({ status: { $in: ["scheduled", "draft", "failed"] } });
    const platforms = ['instagram', 'xtwitter', 'pinterest', 'linkedin'];
    let usedInOtherPosts = false;

    for (const post of posts) {
        for (const platform of platforms) {
            const mediaUrls = post.platformSpecific[platform]?.mediaUrls;
            if (mediaUrls && mediaUrls.includes(mediaPath)) {
                usedInOtherPosts = true;
                break;
            }
        }
        if (usedInOtherPosts) break;
    }

    return usedInOtherPosts;
}