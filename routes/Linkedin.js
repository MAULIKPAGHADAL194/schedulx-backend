const router = require("express").Router();
const Joi = require("joi");
const { linkedinlogin, linkedinAdd } = require("../controllers/LinkedinController.js");
const { authMiddleware, logout } = require("../middleware/authMiddleware.js");
const validateRequest = require("../middleware/validate-request.js");

router.get('/', (req, res) => {
    const clientId = '77z2p7tuvpm43v';
    const redirectUri = encodeURIComponent('https://schedulx-backend-ybdo.onrender.com/api/v1/linkedin/callback');
    const state = 'randomstring123'; // Generate securely in production
    const scope = 'openid,profile,email,w_member_social';

    const loginUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;
    res.redirect(loginUrl);
});
router.get("/callback", linkedinlogin);

router.post("/linkedin-add", authMiddleware,
    AddValidation,
    linkedinAdd);

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

module.exports = router;
