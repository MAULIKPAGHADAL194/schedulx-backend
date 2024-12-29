const express = require("express");
const Joi = require("joi");
const passport = require("passport");
require("../config/passport.js");

const {
  login,
  requestPasswordReset,
  resetPassword,
  authCheck,
  resetCurrantPassword,
  resetPasswordOTP,
  successGoogleLogin,
  failureGoogleLogin,
  // successFacebookLogin,
  // failureFacebookLogin,
} = require("../controllers/AuthController.js");

const validateRequest = require("../middleware/validate-request.js");

const { authMiddleware, logout } = require("../middleware/authMiddleware.js");
const router = express.Router();

router.post("/login", LoginValidation, login);
router.post("/password-reset", ResetPasswordValidation, requestPasswordReset);
router.post("/password-reset-otp-check", resetPasswordOTP);
router.post("/password-reset-otp", resetPassword);
router.post(
  "/password-reset-currant",
  authMiddleware,
  ResetCurrantPasswordValidation,
  resetCurrantPassword
);
router.get("/authCheck", authMiddleware, authCheck);
router.post("/logout", authMiddleware, logout);

//! Google Auth 
router.get('/google', passport.authenticate('google', { scope: ['email', 'profile'] }));

//? Auth Callback 
router.get('/google/callback',
  passport.authenticate('google', {
    successRedirect: '/api/v1/auth/success',
    failureRedirect: '/api/v1/auth/failure'
  }));

//! Success 
router.get('/success', successGoogleLogin);

//! failure 
router.get('/failure', failureGoogleLogin);

function LoginValidation(req, res, next) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2 }).required(),
    password: Joi.string().min(6).max(255).required(),
  });
  validateRequest(req, res, next, schema);
}

function ResetPasswordValidation(req, res, next) {
  const schema = Joi.object({
    email: Joi.string().email({ minDomainSegments: 2 }).required(),
  });
  validateRequest(req, res, next, schema);
}

function ResetCurrantPasswordValidation(req, res, next) {
  const schema = Joi.object({
    password: Joi.string().min(6).max(255).required(),
    currantPassword: Joi.string().min(6).max(255).required(),
    confirmPassword: Joi.string().min(6).max(255).required(),
  });
  validateRequest(req, res, next, schema);
}

module.exports = router;
