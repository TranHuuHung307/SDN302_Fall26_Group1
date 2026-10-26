const shopStatsService = require("./shop-stats.service.js");
const asyncHandler = require("../../common/utils/asyncHandler.js");
const { success } = require("../../common/utils/response.js");

// GET /api/myshop/statistics/revenue
const getRevenue = asyncHandler(async (req, res) => {
  const data = await shopStatsService.getRevenue(req.shopId, req.query);
  success(res, data);
});

// GET /api/myshop/statistics/topProducts
const getTopProducts = asyncHandler(async (req, res) => {
  const data = await shopStatsService.getTopProducts(req.shopId, req.query);
  success(res, data);
});

module.exports = { getRevenue, getTopProducts };
