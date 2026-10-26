// Bản tạm cho các luồng chạy được, Luồng 1 (UC05) sẽ hoàn thiện.
const Shop = require("../../models/shop.model.js");
const ShopStaff = require("../../models/shopStaff.model.js");
const AppError = require("../errors/AppError.js");

const SHOP_ROLES = ["SHOP_OWNER", "INVENTORY_STAFF", "ORDER_STAFF"];

// kiểm tra role của user, dùng sau auth: role("ADMIN"), role("ADMIN", "CUSTOMER")
const role =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, "Bạn không có quyền thực hiện thao tác này"));
    }
    next();
  };

// kiểm tra quyền trong shop và gắn req.shopId (+ req.shopRole), dùng sau auth
// shopRole("SHOP_OWNER") | shopRole("SHOP_OWNER", "INVENTORY_STAFF") | shopRole(...SHOP_ROLES)
const shopRole =
  (...roles) =>
  async (req, res, next) => {
    try {
      let shopId = null;
      let currentRole = null;

      if (req.user.role === "SHOP_OWNER") {
        const shop = await Shop.findOne({ ownerId: req.user._id }).select("_id");
        if (shop) {
          shopId = shop._id;
          currentRole = "SHOP_OWNER";
        }
      } else if (req.user.role === "STAFF") {
        const staff = await ShopStaff.findOne({ userId: req.user._id });
        if (staff) {
          shopId = staff.shopId;
          currentRole = staff.role;
        }
      }

      if (!shopId) {
        throw new AppError(403, "Bạn không thuộc shop nào");
      }
      if (!roles.includes(currentRole)) {
        throw new AppError(403, "Bạn không có quyền thực hiện thao tác này");
      }

      req.shopId = shopId;
      req.shopRole = currentRole;
      next();
    } catch (error) {
      next(error);
    }
  };

module.exports = { role, shopRole, SHOP_ROLES };
