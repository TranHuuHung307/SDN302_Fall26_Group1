const statisticService = require("./statistic.service.js");
const asyncHandler = require("../../common/utils/asyncHandler.js");
const { success } = require("../../common/utils/response.js");

// GET /api/statistics/revenue
const getRevenue = asyncHandler(async (req, res) => {
  const data = await statisticService.getRevenue(req.shop._id, req.query);
  success(res, data);
});

// GET /api/statistics/top-products
const getTopProducts = asyncHandler(async (req, res) => {
  const data = await statisticService.getTopProducts(req.shop._id, req.query);
  success(res, data);
});

module.exports = { getRevenue, getTopProducts };
