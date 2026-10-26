const Product = require("../../models/product.model.js");
const Category = require("../../models/category.model.js");
const Shop = require("../../models/shop.model.js");
const categoryService = require("../categories/category.service.js");
const AppError = require("../../common/errors/AppError.js");
const {
  escapeRegex,
  assertObjectId,
  getPagination,
} = require("../../common/utils/query.js");

// shop hiển thị cho khách: không bị khóa (SUSPENDED) và đang mở cửa
const VISIBLE_SHOP = { approvalStatus: "APPROVED", operationStatus: "OPEN" };
const MAX_IMAGES = 10;

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1, createdAt: -1 },
  price_desc: { price: -1, createdAt: -1 },
  name_asc: { productName: 1 },
};

const POPULATE = [
  { path: "shopId", select: "shopName logoUrl address phone" },
  { path: "categoryId", select: "categoryName status" },
];

const formatProduct = (product) => ({
  _id: product._id,
  productName: product.productName,
  description: product.description,
  price: product.price,
  stockQuantity: product.stockQuantity,
  // tồn = 0 thì hiện "Hết hàng" (không dùng trạng thái OUT_OF_STOCK)
  isOutOfStock: product.stockQuantity <= 0,
  stockLabel: product.stockQuantity > 0 ? "Còn hàng" : "Hết hàng",
  images: product.images,
  expiryDate: product.expiryDate,
  productStatus: product.productStatus,
  shopId: product.shopId?._id || null,
  shopName: product.shopId?.shopName || null,
  categoryId: product.categoryId?._id || null,
  categoryName: product.categoryId?.categoryName || null,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});

const formatProductDetail = (product) => ({
  ...formatProduct(product),
  shop: product.shopId
    ? {
        _id: product.shopId._id,
        shopName: product.shopId.shopName,
        logoUrl: product.shopId.logoUrl,
        address: product.shopId.address,
        phone: product.shopId.phone,
      }
    : null,
});

const buildPriceFilter = (minPrice, maxPrice) => {
  if (minPrice === undefined && maxPrice === undefined) return null;

  const price = {};
  if (minPrice !== undefined) {
    const min = Number(minPrice);
    if (Number.isNaN(min) || min < 0) {
      throw new AppError(400, "minPrice không hợp lệ");
    }
    price.$gte = min;
  }
  if (maxPrice !== undefined) {
    const max = Number(maxPrice);
    if (Number.isNaN(max) || max < 0) {
      throw new AppError(400, "maxPrice không hợp lệ");
    }
    price.$lte = max;
  }
  if (price.$gte !== undefined && price.$lte !== undefined && price.$gte > price.$lte) {
    throw new AppError(400, "minPrice không được lớn hơn maxPrice");
  }
  return price;
};

const findAndPaginate = async (filter, query) => {
  const { page, limit, skip } = getPagination(query);
  const sort = SORTS[query.sort] || SORTS.newest;

  const [products, total] = await Promise.all([
    Product.find(filter).populate(POPULATE).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  return {
    items: products.map(formatProduct),
    pagination: { page, limit, total },
  };
};

const findOwnProduct = async (shopId, productId) => {
  assertObjectId(productId, "productId");
  const product = await Product.findOne({ _id: productId, shopId });
  if (!product) {
    throw new AppError(404, "Không tìm thấy sản phẩm");
  }
  return product;
};

const ensureActiveOwnCategory = async (shopId, categoryId) => {
  const category = await categoryService.findOwnCategory(shopId, categoryId);
  if (category.status !== "ACTIVE") {
    throw new AppError(400, "Danh mục đang ngưng hoạt động");
  }
  return category;
};

/* ---------- Guest / Customer ---------- */

// UC25 + UC26 - danh sách, lọc, tìm kiếm, phân trang
// ?shopId=&categoryId=&minPrice=&maxPrice=&keyword=&sort=&page=&limit=
const getPublicProducts = async (query) => {
  const { shopId, categoryId, minPrice, maxPrice, keyword } = query;

  // danh mục ACTIVE thuộc shop đang hiển thị -> tự ẩn sản phẩm của
  // danh mục INACTIVE và shop SUSPENDED / CLOSED
  const shopIds = await Shop.find(VISIBLE_SHOP).distinct("_id");
  const categoryIds = await Category.find({
    shopId: { $in: shopIds },
    status: "ACTIVE",
  }).distinct("_id");

  const filter = {
    productStatus: "AVAILABLE",
    categoryId: { $in: categoryIds },
  };

  if (shopId) {
    assertObjectId(shopId, "shopId");
    filter.shopId = shopId;
  }
  if (categoryId) {
    assertObjectId(categoryId, "categoryId");
    filter.categoryId.$eq = categoryId;
  }
  const price = buildPriceFilter(minPrice, maxPrice);
  if (price) filter.price = price;
  if (keyword && keyword.trim()) {
    filter.productName = { $regex: escapeRegex(keyword.trim()), $options: "i" };
  }

  return findAndPaginate(filter, query);
};

// UC27 - chi tiết sản phẩm, sản phẩm không hiển thị thì 404
const getPublicProductById = async (productId) => {
  assertObjectId(productId, "productId");

  const product = await Product.findById(productId).populate(POPULATE);
  if (!product || product.productStatus === "HIDDEN") {
    throw new AppError(404, "Không tìm thấy sản phẩm");
  }
  if (!product.categoryId || product.categoryId.status !== "ACTIVE") {
    throw new AppError(404, "Không tìm thấy sản phẩm");
  }
  const shopVisible = await Shop.exists({ _id: product.shopId._id, ...VISIBLE_SHOP });
  if (!shopVisible) {
    throw new AppError(404, "Không tìm thấy sản phẩm");
  }

  return formatProductDetail(product);
};

/* ---------- Shop Owner / Staff ---------- */

// chủ shop xem sản phẩm của shop mình (kể cả HIDDEN)
// ?categoryId=&productStatus=&keyword=&outOfStock=true&sort=&page=&limit=
const getMyProducts = async (shopId, query) => {
  const { categoryId, productStatus, keyword, outOfStock } = query;
  const filter = { shopId };

  if (categoryId) {
    assertObjectId(categoryId, "categoryId");
    filter.categoryId = categoryId;
  }
  if (productStatus) {
    if (!["AVAILABLE", "HIDDEN"].includes(productStatus)) {
      throw new AppError(400, "productStatus phải là AVAILABLE hoặc HIDDEN");
    }
    filter.productStatus = productStatus;
  }
  if (outOfStock === "true") filter.stockQuantity = { $lte: 0 };
  if (keyword && keyword.trim()) {
    filter.productName = { $regex: escapeRegex(keyword.trim()), $options: "i" };
  }

  return findAndPaginate(filter, query);
};

const getMyProductById = async (shopId, productId) => {
  const product = await findOwnProduct(shopId, productId);
  await product.populate(POPULATE);
  return formatProductDetail(product);
};

// UC22 - thêm sản phẩm: tồn kho = 0, trạng thái AVAILABLE
const createProduct = async (shopId, data) => {
  await ensureActiveOwnCategory(shopId, data.categoryId);

  if (data.images.length > MAX_IMAGES) {
    throw new AppError(400, `Tối đa ${MAX_IMAGES} ảnh cho mỗi sản phẩm`);
  }

  const product = await Product.create({
    shopId,
    categoryId: data.categoryId,
    productName: data.productName,
    description: data.description,
    price: data.price,
    expiryDate: data.expiryDate,
    images: data.images,
    stockQuantity: 0,
    productStatus: "AVAILABLE",
  });

  await product.populate(POPULATE);
  return formatProductDetail(product);
};

// UC23 - sửa sản phẩm (không sửa tồn kho / trạng thái ở đây)
// data.images = danh sách ảnh cũ giữ lại, newImages = ảnh vừa upload
const updateProduct = async (shopId, productId, data, newImages = []) => {
  const product = await findOwnProduct(shopId, productId);

  if (
    data.categoryId !== undefined &&
    data.categoryId !== product.categoryId.toString()
  ) {
    await ensureActiveOwnCategory(shopId, data.categoryId);
    product.categoryId = data.categoryId;
  }

  ["productName", "description", "price", "expiryDate"].forEach((field) => {
    if (data[field] !== undefined) product[field] = data[field];
  });

  if (data.images !== undefined || newImages.length > 0) {
    const images = [...(data.images ?? product.images), ...newImages];
    if (images.length > MAX_IMAGES) {
      throw new AppError(400, `Tối đa ${MAX_IMAGES} ảnh cho mỗi sản phẩm`);
    }
    product.images = images;
  }

  await product.save();
  await product.populate(POPULATE);
  return formatProductDetail(product);
};

// UC24 - ẩn / hiện sản phẩm; không truyền status thì tự đảo trạng thái
const updateProductStatus = async (shopId, productId, productStatus) => {
  const product = await findOwnProduct(shopId, productId);

  product.productStatus =
    productStatus ||
    (product.productStatus === "HIDDEN" ? "AVAILABLE" : "HIDDEN");

  await product.save();
  await product.populate(POPULATE);
  return formatProduct(product);
};

module.exports = {
  VISIBLE_SHOP,
  getPublicProducts,
  getPublicProductById,
  getMyProducts,
  getMyProductById,
  createProduct,
  updateProduct,
  updateProductStatus,
};
