// Lỗi nghiệp vụ có status code, service throw ra, errorHandler bắt lại
class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = AppError;
