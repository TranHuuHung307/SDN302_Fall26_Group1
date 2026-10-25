const Category = require("./category.model.js");
const Shop = require("../shops/shop.model.js");
const AppError = require("../../shared/errors/AppError.js");
const { escapeRegex, assertObjectId } = require("../../shared/utils/query.js");

// tên danh mục không trùng trong cùng shop (không phân biệt hoa thường)
const ensureNameUnique = async (shopId, categoryName, excludeId) => {
  const filter = {
    shopId,
    categoryName: { $regex: `^${escapeRegex(categoryName)}$`, $options: "i" },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const existed = await Category.findOne(filter);
  if (existed) {
    throw new AppError(409, "Tên danh mục đã tồn tại trong shop");
  }
};

const findOwnCategory = async (shopId, categoryId) => {
  assertObjectId(categoryId, "categoryId");
  const category = await Category.findOne({ _id: categoryId, shopId });
  if (!category) {
    throw new AppError(404, "Không tìm thấy danh mục");
  }
  return category;
};

// UC21 - chủ shop xem tất cả danh mục của shop mình
const getMyCategories = async (shopId, { status, keyword }) => {
  const filter = { shopId };
  if (status) filter.status = status;
  if (keyword) {
    filter.categoryName = { $regex: escapeRegex(keyword), $options: "i" };
  }
  return Category.find(filter).sort({ createdAt: -1 });
};

// danh mục ACTIVE của 1 shop đang hoạt động (cho khách lọc sản phẩm)
const getPublicCategories = async ({ shopId }) => {
  const shopFilter = { approvalStatus: "APPROVED", operationStatus: "OPEN" };
  if (shopId) {
    assertObjectId(shopId, "shopId");
    shopFilter._id = shopId;
  }
  const shopIds = await Shop.find(shopFilter).distinct("_id");

  return Category.find({ shopId: { $in: shopIds }, status: "ACTIVE" })
    .select("shopId categoryName description")
    .sort({ categoryName: 1 });
};

// UC21 - thêm danh mục
const createCategory = async (shopId, { categoryName, description }) => {
  await ensureNameUnique(shopId, categoryName);
  return Category.create({ shopId, categoryName, description });
};

// UC21 - sửa danh mục
const updateCategory = async (shopId, categoryId, data) => {
  const category = await findOwnCategory(shopId, categoryId);

  if (data.categoryName !== undefined) {
    await ensureNameUnique(shopId, data.categoryName, category._id);
    category.categoryName = data.categoryName;
  }
  if (data.description !== undefined) category.description = data.description;
  if (data.status !== undefined) category.status = data.status;

  return category.save();
};

// UC21 - ngưng / mở lại danh mục
const updateCategoryStatus = async (shopId, categoryId, status) => {
  const category = await findOwnCategory(shopId, categoryId);
  category.status = status;
  return category.save();
};

module.exports = {
  findOwnCategory,
  getMyCategories,
  getPublicCategories,
  createCategory,
  updateCategory,
  updateCategoryStatus,
};
