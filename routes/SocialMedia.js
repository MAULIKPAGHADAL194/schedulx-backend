const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");
const {
    SocialmediaGets,
    SocialmediaGet,
    SocialmediaDelete,
} = require("../controllers/SocialMediaController");
const router = express.Router();

// find all social media
router.get("/socialmedia-get", authMiddleware, SocialmediaGets);

// find single social-media
router.get("/socialmedia-get/:id", authMiddleware, SocialmediaGet);

// delete social media
router.delete("/socialmedia-delete/:id", authMiddleware, SocialmediaDelete);

module.exports = router