const axios = require('axios');
const fs = require('fs');
const qs = require('querystring');
const { Post, User, SocialMedia } = require('../models/index.js');
const redisClient = require("../utils/Redis.js");

const linkedinAdd = async (req, res) => {
  try {

    const { accessToken, socialMediaEmail, platformUserName, sub, name } = req.body;
    const findUser = await User.findById(req.user._id);

    const findSocialMediaAccount = await SocialMedia.findOne({
      platformName: "linkedin",
      userId: req.user._id,
    });

    if (findSocialMediaAccount) {
      findSocialMediaAccount.socialMediaID = sub;
      findSocialMediaAccount.accessToken = accessToken;
      findSocialMediaAccount.platformUserName = platformUserName;
      findSocialMediaAccount.socialMediaEmail = socialMediaEmail;

      await findSocialMediaAccount.save();

      global.io.to(findUser._id.toString()).emit("notification", {
        message: `${name} has logged into linkedin successfully.`,
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
      platformName: 'linkedin',
      platformUserName: platformUserName,
      userId: req.user._id,
      socialMediaID: sub, //? insert sub id
      createdBy: name,
    });

    global.io.to(findUser._id.toString()).emit("notification", {
      message: `${name} has logged into linkedin successfully.`,
      receiverId: findUser._id,
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
      redirect_uri: 'https://schedulx-backend-ybdo.onrender.com/api/v1/linkedin/callback',
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
      await redisClient.setEx(`linkedin_user`, 3600, JSON.stringify(userProfile));
      const user = encodeURIComponent(JSON.stringify(userProfile));
      return res.redirect(`${process.env.FRONTEND_URL}?linkedin=${user}&accessToken=${accessToken}`);
    } else {
      return res.redirect(`${process.env.FRONTEND_URL}`);
    }
  } catch (error) {
    console.error('Error during LinkedIn OAuth:', error.message);
    return res.status(500).json({ error: 'An error occurred during LinkedIn authentication.', errorMessage: error.message });
  }
}

module.exports = { linkedinlogin, linkedinAdd };
