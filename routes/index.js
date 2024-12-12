const router = require("express").Router();

//! Auth Router
router.use("/api/v1/auth", require("./Auth.js"));

//! User Router
router.use("/api/v1/user", require("./User.js"));

//! Upload Router
router.use("/api/v1/upload", require("./Upload.js"));

module.exports = router;
