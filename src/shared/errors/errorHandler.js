const fs = require("fs");
const multer = require("multer");
const AppError = require("./AppError.js");

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Không tìm thấy route ${req.method} ${req.originalUrl}`,
  });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = 500;
  let message = "Lỗi máy chủ";

  if (err instanceof AppError) {
    status = err.statusCode;
    message = err.message;
  } else if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  } else if (err.name === "CastError") {
    status = 400;
    message = `Giá trị không hợp lệ cho ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = `Dữ liệu bị trùng: ${Object.keys(err.keyValue || {}).join(", ")}`;
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = `Lỗi upload: ${err.message}`;
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Body JSON không hợp lệ";
  }

  // request lỗi thì xóa ảnh vừa upload để không bị rác
  const files = req.files || (req.file ? [req.file] : []);
  files.forEach((file) => fs.unlink(file.path, () => {}));

  if (status === 500) console.error(err);

  res.status(status).json({ success: false, message });
};

module.exports = { notFound, errorHandler };
