const router = require("express").Router();
const Joi = require("joi");
const { authMiddleware } = require("../middleware/authMiddleware");
const { PostAdd, PostsGet, PostGet, PostUpdate, PostDelete, UpdateScheduleTime } = require("../controllers/PostController");
const validateRequest = require("../middleware/validate-request.js");
const upload = require("../config/multerConfig");

router.post("/post-add", authMiddleware, AddValidation, PostAdd);
router.get("/posts-get", authMiddleware, PostsGet);
router.get("/post-get/:id", authMiddleware, PostGet);
router.put("/post-update/:id", authMiddleware, UpdateValidation, PostUpdate);
router.delete("/post-delete/:id", authMiddleware, PostDelete);
router.put("/post-schedule-time", authMiddleware, UpdateTimeValidation, UpdateScheduleTime);

function UpdateTimeValidation(req, res, next) {
    const schema = Joi.object({
        postId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid postId format."),
        socialMediaId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid socialMediaId format."),
        scheduledTime: Joi.date().required(),
    });
    validateRequest(req, res, next, schema);
}

function AddValidation(req, res, next) {
    const schema = Joi.object({
        userId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid userId format."),
        platformSpecific: Joi.object({
            instagram: Joi.object({
                postType: Joi.string().valid("post", "reel", "story").optional(),
                socialMediaId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid socialMediaId format."),
                hashtags: Joi.array().items(Joi.string().max(50)).optional(),
                mentions: Joi.array().items(Joi.string().max(50)).optional(),
                location: Joi.string().optional(),
                stickers: Joi.array().items(Joi.string().max(50)).optional(),
                firstComment: Joi.string().max(300).optional(),
                mediaUrls: Joi.array().items(Joi.string().required()).optional(),
            }).optional(),
            xtwitter: Joi.object({
                text: Joi.string().max(400).optional(),
                socialMediaId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid socialMediaId format."),
                hashtags: Joi.array().items(Joi.string().max(50)).optional(),
                mentions: Joi.array().items(Joi.string().max(50)).optional(),
                mediaUrls: Joi.array().items(Joi.string().required()).optional(),
                isThread: Joi.boolean().optional(),
                firstComment: Joi.string().max(300).optional(),
            }).optional(),
            pinterest: Joi.object({
                title: Joi.string().max(400).optional(),
                socialMediaId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid socialMediaId format."),
                description: Joi.string().max(500).optional(),
                mediaUrls: Joi.array().items(Joi.string().required()).optional(),
                destinationLink: Joi.string().optional(),
                boardName: Joi.string().max(100).optional(),
            }).optional(),
            linkedin: Joi.object({
                socialMediaId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid socialMediaId format."),
                content: Joi.string().max(1300).optional(),
                mediaUrls: Joi.array().items(Joi.string().required()).optional(),
                altText: Joi.string().max(200).optional(),
                firstComment: Joi.string().max(300).optional(),
                hashtags: Joi.array().items(Joi.string().max(50)).optional(),
            }).optional(),
        }).optional(),
        status: Joi.string().valid("scheduled", "draft").default("scheduled"),
        scheduledTime: Joi.date().required(),
    });
    validateRequest(req, res, next, schema);
}

function UpdateValidation(req, res, next) {
    const schema = Joi.object({
        userId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid userId format."),
        platformSpecific: Joi.object({
            instagram: Joi.object({
                postType: Joi.string().valid("post", "reel", "story").optional(),
                socialMediaId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid socialMediaId format."),
                hashtags: Joi.array().items(Joi.string().max(50)).optional(),
                mentions: Joi.array().items(Joi.string().max(50)).optional(),
                location: Joi.string().optional(),
                stickers: Joi.array().items(Joi.string().max(50)).optional(),
                firstComment: Joi.string().max(300).optional(),
            }).optional(),
            xtwitter: Joi.object({
                text: Joi.string().max(400).optional(),
                socialMediaId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid socialMediaId format."),
                hashtags: Joi.array().items(Joi.string().max(50)).optional(),
                mentions: Joi.array().items(Joi.string().max(50)).optional(),
                mediaUrls: Joi.array().items(Joi.string()).optional(),
                isThread: Joi.boolean().optional(),
                firstComment: Joi.string().max(300).optional(),
            }).optional(),
            pinterest: Joi.object({
                title: Joi.string().max(400).optional(),
                socialMediaId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid socialMediaId format."),
                description: Joi.string().max(500).optional(),
                mediaUrls: Joi.array().items(Joi.string()).optional(),
                destinationLink: Joi.string().optional(),
                boardName: Joi.string().max(100).optional(),
            }).optional(),
            linkedin: Joi.object({
                socialMediaId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid socialMediaId format."),
                content: Joi.string().max(1300).optional(),
                mediaUrls: Joi.array().items(Joi.string()).optional(),
                altText: Joi.string().max(200).optional(),
                firstComment: Joi.string().max(300).optional(),
                hashtags: Joi.array().items(Joi.string().max(50)).optional(),
            }).optional(),
        }).optional(),
        status: Joi.string().valid("scheduled", "draft").optional(),
        scheduledTime: Joi.date().optional(),
    });
    validateRequest(req, res, next, schema);
}

module.exports = router;