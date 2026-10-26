const express = require("express");
const shopStatsController = require("./shop-stats.controller.js");
const { auth } = require("../../common/middlewares/auth.js");
const { shopRole } = require("../../common/middlewares/role.js");

const shopStatsRouter = express.Router();
const ownerOnly = [auth, shopRole("SHOP_OWNER")];

// Shop Owner - UC29
shopStatsRouter.get(
  "/myshop/statistics/revenue",
  ownerOnly,
  shopStatsController.getRevenue,
);
shopStatsRouter.get(
  "/myshop/statistics/topProducts",
  ownerOnly,
  shopStatsController.getTopProducts,
);

module.exports = shopStatsRouter;
