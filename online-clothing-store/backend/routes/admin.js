const express = require("express");
const router = express.Router();
const { sendNotificationEmail } = require("../controllers/adminController");
const { verifyAdmin } = require("../utils/authMiddleware");

router.post("/notify", verifyAdmin, sendNotificationEmail);

module.exports = router;
