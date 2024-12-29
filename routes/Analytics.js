const express = require("express")
const { authMiddleware } = require("../middleware/authMiddleware")
const { AnalyticsGet, AnalyticsGets, AnalyticsDelete } = require("../controllers/AnalyticsController")
const router = express.Router()

router.get("/analytics-get", authMiddleware, AnalyticsGet);
router.get("/analytics-get/:id", authMiddleware, AnalyticsGets);
router.delete("/analytics-delete/:id", authMiddleware, AnalyticsDelete);

module.exports = router