const express = require("express");
const Joi = require("joi");
const { calenderCreate, allCalnder, singleCalender, updateCalender, deleteCalender } = require("../controllers/CalenderController");
const validateRequest = require("../middleware/validate-request.js");
const { authMiddleware } = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/calender-add", authMiddleware, AddValidation, calenderCreate);
router.get("/calenders-get", authMiddleware, allCalnder);
router.get("/calender-get/:id", authMiddleware, singleCalender);
router.put("/calender-update/:id", authMiddleware, updateCalender);
router.delete("/calender-delete/:id", authMiddleware, deleteCalender);

function AddValidation(req, res, next) {
    const schema = Joi.object({
        socialMediaPlatformId: Joi.string().min(6).max(255).required(),
        scheduledTime: Joi.date().iso().required(),
    });
    validateRequest(req, res, next, schema);
}

module.exports = router;