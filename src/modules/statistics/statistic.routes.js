const express = require("express");
const statisticController = require("./statistic.controller.js");
const { verifyToken } = require("../../shared/middlewares/auth.js");
const {
  authorize,
  loadOwnerShop,
} = require("../../shared/middlewares/authorize.js");

const statisticRouter = express.Router();
const ownerOnly = [verifyToken, authorize("SHOP_OWNER"), loadOwnerShop];

// Shop Owner - UC29
statisticRouter.get(
  "/statistics/revenue",
  ownerOnly,
  statisticController.getRevenue,
);
statisticRouter.get(
  "/statistics/top-products",
  ownerOnly,
  statisticController.getTopProducts,
);

module.exports = statisticRouter;
