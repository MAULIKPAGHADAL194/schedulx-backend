const express = require("express");
const Joi = require("joi");

const {
  UserAdd,
  UsersGet,
  UserGet,
  UserUpdate,
  UserDelete,
} = require("../controllers/UserController.js");

const validateRequest = require("../middleware/validate-request.js");

const { authMiddleware, logout } = require("../middleware/authMiddleware.js");
const router = express.Router();

router.post("/user-add", AddValidation, UserAdd);
router.get("/users-get", authMiddleware, UsersGet);
router.get("/user-get/:id", authMiddleware, UserGet);
router.put(
  "/user-update/:id",
  authMiddleware,
  UpdateValidation,
  UserUpdate
);
router.delete("/user-delete/:id", authMiddleware, UserDelete);

function AddValidation(req, res, next) {
  const schema = Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    email: Joi.string().email({ minDomainSegments: 2 }).required(),
    password: Joi.string().min(6).max(255).required(),
    phoneNumber: Joi.number()
      .integer()
      .min(1000000000)
      .max(9999999999)
      .optional(),
    role: Joi.string().valid(
      'Solopreneurs',
      'SmallBusinessOwners',
      'SocialMediaManagers',
      'ContentCreators',
      'MarketingProfessionals'
    ).required(),
  });
  validateRequest(req, res, next, schema);
}

function UpdateValidation(req, res, next) {
  const schema = Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    email: Joi.string().email({ minDomainSegments: 2 }).optional(),
    phoneNumber: Joi.number()
      .integer()
      .min(1000000000)
      .max(9999999999)
      .optional(),
  });
  validateRequest(req, res, next, schema);
}

module.exports = router;
