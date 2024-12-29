const router = require("express").Router();

//! Auth Router
router.use("/api/v1/auth", require("./Auth.js"));

//! User Router
router.use("/api/v1/user", require("./User.js"));

//! Upload Router
router.use("/api/v1/upload", require("./Upload.js"));

//! Upload Router
router.use("/api/v1/linkedin", require("./Linkedin.js"));

//! SocialMedia Router
router.use("/api/v1/socialmedia", require("./SocialMedia.js"));

//! Post Router
router.use("/api/v1/post", require("./Post.js"));

//! Analytics Router
router.use("/api/v1/analytics", require("./Analytics.js"));

//! Twitter Router
router.use("/api/v1/twitter", require("./Twitter.js"));

//! Facebook Router
router.use("/api/v1/facebook", require("./Facebook.js"));

//! OpenAI Router
router.use("/api/v1/openai", require("./OpenAI.js"));

module.exports = router;
