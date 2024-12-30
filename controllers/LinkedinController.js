const axios = require('axios');
const fs = require('fs');
const qs = require('querystring');
const { Post, User, SocialMedia } = require('../models/index.js');

const linkedinAdd = async (req, res) => {
  try {

    const { accessToken, socialMediaEmail, platformUserName, sub, name } = req.body;

    const findSocialMediaAccount = await SocialMedia.findOne({
      platformName: "linkedin",
      userId: req.user._id,
      socialMediaID: sub,

    });
    if (findSocialMediaAccount) {

      findSocialMediaAccount.accessToken = accessToken;
      findSocialMediaAccount.platformUserName = platformUserName;

      await findSocialMediaAccount.save();

      global.io.emit('notification', {
        message: `${name} has logged in into linkedin`,
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
      platformName: 'linkedin',
      platformUserName: platformUserName,
      userId: req.user._id,
      socialMediaID: sub, //? insert sub id
      createdBy: name,
    });

    global.io.emit('notification', {
      message: `${name} has logged in into linkedin`,
    });

    await socialmediaAccountAdd.save();

    // User is already authenticated
    return res.status(200).json({
      message: "Linkedin Account Successfully Added",
      data: socialmediaAccountAdd,
    });

  } catch (error) {
    console.log("Error in authCheck controller", error.message);
    return res.status(500).json({ message: "Internal server error" });

  }
}

const linkedinlogin = async (req, res) => {
  try {
    // Step 1: Exchange authorization code for an access token
    const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', qs.stringify({
      grant_type: 'authorization_code',
      code: req.query.code,
      redirect_uri: 'https://schedulx-backend.onrender.com/api/v1/linkedin/callback',
      client_id: process.env.LINKEDINCLINTID,
      client_secret: process.env.LINKEDINCLINTSECRET
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const accessToken = tokenResponse.data.access_token;

    // Step 2: Use access token to fetch user profile
    const userInfoResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    // Step 3: Extract user data
    const userProfile = userInfoResponse.data;
    if (userProfile) {
      // console.log("userProfile", userProfile);

      const user = encodeURIComponent(JSON.stringify(userProfile));
      return res.redirect(`${process.env.RETURN_URL}?user=${user}&accessToken=${accessToken}`);
    } else {
      return res.redirect(`${process.env.RETURN_URL}`);
    }
  } catch (error) {
    console.error('Error during LinkedIn OAuth:', error.message);
    return res.status(500).json({ error: 'An error occurred during LinkedIn authentication.', errorMessage: error.message });
  }
}

const linkedinPost = async (req, res) => {
  try {

    const findSocialMediaAccount = await Socialmedia.findOne({
      userId: req.user._id,
      platformName: "linkedin",
    });

    if (!findSocialMediaAccount) {
      return res.status(404).json({ success: true, data: "Social media account not found!" });
    }
    const { text } = req.body;

    if (!findSocialMediaAccount || !findSocialMediaAccount.accessToken) {
      return res.status(400).json({ success: false, message: 'Access token is missing or invalid' });
    }
    const userInfoResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${findSocialMediaAccount.accessToken}`
      }
    });

    // if (userInfoResponse) {
    //   console.log("userProfile", userInfoResponse.data);
    // }
    // else {
    //   console.log("userProfile not found ");
    // }

    const headers = {
      Authorization: `Bearer ${findSocialMediaAccount.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    };

    let mediaAsset = null;
    let mediaType = null;

    // Handle media upload if mediaType and filePath are provided
    if (req.file) {
      const filePath = req.file.path;
      mediaType = req.file.mimetype.split("/")[0];

      // Step 1: Register media upload
      const registerResponse = await axios.post(
        `${process.env.LINKEDINAPI_BASE_URL}/assets?action=registerUpload`,
        {
          registerUploadRequest: {
            recipes: [`urn:li:digitalmediaRecipe:${mediaType === 'image' ? 'feedshare-image' : 'feedshare-video'}`],
            owner: `urn:li:person:${findSocialMediaAccount.socialMediaID}`, // Replace with your LinkedIn Person URN
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
        return res.status(400).json({ success: false, message: 'Error registering media upload.' });
      }

      // Step 2: Upload the media file
      const file = fs.readFileSync(filePath);
      await axios.put(uploadUrl, file, {
        headers: { 'Content-Type': 'application/octet-stream' },
      }).catch(err => {
        console.error('Error uploading media:', err.response?.data || err.message);
        return res.status(500).json({ success: false, message: 'Error uploading media to LinkedIn' });
      });
    }

    // Step 3: Create the post
    const postBody = {
      author: `urn:li:person:${findSocialMediaAccount.socialMediaID}`, // Replace with your LinkedIn Person URN
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: mediaType ? (mediaType === 'image' ? 'IMAGE' : 'VIDEO') : 'NONE',
          media: mediaAsset
            ? [
              {
                status: 'READY',
                media: mediaAsset,
                description: { text: 'Uploaded via API' }, // Optional description
                title: { text: 'My Media Post' }, // Optional title
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
      const linkedinPostAdd = new Post({
        userId: req.user._id,
        platformSpecific: {
          linkedin: {
            socialMediaId: findSocialMediaAccount._id,
            postId: response.data.id,
          }
        },
        createdBy: req.user.name,
      });

      await linkedinPostAdd.save();
      return res.status(201).json({ success: true, message: "post successfully uploaded", data: linkedinPostAdd });
    }
    return res.status(404).json({ success: false, message: "Post data not insert properly" });

  } catch (error) {
    console.error('Error creating post:', error.response?.data || error.message);
    return res.status(500).json({ success: false, message: error });
  }
};

const linkedinPostEdit = async (req, res) => {
  try {
    let { postId, text } = req.body

    const findSocialMediaAccount = await Socialmedia.findOne({
      userId: req.user._id,
      platformName: "linkedin"
    });
    let findSocialMediaPost = await Post.findOne({
      postId: postId,
    });

    console.log(findSocialMediaAccount);


    if (!findSocialMediaAccount) {
      return res.status(500).json({ success: false, message: "Social media account is not found" })
    }

    const headers = {
      Authorization: `Bearer ${findSocialMediaAccount.accessToken}`,
      'Content-Type': 'application/json'
    }

    await axios.delete(`${process.env.LINKEDINAPI_BASE_URL}/ugcPosts/${postId}`, { headers })

    const postBody = {
      author: `urn:li:person:${findSocialMediaAccount.socialMediaID}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE"
        }
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
      }
    };

    const response = await axios.post(`${process.env.LINKEDINAPI_BASE_URL}/ugcPosts`, postBody, { headers })

    console.log(response.data.id);

    if (response.data && response.data.id) {
      findSocialMediaPost.postId = response.data.id;
      // const upadtePost = await Post.findByIdAndUpdate(
      //   {postId},
      //   {postId : response.data.id , text},
      //   {new : true}
      // )
      await findSocialMediaPost.save()
      // console.log(response);

      return res.status(200).json({ success: true, message: "Post is successfully updated", data: findSocialMediaPost })
    }

    res.status(400).json({ success: false, message: "Failed to update post" })
  } catch (error) {
    console.error('Error editing LinkedIn post:', error.response?.data || error.message);
    res.status(500).json({ success: true, error: error.message })
  }
}

const linkedinPostDelete = async (req, res) => {
  try {
    let { postId } = req.params

    const { userId, socialMediaId } = req.body;

    const user = await User.findById(userId);
    const socialMedia = await SocialMedia.findOne({
      _id: socialMediaId,
      userId: userId
    });
    console.log(socialMedia);
    console.log(user);

    if (!user || !socialMedia) {
      return res.status(404).json({ success: false, message: "User or social media account not found" });
    }
    const post = await Post.findOne({
      _id: postId,
      "platformSpecific.linkedin.socialMediaId": socialMediaId,
      userId: userId
    });

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (post.status === 'posted') {
      const headers = {
        Authorization: `Bearer ${socialMedia.accessToken}`
      }

      await axios.delete(`${process.env.LINKEDINAPI_BASE_URL}/ugcPosts/${postId}`, { headers });

      if (post.platformSpecific.xtwitter || post.platformSpecific.facebook || post.platformSpecific.instagram || post.platformSpecific.pinterest) {
        // Update post to remove Twitter data while keeping other platforms
        const updatedPost = await Post.findByIdAndUpdate(
          postId,
          {
            $unset: { 'platformSpecific.linkedin': 1 },
            $set: { 'platformSpecific': post.platformSpecific.filter(p => p !== 'linkedin') }
          },
          { new: true }
        );

        global.io.emit('notification', {
          message: `${name} has deleted a post`,
        });

        return res.status(200).json({
          success: true,
          message: "Linkedin content removed from multi-platform post",
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
      if (post.platformSpecific.xtwitter || post.platformSpecific.facebook || post.platformSpecific.instagram || post.platformSpecific.pinterest) {
        // Update post to remove Twitter data while keeping other platforms
        const updatedPost = await Post.findByIdAndUpdate(
          postId,
          {
            $unset: { 'platformSpecific.linkedin': 1 },
          },
          { new: true }
        );

        global.io.emit('notification', {
          message: `${user.name} has deleted a post`,
        });

        return res.status(200).json({
          success: true,
          message: "Linkedin content removed from multi-platform post",
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
    console.error('Error editing LinkedIn post:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message })
  }
}

const linkedinUpdate = async (req, res) => {
  try {
    const {
      userId,
      socialMediaId,
      modelPostId,
      content,
      mediaUrls,
      altText,
      firstComment,
      hashtags,
      status,
      scheduledTime
    } = req.body;

    const [user, socialMedia] = await Promise.all([
      User.findById(userId),
      SocialMedia.findOne({
        platformName: "linkedin",
        socialMediaID: socialMediaId,
        userId
      })
    ]);

    if (!user || !socialMedia) {
      return res.status(404).json({ success: false, message: "User or social media account not found" });
    }

    const updatedPost = await Post.findOneAndUpdate(
      {
        platformSpecific: {
          linkedin: {
            socialMediaId: socialMedia._id,
          }
        },
        userId: user._id,
        _id: modelPostId,
        status: 'draft',
      },
      {
        'platformSpecific.linkedin.status': status,
        'platformSpecific.linkedin.content': content,
        'platformSpecific.linkedin.mediaUrls': mediaUrls,
        'platformSpecific.linkedin.altText': altText,
        'platformSpecific.linkedin.firstComment': firstComment,
        'platformSpecific.linkedin.hashtags': hashtags,
        'platformSpecific.linkedin.scheduledTime': scheduledTime,
      },
      { new: true }
    );

    if (!updatedPost) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    return res.status(200).json({ success: true, message: "Post is successfully updated", data: updatedPost });
  } catch (error) {
    console.error('Error updating LinkedIn post:', error.response?.data || error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { linkedinlogin, linkedinAdd, linkedinPost, linkedinPostEdit, linkedinPostDelete, linkedinUpdate };
