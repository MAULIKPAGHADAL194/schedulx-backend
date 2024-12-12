const User = require("../models/User.js");
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

    const restaurantUser = new User({
      ...req.body,
      createdBy: name,
      password: hashedPassword,
    });

    await restaurantUser.save();
    res.status(201).json({ success: true, data: restaurantUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const UsersGet = async (req, res) => {
  try {
    const findUser = await User.find()
    res.status(200).json({ success: true, data: findUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const UserGet = async (req, res) => {
  try {
    const { id } = req.params;
    const findUser = await User.findById(id)
    if (!findUser) {
      return res.status(400).json({
        success: false,
        message: "The User ID data does not exist.",
      });
    }

    res.status(200).json({ success: true, data: findUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const UserUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { Name } = req.body;

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
        lastModifiedBy: name || existingUser.name,
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(200).json({ success: true, data: "User Delete" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  UserAdd,
  UsersGet,
  UserGet,
  UserUpdate,
  UserDelete,
};
