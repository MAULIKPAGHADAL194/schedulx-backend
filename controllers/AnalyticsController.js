const Analytics = require("../models/Analytics");

const AnalyticsGet = async (req, res) => {
    try {

        const detail = await Analytics.find();

        return res.status(200).json({ success: true, date: detail });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

const AnalyticsGets = async (req, res) => {
    try {
        let { id } = req.params;

        const detail = await Analytics.findById(id);
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