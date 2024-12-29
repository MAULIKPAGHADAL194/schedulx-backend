const express = require("express");
const router = express.Router();
const OpenAI = require('openai');
const { authMiddleware } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validate-request.js");

const Joi = require("joi");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/generate-response', authMiddleware, AddOpenAiValidation, async (req, res) => {
    try {
        const { input } = req.body;
        console.log("input", input);

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "user", content: `
                        Generate a creative social media post.
                        Input: ${input}.
                        Content Type: ${"General"}.
                        Ensure the post is engaging and aligns with the specified tone or platform.
                    ` }],
        });

        res.json({ responseData: response.choices[0]?.message?.content || "" });
    } catch (error) {
        console.error("An error occurred:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

function AddOpenAiValidation(req, res, next) {
    const schema = Joi.object({
        input: Joi.string().required(),
    });
    validateRequest(req, res, next, schema);
}

module.exports = router;
