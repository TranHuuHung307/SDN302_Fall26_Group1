const StockTransaction = require("../../models/stockTransaction.model.js");
const Product = require("../../models/product.model.js");
const AppError = require("../../common/errors/AppError.js");
const { getPagination } = require("../../common/utils/query.js");

// UC38: Nhập kho
const importStock = async ({ shopId, productId, quantity, note, userId }) => {
  const product = await Product.findOne({ _id: productId, shopId });
  if (!product) {
    throw new AppError(404, "Sản phẩm không tồn tại trong shop của bạn");
  }

  product.stockQuantity = (product.stockQuantity || 0) + quantity;
  await product.save();

  const transaction = await StockTransaction.create({
    productId: product._id,
    shopId,
    type: "IMPORT",
    quantity,
    note: note || "Nhập kho sản phẩm",
    createdBy: userId,
  });

  return {
    transaction,
    stockQuantity: product.stockQuantity,
  };
};

// UC39: Xuất hủy hàng
const exportStock = async ({ shopId, productId, quantity, note, userId }) => {
  const product = await Product.findOne({ _id: productId, shopId });
  if (!product) {
    throw new AppError(404, "Sản phẩm không tồn tại trong shop của bạn");
  }

  const currentStock = product.stockQuantity || 0;
  if (currentStock < quantity) {
    throw new AppError(
      400,
      `Số lượng tồn kho không đủ để xuất hủy (tồn kho hiện tại: ${currentStock})`,
    );
  }

  product.stockQuantity = currentStock - quantity;
  await product.save();

  const transaction = await StockTransaction.create({
    productId: product._id,
    shopId,
    type: "EXPORT",
    quantity,
    note: note || "Xuất hủy hàng",
    createdBy: userId,
  });

  return {
    transaction,
    stockQuantity: product.stockQuantity,
  };
};

// UC40: Xem lịch sử giao dịch kho
const getTransactions = async ({ shopId, query }) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { shopId };

  if (query.productId) {
    filter.productId = query.productId;
  }

  if (query.type) {
    filter.type = query.type.toUpperCase();
  }

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) {
      filter.createdAt.$gte = new Date(query.from);
    }
    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = toDate;
    }
  }

  const [items, total] = await Promise.all([
    StockTransaction.find(filter)
      .populate("productId", "productName price images stockQuantity")
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockTransaction.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

// UC41: Cảnh báo hết hàng / sắp hết hạn
const getAlerts = async ({ shopId, days = 3 }) => {
  const numDays = Math.max(parseInt(days, 10) || 3, 1);
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + numDays);
  targetDate.setHours(23, 59, 59, 999);

  const [outOfStock, nearExpiry] = await Promise.all([
    Product.find({
      shopId,
      stockQuantity: { $lte: 0 },
    })
      .populate("categoryId", "categoryName")
      .sort({ updatedAt: -1 })
      .lean(),
    Product.find({
      shopId,
      expiryDate: { $ne: null, $lte: targetDate },
    })
      .populate("categoryId", "categoryName")
      .sort({ expiryDate: 1 })
      .lean(),
  ]);

  return { outOfStock, nearExpiry };
};

module.exports = {
  importStock,
  exportStock,
  getTransactions,
  getAlerts,
};
