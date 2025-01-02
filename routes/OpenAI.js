const express = require("express");
const router = express.Router();
const OpenAI = require('openai');
const { authMiddleware } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validate-request.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const Joi = require("joi");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/generate-response', authMiddleware, AddOpenAiValidation, async (req, res) => {
    try {
        const { input } = req.body;

        // const response = await openai.chat.completions.create({
        //     // model: "gpt-3.5-turbo",
        //     model: "gpt-3.5-turbo-0125",
        //     messages: [{
        //         role: "user", content: `
        //                 Generate a creative social media post.
        //                 Input: ${input}.
        //                 Content Type: ${"General"}.
        //                 Ensure the post is engaging and aligns with the specified tone or platform.
        //             ` }],
        // });
        // res.json({ responseData: response.choices[0]?.message?.content || "" });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            Create a single, focused social media post about: ${input}
            
            Rules:
            1. Provide ONLY a clear, engaging caption (2-3 sentences minimum)
            2. Do not include any hashtags
            3. Do not include any labels or formatting
            4. Correct any spelling mistakes in the input
            
            Return only the caption text, nothing else.
        `;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Clean up the response by removing extra whitespace and newlines
        const cleanResponse = response.trim().replace(/\n\s+/g, '\n');

        res.json({ responseData: cleanResponse });
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
