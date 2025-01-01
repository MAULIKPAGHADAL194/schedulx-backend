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

// Run every minute
cron.schedule('*/1 * * * *', async () => {
    try {

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
                    const socialMediaAccounts = await SocialMedia.find({
                        $or: [
                            ...(post.platformSpecific.instagram?.socialMediaId ? [{ _id: post.platformSpecific.instagram.socialMediaId }] : []),
                            ...(post.platformSpecific.xtwitter?.socialMediaId ? [{ _id: post.platformSpecific.xtwitter.socialMediaId }] : []),
                            ...(post.platformSpecific.pinterest?.socialMediaId ? [{ _id: post.platformSpecific.pinterest.socialMediaId }] : []),
                            ...(post.platformSpecific.linkedin?.socialMediaId ? [{ _id: post.platformSpecific.linkedin.socialMediaId }] : [])
                        ]
                    });

                    if (!socialMediaAccounts || socialMediaAccounts.length === 0) {
                        console.log(`No social media accounts found for post ${post._id}`);
                        continue;
                    }

                    // Process each social media account
                    for (const socialMedia of socialMediaAccounts) {
                        // console.log("Processing social media:", {
                        //     platform: socialMedia.platformName,
                        //     accountId: socialMedia._id.toString(),
                        //     postPlatformId: post.platformSpecific.xtwitter?.socialMediaId?.toString()
                        // });

                        switch (socialMedia.platformName.toLowerCase()) {
                            case 'xtwitter':
                                if (post.platformSpecific.xtwitter?.socialMediaId?.toString() === socialMedia._id.toString()) {
                                    console.log("Calling processTwitterPost");
                                    platformPromises.push(processTwitterPost(post, socialMedia));
                                    // processTwitterPost(post, socialMedia);
                                }
                                break;
                            case 'linkedin':
                                if (post.platformSpecific.linkedin?.socialMediaId?.toString() === socialMedia._id.toString()) {
                                    console.log("Calling processLinkedinPost");
                                    platformPromises.push(processLinkedinPost(post, socialMedia));
                                }
                                break;
                            // Add other platforms here
                            default:
                                console.warn(`Unsupported platform: ${socialMedia.platformName}`);
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

        let mediaData;
        let cloudinaryUrl;
        if (post.platformSpecific.xtwitter?.mediaUrls && post.platformSpecific.xtwitter.mediaUrls.length > 0) {
            const mediaPath = post.platformSpecific.xtwitter.mediaUrls[0];
            const mediaFileBuffer = await fs.readFile(mediaPath);

            const cloudinaryResult = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload(mediaPath, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });

            cloudinaryUrl = cloudinaryResult.secure_url;

            // Determine media type from file extension
            const fileExtension = mediaPath.split('.').pop().toLowerCase();
            const mimeType = fileExtension === 'mp4' ? 'video/mp4' : 'image/jpeg';

            // Upload media using v1 endpoint
            mediaData = await client.v1.uploadMedia(mediaFileBuffer, {
                type: mimeType,
                mimeType: mimeType
            });

            fs.unlink(mediaPath, (err) => {
                if (err) {
                    console.log(`Error removing file: ${err}`);
                    return;
                }

                console.log(`File ${mediaPath} has been successfully removed.`);
            });
        }

        const hashtags = post.platformSpecific.xtwitter.hashtags || [];
        const hashtagText = hashtags.map((tag) => `#${tag}`).join(' ');

        const mentions = post.platformSpecific.xtwitter.mentions || [];
        const mentionText = mentions.map((mention) => `@${mention}`).join(' ');

        // Create the tweet payload
        // const tweetData = {
        //     text: post.platformSpecific.xtwitter.text,
        // };
        const tweetData = {
            text: `${post.platformSpecific.xtwitter.text} ${hashtagText} ${mentionText}`.trim(),
        };

        if (mediaData) {
            tweetData.media = { media_ids: [mediaData] };
        }

        // Post tweet using the v2 API
        const tweet = await client.v2.tweet(tweetData);

        // Handle first comment if present
        if (post.platformSpecific.xtwitter.firstComment && tweet.data.id) {
            await client.v2.tweet({
                text: post.platformSpecific.xtwitter.firstComment,
                reply: {
                    in_reply_to_tweet_id: tweet.data.id
                }
            });
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

            console.log({ success: true, data: twitterPostAdd });
        } else {
            throw new Error("Failed to post tweet");
        }

    } catch (error) {
        if (post.platformSpecific.xtwitter?.mediaUrls?.[0]) {
            try {
                await fs.unlink(post.platformSpecific.xtwitter.mediaUrls[0]);
            } catch (unlinkError) {
                console.log('Error deleting local file:', unlinkError);
            }
        }

        console.log('Twitter post processing error:', {
            postId: post._id,
            error: error.message,
            stack: error.stack
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

        if (userInfoResponse) {
            console.log("userProfile", userInfoResponse.data);
        }
        else {
            console.log("userProfile not found ");
        }

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
                cloudinary.uploader.upload(filePath, (error, result) => {
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

            // Clean up local file
            await fs.unlink(filePath).catch(err =>
                console.log(`Error removing file ${filePath}:`, err)
            );
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

        // Clean up media file if it exists and failed
        if (post.platformSpecific.linkedin?.mediaUrls?.[0]) {
            await fs.unlink(post.platformSpecific.linkedin.mediaUrls[0])
                .catch(err => console.log('Error deleting local file:', err));
        }

        throw error;
    }
};

let isCronRunning2 = false;

// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
    try {
        if (isCronRunning2) {
            console.log('Previous cron job still running, skipping...');
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

        // const tweet = await twitterClient.v2.singleTweet(post.platformSpecific.twitter.postId, {
        //     "tweet.fields": ["public_metrics", "created_at"]
        // });

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

        // console.log(`[${getCurrentISTTime()}] Fetching user timeline...`);
        const allTweets = await twitterClient.v2.userTimeline(socialMedia.socialMediaID, {
            max_results: 100,
            "tweet.fields": ["public_metrics", "created_at"],
            exclude: ['retweets', 'replies']
        });

        console.log("allTweets", allTweets.data.data);
        // console.log(`[${getCurrentISTTime()}] Successfully fetched ${allTweets.data.data.length} tweets`);


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

        // console.log({
        //     success: true,
        //     timestamp: getCurrentISTTime(),
        //     allTweets: JSON.stringify(allTweetsAnalytics)
        // });

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

        // for (const tweetData of allTweetsAnalytics) {
        //     if (tweetData) {
        //         // console.log("tweetData", tweetData);
        //         const metrics = tweetData.metrics;
        //         const totalEngagements = metrics.likes + metrics.replies +
        //             metrics.retweets + metrics.quotes;
        //         for (const post of posts) {
        //             const existingAnalytics = await Analytics.findOne({
        //                 postId: post._id,
        //             });

        //             let analyticsData;
        //             if (existingAnalytics) {
        //                 // Update existing analytics
        //                 analyticsData = await Analytics.findByIdAndUpdate(
        //                     existingAnalytics._id,
        //                     {
        //                         like: metrics.likes,
        //                         comment: metrics.replies,
        //                         share: metrics.retweets,
        //                         impressions: metrics.impressions,
        //                         engagements: totalEngagements
        //                     },
        //                     { new: true }
        //                 );
        //             }

        //             // console.log({
        //             //     success: true,
        //             //     data: analyticsData
        //             // });
        //         }
        //     }
        // }
    } catch (error) {
        console.log(`[${getCurrentISTTime()}] Error handling analytics:`, error.message, error);
    }
}
