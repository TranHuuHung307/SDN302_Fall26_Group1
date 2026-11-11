const Product = require("../models/product.js");
const Shop = require("../models/shop.js");
const Category = require("../models/category.js");
const Order = require("../models/order.js");
const StockTransaction = require("../models/stockTransaction.js");
const Cart = require("../models/cart.js");
const { canManageShop, validId, resolveShopScope } = require("../utils/access.js");
const { toPublicImageUrl } = require("../middleware/upload.js");

const getProducts = async (req, res) => {
  try {
    const { shopId, categoryId, status } = req.query;
    const search = req.query.search || req.query.keyword;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};
    const approvedShopIds = await Shop.find({ approvalStatus: "APPROVED", operationStatus: "OPEN" }).distinct("_id");
    filter.shopId = { $in: approvedShopIds };
    if (shopId) {
      if (!validId(shopId)) return res.status(400).json({ success: false, message: "Invalid shopId." });
      if (!approvedShopIds.some((id) => String(id) === String(shopId))) return res.json({ success: true, data: { items: [], pagination: { page, limit, total: 0, totalPages: 0 } } });
      filter.shopId = shopId;
    }
    const activeCategoryIds = await Category.find({ status: "ACTIVE" }).distinct("_id");
    filter.categoryId = { $in: activeCategoryIds };
    if (categoryId) {
      if (!validId(categoryId)) return res.status(400).json({ success: false, message: "Invalid categoryId." });
      if (!activeCategoryIds.some((id) => String(id) === String(categoryId))) return res.json({ success: true, data: { items: [], pagination: { page, limit, total: 0, totalPages: 0 } } });
      filter.categoryId = categoryId;
    }
    if (status) {
      if (!["AVAILABLE", "OUT_OF_STOCK"].includes(status)) return res.status(400).json({ success: false, message: "Invalid public product status." });
      if (status === "OUT_OF_STOCK") filter.stockQuantity = { $lte: 0 };
    }
    filter.productStatus = "AVAILABLE";
    if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
      filter.price = {};
      if (req.query.minPrice !== undefined) filter.price.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice !== undefined) filter.price.$lte = Number(req.query.maxPrice);
      if (Object.values(filter.price).some((value) => !Number.isFinite(value) || value < 0) || (filter.price.$gte !== undefined && filter.price.$lte !== undefined && filter.price.$gte > filter.price.$lte)) return res.status(400).json({ success: false, message: "Invalid price range." });
    }
    if (search) filter.productName = { $regex: String(search).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const sorts = { newest: { createdAt: -1 }, price_asc: { price: 1, createdAt: -1 }, price_desc: { price: -1, createdAt: -1 }, name_asc: { productName: 1 } };
    const sort = sorts[req.query.sort] || sorts.newest;
    const [products, total] = await Promise.all([Product.find(filter)
      .populate("shopId", "shopName logoUrl address phone")
      .populate("categoryId", "categoryName status").sort(sort).skip((page - 1) * limit).limit(limit), Product.countDocuments(filter)]);

    const formattedProducts = products.map((product) => ({
      _id: product._id,
      productName: product.productName,
      description: product.description,
      price: product.price,
      stockQuantity: product.stockQuantity,
      isOutOfStock: product.stockQuantity <= 0,
      stockLabel: product.stockQuantity > 0 ? "Còn hàng" : "Hết hàng",
      images: product.images,
      expiryDate: product.expiryDate,
      productStatus: product.productStatus,
      shopId: product.shopId?._id || null,
      shopName: product.shopId?.shopName || "No Shop",
      categoryId: product.categoryId?._id || null,
      categoryName: product.categoryId?.categoryName || "No Category",
    }));

    res.status(200).json({ success: true, data: { items: formattedProducts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not load products." });
  }
};

const getProductById = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid product id." });
    const product = await Product.findById(req.params.id)
      .populate("shopId", "shopName logoUrl address phone approvalStatus operationStatus")
      .populate("categoryId", "categoryName status");

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }
    if (!product.shopId || product.shopId.approvalStatus !== "APPROVED" || product.shopId.operationStatus !== "OPEN") return res.status(404).json({ success: false, message: "Product not found" });
    if (!product.categoryId || product.categoryId.status !== "ACTIVE" || product.productStatus !== "AVAILABLE") return res.status(404).json({ success: false, message: "Product not found" });

    if (product.productStatus === "HIDDEN") {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not load product." });
  }
};

const writableFields = ["productName", "description", "price", "images", "expiryDate", "productStatus"];
const validateProduct = async (body, existingShopId) => {
  const shopId = body.shopId || existingShopId;
  if (!validId(shopId) || !await Shop.exists({ _id: shopId, approvalStatus: "APPROVED" })) return "A valid approved shopId is required.";
  if (body.categoryId !== undefined) {
    if (!validId(body.categoryId) || !await Category.exists({ _id: body.categoryId, shopId, status: "ACTIVE" })) return "categoryId must be an active category in the product shop.";
  }
  if (body.productName !== undefined && (typeof body.productName !== "string" || !body.productName.trim())) return "productName cannot be empty.";
  if (body.productName !== undefined && body.productName.trim().length > 200) return "productName must be 200 characters or fewer.";
  if (body.price !== undefined && (!Number.isFinite(Number(body.price)) || Number(body.price) < 0)) return "price must be a non-negative number.";
  if (body.stockQuantity !== undefined && (!Number.isInteger(Number(body.stockQuantity)) || Number(body.stockQuantity) < 0)) return "stockQuantity must be a non-negative integer.";
  if (body.stockQuantity !== undefined) return "Use the stock-transactions API to change stockQuantity.";
  if (body.productStatus !== undefined && !["AVAILABLE", "OUT_OF_STOCK", "HIDDEN"].includes(body.productStatus)) return "Invalid productStatus.";
  if (body.images !== undefined && (!Array.isArray(body.images) || body.images.some((image) => typeof image !== "string"))) return "images must be an array of strings.";
  return null;
};

async function getMyProducts(req, res, next) {
  try {
    const { shopId, error } = await resolveShopScope(req.user, req.query.shopId, ["INVENTORY_STAFF", "ORDER_STAFF"]);
    if (error) return res.status(error.status).json({ success: false, message: error.message });
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = { shopId };
    if (req.query.categoryId) {
      if (!validId(req.query.categoryId)) return res.status(400).json({ success: false, message: "Invalid categoryId." });
      filter.categoryId = req.query.categoryId;
    }
    if (req.query.productStatus) {
      if (!["AVAILABLE", "HIDDEN"].includes(req.query.productStatus)) return res.status(400).json({ success: false, message: "Invalid productStatus." });
      filter.productStatus = req.query.productStatus;
    }
    if (req.query.outOfStock === "true") filter.stockQuantity = { $lte: 0 };
    const keyword = req.query.keyword || req.query.search;
    if (keyword) filter.productName = { $regex: String(keyword).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const [items, total] = await Promise.all([Product.find(filter).populate("shopId", "shopName logoUrl address phone").populate("categoryId", "categoryName status").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Product.countDocuments(filter)]);
    return res.json({ success: true, data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) { return next(error); }
}

async function getMyProductById(req, res, next) {
  try {
    const { shopId, error } = await resolveShopScope(req.user, req.query.shopId, ["INVENTORY_STAFF", "ORDER_STAFF"]);
    if (error) return res.status(error.status).json({ success: false, message: error.message });
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid product id." });
    const product = await Product.findOne({ _id: req.params.id, shopId }).populate("shopId", "shopName logoUrl address phone").populate("categoryId", "categoryName status");
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    return res.json({ success: true, data: product });
  } catch (error) { return next(error); }
}

function parseImages(value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : [value]; }
  catch { return [value]; }
}

async function createMyShopProduct(req, res, next) {
  try {
    const { shopId, error } = await resolveShopScope(req.user, req.body?.shopId || req.query.shopId, []);
    if (error) return res.status(error.status).json({ success: false, message: error.message });
    const images = [...(parseImages(req.body?.images) || []), ...(req.files || []).map(toPublicImageUrl)];
    if (images.length > 10) return res.status(400).json({ success: false, message: "A product can have at most 10 images." });
    req.body = { ...req.body, shopId, images };
    return createProduct(req, res, next);
  } catch (error) { return next(error); }
}

async function updateMyShopProduct(req, res, next) {
  try {
    const { shopId, error } = await resolveShopScope(req.user, req.body?.shopId || req.query.shopId, []);
    if (error) return res.status(error.status).json({ success: false, message: error.message });
    const product = await Product.findOne({ _id: req.params.id, shopId });
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    const body = { ...req.body };
    if (body.stockQuantity !== undefined || body.productStatus !== undefined) return res.status(400).json({ success: false, message: "Update stock through inventory routes and status through the product status route." });
    if (body.images !== undefined) body.images = [...(parseImages(body.images) || []), ...(req.files || []).map(toPublicImageUrl)];
    else if (req.files?.length) body.images = [...product.images, ...req.files.map(toPublicImageUrl)];
    if (body.images?.length > 10) return res.status(400).json({ success: false, message: "A product can have at most 10 images." });
    req.params.id = String(product._id);
    req.body = body;
    return updateProduct(req, res, next);
  } catch (error) { return next(error); }
}

async function updateMyProductStatus(req, res, next) {
  try {
    const { shopId, error } = await resolveShopScope(req.user, req.body?.shopId || req.query.shopId, []);
    if (error) return res.status(error.status).json({ success: false, message: error.message });
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid product id." });
    const product = await Product.findOne({ _id: req.params.id, shopId });
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    const status = req.body?.productStatus || (product.productStatus === "HIDDEN" ? "AVAILABLE" : "HIDDEN");
    if (!["AVAILABLE", "HIDDEN"].includes(status)) return res.status(400).json({ success: false, message: "productStatus must be AVAILABLE or HIDDEN." });
    product.productStatus = status;
    await product.save();
    return res.json({ success: true, data: product, message: status === "HIDDEN" ? "Product hidden." : "Product is visible." });
  } catch (error) { return next(error); }
}

const createProduct = async (req, res, next) => {
  try {
    const body = req.body || {};
    const error = await validateProduct(body);
    if (error) return res.status(400).json({ success: false, message: error });
    if (!await canManageShop(req.user, body.shopId, ["INVENTORY_STAFF"])) return res.status(403).json({ success: false, message: "No access to this shop." });
    if (!body.categoryId || !body.productName || body.price === undefined) return res.status(400).json({ success: false, message: "categoryId, productName, and price are required." });
    const product = await Product.create({ ...Object.fromEntries(writableFields.filter((key) => body[key] !== undefined).map((key) => [key, body[key]])), shopId: body.shopId, categoryId: body.categoryId, productName: body.productName.trim(), stockQuantity: 0 });
    return res.status(201).json({ success: true, data: product });
  } catch (error) { return next(error); }
};

const updateProduct = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid product id." });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    if (!await canManageShop(req.user, product.shopId, ["INVENTORY_STAFF"])) return res.status(403).json({ success: false, message: "No access to this shop." });
    const body = req.body || {};
    const error = await validateProduct(body, product.shopId);
    if (error) return res.status(400).json({ success: false, message: error });
    if (body.shopId && String(body.shopId) !== String(product.shopId)) return res.status(400).json({ success: false, message: "Moving products between shops is not supported." });
    const updates = Object.fromEntries(writableFields.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
    if (updates.productName) updates.productName = updates.productName.trim();
    if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: "No supported fields were provided." });
    Object.assign(product, updates);
    await product.save();
    return res.json({ success: true, data: product });
  } catch (error) { return next(error); }
};

const deleteProduct = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid product id." });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    if (!await canManageShop(req.user, product.shopId, ["INVENTORY_STAFF"])) return res.status(403).json({ success: false, message: "No access to this shop." });
    if (await Order.exists({ "items.productId": product._id }) || await StockTransaction.exists({ productId: product._id }) || await Cart.exists({ "items.productId": product._id })) {
      return res.status(409).json({ success: false, message: "This product is referenced by a cart, order, or stock history. Set productStatus to HIDDEN instead of deleting it." });
    }
    await product.deleteOne();
    return res.json({ success: true, message: "Product deleted." });
  } catch (error) { return next(error); }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getMyProducts,
  getMyProductById,
  createMyShopProduct,
  updateMyShopProduct,
  updateMyProductStatus,
};
