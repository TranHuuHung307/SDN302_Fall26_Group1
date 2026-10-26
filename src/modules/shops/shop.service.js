const Shop = require("../../models/shop.model.js");
const AppError = require("../../common/errors/AppError.js");
const { assertObjectId } = require("../../common/utils/query.js");
const { getActiveCategories } = require("../categories/category.service.js");
const { VISIBLE_SHOP } = require("../products/product.service.js");

// shop đang hiển thị cho khách, bị khóa (SUSPENDED) hoặc đóng cửa (CLOSED) thì 404
const findVisibleShop = async (shopId) => {
  assertObjectId(shopId, "shopId");
  const shop = await Shop.findOne({ _id: shopId, ...VISIBLE_SHOP }).select(
    "shopName address phone logoUrl bannerUrl operationStatus createdAt",
  );
  if (!shop) {
    throw new AppError(404, "Shop không tồn tại hoặc đang tạm ngưng hoạt động");
  }
  return shop;
};

// UC28 - trang shop: thông tin shop + danh mục ACTIVE
// sản phẩm của shop lấy qua GET /api/products?shopId=
const getShopPage = async (shopId) => {
  const shop = await findVisibleShop(shopId);
  const categories = await getActiveCategories(shop._id);
  return { shop, categories };
};

// UC28 - danh mục ACTIVE của shop
const getShopCategories = async (shopId) => {
  const shop = await findVisibleShop(shopId);
  return getActiveCategories(shop._id);
};

module.exports = { getShopPage, getShopCategories };
