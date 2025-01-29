const redisClient = require("../utils/Redis");
const Analytics = require("../models/Analytics");

const CACHE_EXPIRY = 3600;

const AnalyticsGet = async (req, res) => {
    try {

        const cacheKey = 'analytics_all';
        const cachedData = await redisClient.get(cacheKey);

        const detail = await Analytics.find();

        await redisClient.set(cacheKey, JSON.stringify(detail), { EX: CACHE_EXPIRY });

        return res.status(200).json({ success: true, date: detail });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

const AnalyticsGets = async (req, res) => {
    try {
        let { id } = req.params;

        const cacheKey = `analytics_${id}`;
        const cachedData = await redisClient.get(cacheKey);

        const detail = await Analytics.findById(id);

        await redisClient.set(cacheKey, JSON.stringify(detail), { EX: CACHE_EXPIRY });
        return res.status(200).json({ success: true, data: detail });
    } catch (error) {
        return res.status(500).json({ success: false, error: error, message });
    }
}

const AnalyticsDelete = async (req, res) => {
    try {
        let { id } = req.params;

        const detail = await Analytics.findByIdAndDelete(id, { new: true });
        return res.status(200).json({ success: true, data: detail });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = { AnalyticsGet, AnalyticsGets, AnalyticsDelete };