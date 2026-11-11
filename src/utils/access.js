const mongoose = require("mongoose");
const Shop = require("../models/shop");
const ShopStaff = require("../models/shopStaff");

async function canManageShop(user, shopId, permittedStaffRoles = []) {
  if (!mongoose.isValidObjectId(shopId)) return false;
  if (user.role === "ADMIN") return true;
  const shop = await Shop.findById(shopId).select("ownerId").lean();
  if (!shop) return false;
  if (user.role === "SHOP_OWNER" && String(shop.ownerId) === String(user._id)) return true;
  if (user.role === "STAFF" && permittedStaffRoles.length) {
    return Boolean(await ShopStaff.exists({ shopId, userId: user._id, role: { $in: permittedStaffRoles } }));
  }
  return false;
}

function validId(id) { return mongoose.isValidObjectId(id); }

async function resolveShopScope(user, requestedShopId, permittedStaffRoles = []) {
  if (requestedShopId) {
    if (!await canManageShop(user, requestedShopId, permittedStaffRoles)) {
      return { error: { status: 403, message: "No access to this shop." } };
    }
    return { shopId: requestedShopId };
  }
  if (user.role === "SHOP_OWNER") {
    const shops = await Shop.find({ ownerId: user._id }).select("_id").lean();
    if (shops.length === 1) return { shopId: shops[0]._id };
    if (shops.length > 1) return { error: { status: 400, message: "shopId is required because you manage multiple shops." } };
  }
  if (user.role === "STAFF" && permittedStaffRoles.length) {
    const assignments = await ShopStaff.find({ userId: user._id, role: { $in: permittedStaffRoles } }).select("shopId").lean();
    if (assignments.length === 1) return { shopId: assignments[0].shopId };
    if (assignments.length > 1) return { error: { status: 400, message: "shopId is required because you are assigned to multiple shops." } };
  }
  return { error: { status: 403, message: "You do not have access to a shop for this action." } };
}

module.exports = { canManageShop, validId, resolveShopScope };
