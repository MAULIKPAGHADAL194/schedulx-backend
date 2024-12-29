const router = require("express").Router();
const Joi = require("joi");
const passport = require("passport");
const { linkedinlogin, linkedinAdd, linkedinPostDelete, linkedinUpdate } = require("../controllers/LinkedinController.js");
const { authMiddleware, logout } = require("../middleware/authMiddleware.js");
const validateRequest = require("../middleware/validate-request.js");

router.get('/', (req, res) => {
    const clientId = '77z2p7tuvpm43v';
    const redirectUri = encodeURIComponent('http://localhost:5000/api/v1/linkedin/callback');
    const state = 'randomstring123'; // Generate securely in production
    const scope = 'openid,profile,email,w_member_social';

    const loginUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;
    res.redirect(loginUrl);
});
router.get("/callback", linkedinlogin);

// router.get('/', passport.authenticate('linkedin'));
// router.get('/callback',
//     passport.authenticate('linkedin', { failureRedirect: process.env.FRONTEND_URL }),
//     (req, res) => {
//         // Redirect to the frontend with user data
//         const user = encodeURIComponent(JSON.stringify(req.user));
//         res.redirect(`${process.env.RETURN_URL}?user=${user}`);
//     });

router.post("/linkedin-add", authMiddleware,
    AddValidation,
    linkedinAdd);

// router.put("/linkedin-update", authMiddleware, upload.single('file'), PostValidation, linkedinPostEdit);
router.put("/linkedin-update", authMiddleware, UpdateValidation, linkedinUpdate);
router.delete("/linkedin-delete/:postId", authMiddleware, DeleteValidation, linkedinPostDelete);

function AddValidation(req, res, next) {
    const schema = Joi.object({
        sub: Joi.string().required(),
        accessToken: Joi.string().required(),
        socialMediaEmail: Joi.string().email().required(),
        platformUserName: Joi.string().required(),
        name: Joi.string().required(),
    });
    validateRequest(req, res, next, schema);
}

function UpdateValidation(req, res, next) {
    const schema = Joi.object({
        userId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid userId format."),
        socialMediaId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid socialMediaId format."),
        modelPostId: Joi.string().required().regex(/^[0-9a-fA-F]{24}$/).message("Invalid postId format."),
        content: Joi.string().max(1300).optional(),
        mediaUrls: Joi.array().items(Joi.string()).optional(),
        altText: Joi.string().max(200).optional(),
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


module.exports = router;

