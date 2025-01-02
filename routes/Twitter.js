const express = require("express");
const Joi = require("joi");
const passport = require("passport");
require("../config/passport.js");

const {
  twitterAdd,
  twitterDelete,
  twitterUpdate,
  twitterPost
} = require("../controllers/TwitterController.js");

const upload = require("../config/multerConfig")

const validateRequest = require("../middleware/validate-request.js");

const { authMiddleware, logout } = require("../middleware/authMiddleware.js");
const router = express.Router();

//! Twitter Auth 
router.get('/', passport.authenticate('twitter'));

router.get('/callback',
  // passport.authenticate('twitter', {
  //   successRedirect: '/api/v1/twitter/success',
  //   failureRedirect: '/api/v1/twitter/failure'
  // }));
  passport.authenticate('twitter', { failureRedirect: process.env.FRONTEND_URL }),
  (req, res) => {
    // Redirect to the frontend with user data
    const user = encodeURIComponent(JSON.stringify(req.user));
    res.redirect(`${process.env.RETURN_URL}?user=${user}`);
  });
router.post("/twitter-post",
  authMiddleware, upload.single('file'),
  PostValidation, twitterPost);

router.post("/twitter-add", authMiddleware,
  AddValidation,
  twitterAdd);

router.delete('/twitter-delete/:postId', authMiddleware, DeleteValidation, twitterDelete);

router.post(
  "/twitter-update",
  authMiddleware,
  UpdateValidation,
  twitterUpdate
);

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

function UpdateValidation(req, res, next) {
  const schema = Joi.object({
    userId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid userId format."),
    socialMediaId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid socialMediaId format."),
    modelPostId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid postId format."),
    text: Joi.string().max(1300).optional(),
    mediaUrls: Joi.array().items(Joi.string()).optional(),
    isThread: Joi.string().max(200).optional(),
    firstComment: Joi.string().max(300).optional(),
    hashtags: Joi.array().items(Joi.string().max(50)).optional(),
    status: Joi.string().valid("posted", "scheduled", "draft").optional(),
    scheduledTime: Joi.date().optional(),
  });
  validateRequest(req, res, next, schema);
}

function DeleteValidation(req, res, next) {
  const schema = Joi.object({
    userId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid userId format."),
    socialMediaId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid socialMediaId format."),
  });
  validateRequest(req, res, next, schema);
}

function PostValidation(req, res, next) {
  const schema = Joi.object({
    tweetText: Joi.string().min(1).max(100).required(),

  });
  validateRequest(req, res, next, schema);
}

module.exports = router;
