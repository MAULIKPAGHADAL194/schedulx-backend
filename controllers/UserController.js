const { User, SocialMedia, Post, Analytics } = require("../models/index.js");
const bcryptjs = require("bcryptjs");

const UserAdd = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const findUser = await User.findOne({ email: email });
    if (findUser) {
      return res.status(400).json({
        success: false,
        message:
          "This email has already been used. Please use a different email address.",
      });
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    const createUser = new User({
      ...req.body,
      createdBy: name,
      password: hashedPassword,
    });

    await createUser.save();

    global.io.emit('notification', {
      message: `${name} has successfully registered`,
    });

    return res.status(201).json({ success: true, data: createUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const UsersGet = async (req, res) => {
  try {
    const findUser = await User.find()
    return res.status(200).json({ success: true, data: findUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const UserGet = async (req, res) => {
  try {
    const { id } = req.params;

    const [findUser, findUserSocialMediaAccount] = await Promise.all([
      User.findById(id).select('-createdAt -updatedAt -__v -isActive -lastModifiedBy -password'),
      SocialMedia.find({ userId: id })
        .select('-createdAt -updatedAt -__v -lastModifiedBy -accessToken -accessSecret')
    ]);

    if (!findUser) {
      return res.status(400).json({
        success: false,
        message: "The User ID data does not exist.",
      });
    }

    const allPosts = await Post.find({
      userId: id,
      $or: findUserSocialMediaAccount.map(account => ({
        [`platformSpecific.${account.platformName.toLowerCase() === 'xtwitter' ? 'xtwitter' : account.platformName.toLowerCase()}.socialMediaId`]: account._id
      }))
    }).select('-createdAt -updatedAt -__v -lastModifiedBy');

    // Get analytics for all posts
    const analytics = await Analytics.find({
      postId: { $in: allPosts.map(post => post._id) }
    }).select('-createdAt -updatedAt -__v');

    // Create analytics lookup map
    const analyticsMap = analytics.reduce((acc, analytic) => {
      if (!acc[analytic.postId]) {
        acc[analytic.postId] = [];
      }
      acc[analytic.postId].push(analytic);
      return acc;
    }, {});

    const postsBySocialMediaId = allPosts.reduce((acc, post) => {
      if (!post.platformSpecific) return acc;

      Object.entries(post.platformSpecific).forEach(([platform, data]) => {
        if (!data || !data.socialMediaId) return;

        if (!acc[data.socialMediaId]) {
          acc[data.socialMediaId] = [];
        }

        const platformSpecificId = data.postId || data.tweetId || data.id;

        // Filter analytics to only include those matching the current socialMediaId
        const postAnalytics = [
          ...(analyticsMap[post._id] || []),
          ...(platformSpecificId ? (analyticsMap[platformSpecificId] || []) : [])
        ].filter(analytic => analytic.socialMediaId.toString() === data.socialMediaId.toString());

        acc[data.socialMediaId].push({
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
      data: { user: findUser, socialMedia: socialMediaWithPosts }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const UserUpdate = async (req, res) => {
  try {
    const { id } = req.params;

    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(400).json({
        success: false,
        message: "The User ID data does not exist.",
      });
    }
    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        ...req.body,
        lastModifiedBy: req.body.name || existingUser.name,
      },
      { new: true, runValidators: true }
    );

    global.io.emit('notification', {
      message: `${req.body.name} has successfully updated their profile`,
    });

    return res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const UserDelete = async (req, res) => {
  try {
    const { id } = req.params;
    const findUser = await User.findByIdAndDelete(id);
    if (!findUser) {
      return res.status(400).json({
        success: false,
        message: "The User ID data does not exist.",
      });
    }
    return res.status(200).json({ success: true, data: "User Delete" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  UserAdd,
  UsersGet,
  UserGet,
  UserUpdate,
  UserDelete,
};
