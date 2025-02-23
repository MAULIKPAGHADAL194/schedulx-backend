const { User } = require("../models/index.js");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/SendEmail.js");
const bcryptjs = require("bcryptjs");
const redisClient = require("../utils/Redis.js");
const CACHE_EXPIRY = 3600;

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check findUser
    const findUser = await User.findOne({ email: email });

    if (!findUser) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcryptjs.compare(password, findUser.password);
    if (!isMatch) {
      return res.status(400).json({ message: "password Dose not match" });
    }

    const user = {
      _id: findUser._id,
      name: findUser.name,
      email: findUser.email,
      role: findUser.role,
      weekStart: findUser.weekStart,
    }
    const token = jwt.sign({ user }, process.env.JWT_SECRET, {
      expiresIn: "30day",
    });

    // global.io.emit('notification', {
    //   message: `${findUser.name} has successfully logged in.`,
    //   userId: findUser._id,
    // });

    global.io.to(findUser._id.toString()).emit("notification", {
      message: `${findUser.name} has successfully logged in.`,
      receiverId: findUser._id, // This ensures only the correct user sees it
    });

    // Store in cookies and session
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    return res.status(200).json({
      message: "User successfully login",
      data: findUser,
      token: token,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", Error: error, ErrorMessage: error.message });
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const findUser = await User.findOne({ email });
    if (!findUser) {
      return res.status(400).json({ message: "User not found" });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash the OTP and set expiration
    findUser.resetPasswordToken = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");
    findUser.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await findUser.save();

    // Send OTP via email
    const message = `Your password reset OTP is: ${otp}. This OTP is valid for 10 minutes.`;

    await sendEmail({
      to: findUser.email,
      subject: "password Reset OTP",
      text: message,
    });

    global.io.to(findUser._id.toString()).emit("notification", {
      message: `A password reset email has been sent to ${findUser.email}; please check your inbox or spam folder to proceed.`,
      receiverId: findUser._id,
    });


    return res.status(200).json({ message: "password reset email sent" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const resetPasswordOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ message: "OTP is required" });
    }
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const findUser = await User.findOne({
      resetPasswordToken: hashedOtp,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!findUser) {
      global.io.to(findUser._id.toString()).emit("notification", {
        message: `Invalid or expired OTP`,
        receiverId: findUser._id,
      });

      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    global.io.to(findUser._id.toString()).emit("notification", {
      message: `OTP successfully verified`,
      receiverId: findUser._id,
    });

    res.status(200).json({ message: "OTP successfully verified" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { otp, confirmPassword, password } = req.body;
    if (!password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({
        message: "password must be at least 6 characters",
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const findUser = await User.findOne({
      resetPasswordToken: hashedOtp,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!findUser) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);
    // Set new password
    findUser.password = hashedPassword;
    findUser.resetPasswordToken = undefined;
    findUser.resetPasswordExpires = undefined;
    await findUser.save();

    global.io.to(findUser._id.toString()).emit("notification", {
      message: `Your password has been reset successfully.`,
      receiverId: findUser._id,
    });

    res.status(200).json({ message: "Your password has been reset successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const resetCurrantPassword = async (req, res) => {
  try {
    const { currantPassword, password, confirmPassword } = req.body;
    console.log(req.user._id);

    // Find findUser by token and check expiration
    const findUser = await User.findById(req.user._id);
    if (!findUser) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    const isMatch = await bcryptjs.compare(
      currantPassword,
      findUser.password
    );
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Check if new password and confirm password match
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);
    findUser.password = hashedPassword;
    await findUser.save();

    global.io.to(findUser._id.toString()).emit("notification", {
      message: `Your password has been reset successfully.`,
      receiverId: findUser._id,
    });

    res.status(200).json({ message: "Your password has been reset successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const authCheck = async (req, res) => {
  try {
    const cacheKey = `user_${req.user._id}`;
    const cachedUser = await redisClient.get(cacheKey);
    if (cachedUser) {
      return res.status(200).json({ success: true, user: JSON.parse(cachedUser) });
    }

    res.status(200).json({
      success: true,
      user: req.user
    });

    await redisClient.set(cacheKey, JSON.stringify(req.user), {
      EX: CACHE_EXPIRY,
    });

  } catch (error) {
    console.log("Error in authCheck controller", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const successGoogleLogin = async (req, res) => {
  try {
    if (!req.user) {
      res.redirect('/failure');
    }

    const { email, displayName, sub, id, provider } = req.user;
    const cacheKey = `user_${id}`;
    console.log("req.user", req.user);

    // Check findUser
    const findUser = await User.findOne({ email });

    if (findUser) {
      const user = {
        _id: findUser._id,
        name: findUser.name,
        email: findUser.email,
        role: findUser.role,
        weekStart: findUser.weekStart,
      }
      const token = jwt.sign({ user }, process.env.JWT_SECRET, {
        expiresIn: "30day",
      });

      await redisClient.set(cacheKey, JSON.stringify({ user, token }), {
        EX: CACHE_EXPIRY,
      });

      res.cookie('token', token, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });;

      global.io.to(findUser._id.toString()).emit("notification", {
        message: `${findUser.name} logged in successfully.`,
        receiverId: findUser._id,
      });

      return res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}`);

    }

    const hashedPassword = await bcryptjs.hash('123456', 10);

    const createUser = new User({
      name: displayName,
      email: email,
      thirdParty: {
        provider: provider,
        providerid: id,
        sub: sub
      },
      createdBy: displayName,
      password: hashedPassword,
    });

    await createUser.save();

    const user = {
      _id: findUser._id,
      name: findUser.name,
      email: findUser.email,
      role: findUser.role,
      weekStart: findUser.weekStart,
    }
    const token = jwt.sign({ user }, process.env.JWT_SECRET, {
      expiresIn: "30day",
    });

    await redisClient.set(cacheKey, JSON.stringify({ user, token }), {
      EX: CACHE_EXPIRY,
    });

    global.io.to(findUser._id.toString()).emit("notification", {
      message: `${findUser.name} logged in successfully.`,
      receiverId: findUser._id,
    });

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    return res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}`);
  } catch (error) {
    console.log("Error in authCheck controller", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

const failureGoogleLogin = async (req, res) => {
  try {
    global.io.to(findUser._id.toString()).emit("notification", {
      message: `Error in google login`,
      receiverId: findUser._id,
    });
    res.send("Error");
  } catch (error) {
    console.log("Error in authCheck controller", error.message);
    res.status(500).json({ message: "Internal server error", error: error });
  }
}

module.exports = {
  login,
  requestPasswordReset,
  resetPassword,
  authCheck,
  resetCurrantPassword,
  resetPasswordOTP,
  failureGoogleLogin,
  successGoogleLogin,
};
