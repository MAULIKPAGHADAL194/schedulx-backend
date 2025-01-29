const express = require("express");
const Joi = require("joi");
const passport = require("passport");
require("../config/passport.js");

const {
  twitterAdd,
} = require("../controllers/TwitterController.js");

const validateRequest = require("../middleware/validate-request.js");

const { authMiddleware, logout } = require("../middleware/authMiddleware.js");
const router = express.Router();

//! Twitter Auth 
router.get('/', passport.authenticate('twitter'));

router.get('/callback',
  passport.authenticate('twitter', { failureRedirect: process.env.FRONTEND_URL }),
  (req, res) => {
    // Redirect to the frontend with user data
    const user = encodeURIComponent(JSON.stringify(req.user));
    res.redirect(`${process.env.RETURN_URL}?twitter=${user}`);
  });

router.post("/twitter-add", authMiddleware,
  AddValidation,
  twitterAdd);

function AddValidation(req, res, next) {
  const schema = Joi.object({
    accessToken: Joi.string().required(),
    accessSecret: Joi.string().required(),
    platformUserName: Joi.string().required(),
    socialMediaID: Joi.string().required(),
    displayName: Joi.string().required(),
  });
  validateRequest(req, res, next, schema);
}

module.exports = router;
