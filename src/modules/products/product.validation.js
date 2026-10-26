const mongoose = require("mongoose");
const AppError = require("../../common/errors/AppError.js");

// body có thể là JSON hoặc multipart/form-data nên giá trị số / mảng
// có thể đang ở dạng chuỗi

// images: ["url1","url2"] | '["url1"]' | "url1" | ""
const parseImageList = (value) => {
  if (value === undefined) return undefined;
  let list = value;

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    if (text.startsWith("[")) {
      try {
        list = JSON.parse(text);
      } catch {
        throw new AppError(400, "images không đúng định dạng JSON");
      }
    } else {
      list = [text];
    }
  }

  if (!Array.isArray(list) || list.some((x) => typeof x !== "string" || !x.trim())) {
    throw new AppError(400, "images phải là danh sách đường dẫn ảnh");
  }
  return list.map((x) => x.trim());
};

const parsePrice = (value) => {
  const price = Number(value);
  if (value === "" || value === null || Number.isNaN(price) || price < 0) {
    throw new AppError(400, "Giá phải là số không âm");
  }
  return price;
};

const parseExpiryDate = (value) => {
  if (value === "" || value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "Hạn sử dụng không hợp lệ");
  }
  return date;
};

const parseName = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "Tên sản phẩm là bắt buộc");
  }
  if (value.trim().length > 200) {
    throw new AppError(400, "Tên sản phẩm tối đa 200 ký tự");
  }
  return value.trim();
};

const parseCategoryId = (value) => {
  if (!value || !mongoose.isValidObjectId(value)) {
    throw new AppError(400, "categoryId không hợp lệ");
  }
  return String(value);
};

const validateCreate = (req, res, next) => {
  try {
    const body = req.body || {};
    if (body.price === undefined) {
      throw new AppError(400, "Giá là bắt buộc");
    }

    req.body = {
      productName: parseName(body.productName),
      categoryId: parseCategoryId(body.categoryId),
      price: parsePrice(body.price),
      description:
        typeof body.description === "string" ? body.description.trim() : undefined,
      expiryDate:
        body.expiryDate !== undefined ? parseExpiryDate(body.expiryDate) : undefined,
      images: parseImageList(body.images) || [],
    };
    next();
  } catch (error) {
    next(error);
  }
};

const validateUpdate = (req, res, next) => {
  try {
    const body = req.body || {};

    if (body.stockQuantity !== undefined) {
      throw new AppError(
        400,
        "Không sửa tồn kho trực tiếp, hãy dùng chức năng nhập / xuất kho",
      );
    }
    if (body.productStatus !== undefined) {
      throw new AppError(
        400,
        "Dùng PATCH /api/myshop/products/:id/status để ẩn / hiện sản phẩm",
      );
    }

    const data = {};
    if (body.productName !== undefined) data.productName = parseName(body.productName);
    if (body.categoryId !== undefined) data.categoryId = parseCategoryId(body.categoryId);
    if (body.price !== undefined) data.price = parsePrice(body.price);
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.expiryDate !== undefined) data.expiryDate = parseExpiryDate(body.expiryDate);
    if (body.images !== undefined) data.images = parseImageList(body.images);

    if (Object.keys(data).length === 0 && !(req.files && req.files.length)) {
      throw new AppError(400, "Không có dữ liệu để cập nhật");
    }

    req.body = data;
    next();
  } catch (error) {
    next(error);
  }
};

const validateStatus = (req, res, next) => {
  const { productStatus } = req.body || {};
  if (productStatus !== undefined && !["AVAILABLE", "HIDDEN"].includes(productStatus)) {
    return next(new AppError(400, "productStatus phải là AVAILABLE hoặc HIDDEN"));
  }
  next();
};

module.exports = { validateCreate, validateUpdate, validateStatus };
