const categoryService = require("./category.service.js");
const asyncHandler = require("../../common/utils/asyncHandler.js");
const { success } = require("../../common/utils/response.js");

// GET /api/categories?shopId=
const getPublicCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.getPublicCategories(req.query);
  success(res, categories);
});

// GET /api/categories/manage?status=&keyword=
const getMyCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.getMyCategories(
    req.shop._id,
    req.query,
  );
  success(res, categories);
});

// POST /api/categories
const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.shop._id, req.body);
  success(res, category, "Thêm danh mục thành công", 201);
});

// PUT /api/categories/:id
const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(
    req.shop._id,
    req.params.id,
    req.body,
  );
  success(res, category, "Cập nhật danh mục thành công");
});

// PATCH /api/categories/:id/status
const updateCategoryStatus = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategoryStatus(
    req.shop._id,
    req.params.id,
    req.body.status,
  );
  const message =
    category.status === "INACTIVE" ? "Đã ngưng danh mục" : "Đã mở lại danh mục";
  success(res, category, message);
});

module.exports = {
  getPublicCategories,
  getMyCategories,
  createCategory,
  updateCategory,
  updateCategoryStatus,
};
