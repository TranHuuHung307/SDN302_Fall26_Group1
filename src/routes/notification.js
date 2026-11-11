const express = require("express");
const controller = require("../controllers/notification");
const { authenticate } = require("../middleware/auth");
const router = express.Router();
router.use("/notifications", authenticate);
router.get("/notifications", controller.listNotifications);
router.patch("/notifications/read-all", controller.markAllRead);
router.patch("/notifications/:id/read", controller.markRead);
module.exports = router;
