const shopService = require("./shop.service.js");
const asyncHandler = require("../../common/utils/asyncHandler.js");
const { success } = require("../../common/utils/response.js");

// GET /api/shops/:id
const getShopPage = asyncHandler(async (req, res) => {
  const data = await shopService.getShopPage(req.params.id);
  success(res, data);
});

// GET /api/shops/:id/categories
const getShopCategories = asyncHandler(async (req, res) => {
  const categories = await shopService.getShopCategories(req.params.id);
  success(res, categories);
});

module.exports = { getShopPage, getShopCategories };
