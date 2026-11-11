const Product = require("../models/product");
const StockTransaction = require("../models/stockTransaction");
const Notification = require("../models/notification");
const ShopStaff = require("../models/shopStaff");
const Shop = require("../models/shop");
const { validId, resolveShopScope } = require("../utils/access");

async function listTransactions(req, res, next) {
  try {
    const requestedShopId = req.params.shopId || req.query.shopId;
    const { shopId, error } = await resolveShopScope(req.user, requestedShopId, ["INVENTORY_STAFF"]);
    if (error) return res.status(error.status).json({ success: false, message: error.message });
    if (!validId(shopId)) return res.status(400).json({ success: false, message: "Invalid shopId." });
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = { shopId };
    if (req.query.type) {
      if (!["IMPORT", "EXPORT"].includes(req.query.type)) return res.status(400).json({ success: false, message: "type must be IMPORT or EXPORT." });
      filter.type = req.query.type;
    }
    if (req.query.productId) {
      if (!validId(req.query.productId)) return res.status(400).json({ success: false, message: "Invalid productId." });
      filter.productId = req.query.productId;
    }
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) {
        filter.createdAt.$gte = new Date(req.query.from);
        if (Number.isNaN(filter.createdAt.$gte.getTime())) return res.status(400).json({ success: false, message: "Invalid from date." });
      }
      if (req.query.to) {
        filter.createdAt.$lte = new Date(req.query.to);
        if (Number.isNaN(filter.createdAt.$lte.getTime())) return res.status(400).json({ success: false, message: "Invalid to date." });
        filter.createdAt.$lte.setHours(23, 59, 59, 999);
      }
      if (filter.createdAt.$gte && filter.createdAt.$lte && filter.createdAt.$gte > filter.createdAt.$lte) return res.status(400).json({ success: false, message: "from must not be after to." });
    }
    const [data, total] = await Promise.all([StockTransaction.find(filter).populate("productId", "productName").populate("createdBy", "fullName email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), StockTransaction.countDocuments(filter)]);
    return res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
}

async function createTransaction(req, res, next) {
  try {
    const requestedShopId = req.params.shopId || req.query.shopId || req.body?.shopId;
    const { shopId, error } = await resolveShopScope(req.user, requestedShopId, ["INVENTORY_STAFF"]);
    if (error) return res.status(error.status).json({ success: false, message: error.message });
    const { productId, type, quantity, note } = req.body || {};
    if (!validId(shopId) || !validId(productId)) return res.status(400).json({ success: false, message: "Valid shopId and productId are required." });
    if (!["IMPORT", "EXPORT"].includes(type) || !Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ success: false, message: "type must be IMPORT or EXPORT and quantity a positive integer." });
    const update = type === "IMPORT" ? { $inc: { stockQuantity: quantity } } : { $inc: { stockQuantity: -quantity } };
    const filter = { _id: productId, shopId };
    if (type === "EXPORT") filter.stockQuantity = { $gte: quantity };
    const product = await Product.findOneAndUpdate(filter, update, { new: true, runValidators: true });
    if (!product) return res.status(409).json({ success: false, message: "Product not found in this shop or stock is insufficient." });
    let transaction;
    try {
      transaction = await StockTransaction.create({ productId, shopId, type, quantity, note, createdBy: req.user._id });
    } catch (error) {
      await Product.updateOne({ _id: productId }, { $inc: { stockQuantity: type === "IMPORT" ? -quantity : quantity } });
      throw error;
    }
    if (type === "EXPORT" && product.stockQuantity === 0) {
      const staff = await ShopStaff.find({ shopId, role: "INVENTORY_STAFF" }).distinct("userId");
      const receivers = new Set(staff.map(String));
      const shop = await Shop.findById(shopId).select("ownerId").lean();
      if (shop) receivers.add(String(shop.ownerId));
      await Notification.insertMany([...receivers].map((receiverId) => ({ receiverId, title: "Low stock", message: `${product.productName} is out of stock.`, type: "INVENTORY" }))).catch((notificationError) => console.error("Inventory notification failed:", notificationError));
    }
    return res.status(201).json({ success: true, data: { transaction, product } });
  } catch (error) { return next(error); }
}

async function getAlerts(req, res, next) {
  try {
    const { shopId, error } = await resolveShopScope(req.user, req.params.shopId || req.query.shopId, ["INVENTORY_STAFF"]);
    if (error) return res.status(error.status).json({ success: false, message: error.message });
    const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 3, 1), 365);
    const until = new Date();
    until.setDate(until.getDate() + days);
    until.setHours(23, 59, 59, 999);
    const [outOfStock, nearExpiry] = await Promise.all([
      Product.find({ shopId, stockQuantity: { $lte: 0 } }).populate("categoryId", "categoryName").sort({ updatedAt: -1 }).lean(),
      Product.find({ shopId, expiryDate: { $ne: null, $lte: until } }).populate("categoryId", "categoryName").sort({ expiryDate: 1 }).lean(),
    ]);
    return res.json({ success: true, data: { outOfStock, nearExpiry, days } });
  } catch (error) { return next(error); }
}

async function changeProductStock(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid product id." });
    const product = await Product.findById(req.params.id).select("shopId");
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    req.params.shopId = String(product.shopId);
    req.body = { ...req.body, productId: product._id };
    return createTransaction(req, res, next);
  } catch (error) { return next(error); }
}

async function listProductTransactions(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid product id." });
    const product = await Product.findById(req.params.id).select("shopId");
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    req.params.shopId = String(product.shopId);
    req.query.productId = req.params.id;
    return listTransactions(req, res, next);
  } catch (error) { return next(error); }
}

module.exports = { listTransactions, createTransaction, getAlerts, changeProductStock, listProductTransactions };
