const express = require("express");
const controller = require("../controllers/statistics");
const { authenticate, allowRoles } = require("../middleware/auth");
const router = express.Router();
router.get("/myshop/statistics/revenue", authenticate, allowRoles("ADMIN", "SHOP_OWNER"), controller.getRevenue);
router.get("/myshop/statistics/topProducts", authenticate, allowRoles("ADMIN", "SHOP_OWNER"), controller.getTopProducts);
module.exports = router;
