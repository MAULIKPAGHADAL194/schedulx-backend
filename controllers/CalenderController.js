const redisClient = require("../utils/Redis.js");
const { Calendar, SocialMedia, Post } = require("../models/index.js");

const CACHE_EXPIRY = 3600;

const calenderCreate = async (req, res) => {
    try {
        let { socialMediaPlatformId, scheduledTime } = req.body;

        const findSocialMediaAccount = await SocialMedia.find({ socialMediaID: socialMediaPlatformId });
        if (!findSocialMediaAccount) {
            return res.status(404).json({ success: false, error: "Social Media Account Not Found" });
        }
        console.log(findSocialMediaAccount);

        // const detail = await Calendar.create({
        //     socialMediaId,
        //     postId,
        //     userId: req.user._id,
        //     scheduledTime,
        // });
        // console.log(detail);

        // await detail.save();

        return res.status(200).json({ success: true, data: { ...req.body, findSocialMediaAccount } });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

const allCalnder = async (req, res) => {
    try {

        const cacheKey = 'calendar_all';
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(200).json({ success: true, data: JSON.parse(cachedData) });
        }

        const alldata = await Calendar.find();
        await redisClient.set(cacheKey, JSON.stringify(alldata), { EX: CACHE_EXPIRY });

        return res.status(200).json({ success: true, data: alldata });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

const singleCalender = async (req, res) => {
    try {
        let { id } = req.params

        const cacheKey = `calendar_${id}`;
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(200).json({ success: true, data: JSON.parse(cachedData) });
        }

        const detail = await Calendar.findById(id)

        await redisClient.set(cacheKey, JSON.stringify(detail), { EX: CACHE_EXPIRY });
        return res.status(200).json({ success: true, data: detail });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

const updateCalender = async (req, res) => {
    try {
        let { id } = req.params
        // let {platformName} = req.body

        const detail = await Calendar.findByIdAndUpdate(id, req.body, { new: true })
        return res.status(200).json({ success: true, data: detail });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

const deleteCalender = async (req, res) => {
    try {
        let { id } = req.params;
        const detail = await Calendar.findByIdAndDelete(id);
        return res.status(200).json({ success: true, data: detail });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = { calenderCreate, allCalnder, singleCalender, updateCalender, deleteCalender }