// Bọc controller async để lỗi tự chuyển sang errorHandler (Express 4 không tự bắt)
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
