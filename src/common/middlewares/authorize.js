// Bản tạm, Luồng 1 (UC05) sẽ bổ sung phần kiểm tra quyền shop_staff.
const Shop = require("../../modules/shop/shop.model.js");
const AppError = require("../errors/AppError.js");

// dùng sau verifyToken: authorize("SHOP_OWNER"), authorize("ADMIN", "SHOP_OWNER")
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, "Bạn không có quyền thực hiện thao tác này"));
    }
    next();
  };

// gắn shop của chủ shop đang đăng nhập vào req.shop
const loadOwnerShop = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ ownerId: req.user._id });
    if (!shop) {
      throw new AppError(404, "Bạn chưa có shop");
    }
    req.shop = shop;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authorize, loadOwnerShop };
