const express = require("express");
const Joi = require("joi");
const passport = require("passport");
require("../config/passport.js");

const { facebookAdd } = require("../controllers/FacebookController.js");

const validateRequest = require("../middleware/validate-request.js");

const { authMiddleware } = require("../middleware/authMiddleware.js");
const router = express.Router();

//! Facebook Auth
router.get('/', passport.authenticate('facebook'));

//! Auth Callback 
router.get('/callback',
  passport.authenticate('facebook', { failureRedirect: process.env.FRONTEND_URL }),
  (req, res) => {
    // Redirect to the frontend with user data
    const user = encodeURIComponent(JSON.stringify(req.user));
    res.redirect(`${process.env.RETURN_URL}?facebook=${user}`);
  });

router.post("/facebook-add", authMiddleware,
  AddValidation,
  facebookAdd);

function AddValidation(req, res, next) {
  const schema = Joi.object({
    accessToken: Joi.string().required(),
    platformUserName: Joi.string().required(),
    socialMediaID: Joi.string().required(),
    displayName: Joi.string().required(),
    socialMediaEmail: Joi.string().email().optional(),
  });
  validateRequest(req, res, next, schema);
}

module.exports = router;
