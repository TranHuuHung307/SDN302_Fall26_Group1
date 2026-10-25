// Bản tạm cho các luồng chạy được, Luồng 1 (UC02, UC05) sẽ hoàn thiện.
// Token cần có id user trong payload: { id } (chấp nhận cả _id / userId).
const jwt = require("jsonwebtoken");
const User = require("../../modules/user/user.model.js");
const AppError = require("../errors/AppError.js");

const verifyToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new AppError(401, "Chưa đăng nhập");
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new AppError(401, "Token không hợp lệ hoặc đã hết hạn");
    }

    const userId = decoded.id || decoded._id || decoded.userId;
    const user = await User.findById(userId).select("-password");
    if (!user) {
      throw new AppError(401, "Tài khoản không tồn tại");
    }
    if (user.accountStatus === "BANNED") {
      throw new AppError(403, "Tài khoản đã bị khóa");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { verifyToken };
