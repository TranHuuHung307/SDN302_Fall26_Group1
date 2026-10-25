const AppError = require("../../shared/errors/AppError.js");

const STATUSES = ["ACTIVE", "INACTIVE"];

const validateCreate = (req, res, next) => {
  const { categoryName, description } = req.body;

  if (typeof categoryName !== "string" || !categoryName.trim()) {
    return next(new AppError(400, "Tên danh mục là bắt buộc"));
  }
  if (categoryName.trim().length > 100) {
    return next(new AppError(400, "Tên danh mục tối đa 100 ký tự"));
  }

  req.body = {
    categoryName: categoryName.trim(),
    description: typeof description === "string" ? description.trim() : undefined,
  };
  next();
};

const validateUpdate = (req, res, next) => {
  const { categoryName, description, status } = req.body;
  const data = {};

  if (categoryName !== undefined) {
    if (typeof categoryName !== "string" || !categoryName.trim()) {
      return next(new AppError(400, "Tên danh mục không được để trống"));
    }
    if (categoryName.trim().length > 100) {
      return next(new AppError(400, "Tên danh mục tối đa 100 ký tự"));
    }
    data.categoryName = categoryName.trim();
  }
  if (description !== undefined) {
    data.description = String(description).trim();
  }
  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return next(new AppError(400, "status phải là ACTIVE hoặc INACTIVE"));
    }
    data.status = status;
  }

  if (Object.keys(data).length === 0) {
    return next(new AppError(400, "Không có dữ liệu để cập nhật"));
  }

  req.body = data;
  next();
};

const validateStatus = (req, res, next) => {
  if (!STATUSES.includes(req.body.status)) {
    return next(new AppError(400, "status phải là ACTIVE hoặc INACTIVE"));
  }
  next();
};

module.exports = { validateCreate, validateUpdate, validateStatus };
