const categoryService = require("./category.service.js");
const asyncHandler = require("../../common/utils/asyncHandler.js");
const { success } = require("../../common/utils/response.js");

// GET /api/myshop/categories?status=&keyword=
const getMyCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.getMyCategories(
    req.shopId,
    req.query,
  );
  success(res, categories);
});

// POST /api/myshop/categories
const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.shopId, req.body);
  success(res, category, "Thêm danh mục thành công", 201);
});

// PUT /api/myshop/categories/:id
const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(
    req.shopId,
    req.params.id,
    req.body,
  );
  success(res, category, "Cập nhật danh mục thành công");
});

module.exports = {
  getMyCategories,
  createCategory,
  updateCategory,
};
