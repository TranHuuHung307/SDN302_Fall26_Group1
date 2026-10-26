const mongoose = require("mongoose");
const AppError = require("../../common/errors/AppError.js");

const validateStockChange = (req, res, next) => {
  const { productId, quantity, note } = req.body;

  if (!productId || !mongoose.isValidObjectId(productId)) {
    return next(new AppError(400, "productId không hợp lệ hoặc bị thiếu"));
  }

  const numQuantity = Number(quantity);
  if (!Number.isInteger(numQuantity) || numQuantity <= 0) {
    return next(new AppError(400, "quantity phải là số nguyên lớn hơn 0"));
  }

  req.body = {
    productId,
    quantity: numQuantity,
    note: typeof note === "string" ? note.trim() : "",
  };
  next();
};

const validateTransactionsQuery = (req, res, next) => {
  const { productId, type } = req.query;

  if (productId && !mongoose.isValidObjectId(productId)) {
    return next(new AppError(400, "productId không hợp lệ"));
  }

  if (type && !["IMPORT", "EXPORT"].includes(type.toUpperCase())) {
    return next(new AppError(400, "type phải là IMPORT hoặc EXPORT"));
  }

  next();
};

module.exports = {
  validateStockChange,
  validateTransactionsQuery,
};
