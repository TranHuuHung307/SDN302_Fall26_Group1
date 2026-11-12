const Shop = require("../models/shop");
const ShopStaff = require("../models/shopStaff");
const ShopRegistrationRequest = require("../models/shopRegistrationRequest");
const User = require("../models/user");
const { canManageShop, validId } = require("../utils/access");

async function listShops(req, res, next) {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = { approvalStatus: "APPROVED", operationStatus: "OPEN" };
    if (req.query.search) filter.shopName = { $regex: String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const [data, total] = await Promise.all([Shop.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Shop.countDocuments(filter)]);
    return res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
}

async function getShop(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid shop id." });
    const shop = await Shop.findOne({ _id: req.params.id, approvalStatus: "APPROVED", operationStatus: "OPEN" }).select("shopName address logoUrl phone bannerUrl approvalStatus operationStatus createdAt").lean();
    if (!shop) return res.status(404).json({ success: false, message: "Shop not found." });
    return res.json({ success: true, data: shop });
  } catch (error) { return next(error); }
}

async function requestShop(req, res, next) {
  try {
    const { shopName, description } = req.body || {};
    if (typeof shopName !== "string" || !shopName.trim()) return res.status(400).json({ success: false, message: "shopName is required." });
    if (await ShopRegistrationRequest.exists({ customerId: req.user._id, status: "PENDING" })) return res.status(409).json({ success: false, message: "You already have a pending shop request." });
    const data = await ShopRegistrationRequest.create({ customerId: req.user._id, shopName: shopName.trim(), description });
    return res.status(201).json({ success: true, data });
  } catch (error) { return next(error); }
}

async function myRequests(req, res, next) {
  try { return res.json({ success: true, data: await ShopRegistrationRequest.find({ customerId: req.user._id }).sort({ createdAt: -1 }).lean() }); }
  catch (error) { return next(error); }
}

async function listRequests(req, res, next) {
  try {
    const status = req.query.status;
    if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) return res.status(400).json({ success: false, message: "Invalid status." });
    const filter = status ? { status } : {};
    const data = await ShopRegistrationRequest.find(filter).populate("customerId", "fullName email").populate("reviewedBy", "fullName email").sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
}

async function reviewRequest(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid request id." });
    const { status, address, phone, logoUrl, bannerUrl } = req.body || {};
    if (!["APPROVED", "REJECTED"].includes(status)) return res.status(400).json({ success: false, message: "status must be APPROVED or REJECTED." });
    const request = await ShopRegistrationRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found." });
    if (request.status !== "PENDING") return res.status(409).json({ success: false, message: "This request has already been reviewed." });
    request.status = status;
    request.reviewedBy = req.user._id;
    await request.save();
    let shop = null;
    if (status === "APPROVED") {
      shop = await Shop.create({ ownerId: request.customerId, shopName: request.shopName, address, phone, logoUrl, bannerUrl, approvalStatus: "APPROVED" });
      await User.updateOne({ _id: request.customerId }, { $set: { role: "SHOP_OWNER" } });
    }
    await require("../models/notification").create({
      receiverId: request.customerId,
      title: status === "APPROVED" ? "Shop request approved" : "Shop request rejected",
      message: status === "APPROVED" ? `Your shop ${request.shopName} has been approved.` : `Your request for ${request.shopName} was rejected.`,
      type: "SHOP_REGISTRATION",
    }).catch((notificationError) => console.error("Shop request notification failed:", notificationError));
    return res.json({ success: true, data: { request, shop } });
  } catch (error) { return next(error); }
}

async function updateShop(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid shop id." });
    if (!await canManageShop(req.user, req.params.id)) return res.status(403).json({ success: false, message: "No access to this shop." });
    const fields = ["shopName", "address", "phone", "logoUrl", "bannerUrl", "operationStatus"];
    const updates = Object.fromEntries(fields.filter((field) => req.body?.[field] !== undefined).map((field) => [field, req.body[field]]));
    if (updates.shopName !== undefined && (typeof updates.shopName !== "string" || !updates.shopName.trim())) return res.status(400).json({ success: false, message: "shopName cannot be empty." });
    if (updates.operationStatus && !["OPEN", "CLOSED"].includes(updates.operationStatus)) return res.status(400).json({ success: false, message: "Invalid operationStatus." });
    if (updates.shopName) updates.shopName = updates.shopName.trim();
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: "No supported fields were provided." });
    const shop = await Shop.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    return res.json({ success: true, data: shop });
  } catch (error) { return next(error); }
}

async function listStaff(req, res, next) {
  try {
    if (!await canManageShop(req.user, req.params.shopId)) return res.status(403).json({ success: false, message: "No access to this shop." });
    const data = await ShopStaff.find({ shopId: req.params.shopId }).populate("userId", "fullName email phone role").sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
}

async function addStaff(req, res, next) {
  try {
    const { userId, role } = req.body || {};
    if (!validId(req.params.shopId) || !validId(userId)) return res.status(400).json({ success: false, message: "Valid shopId and userId are required." });
    if (!await canManageShop(req.user, req.params.shopId)) return res.status(403).json({ success: false, message: "No access to this shop." });
    if (!["INVENTORY_STAFF", "ORDER_STAFF"].includes(role)) return res.status(400).json({ success: false, message: "Invalid staff role." });
    const user = await User.findById(userId);
    if (!user || user.accountStatus !== "ACTIVE") return res.status(404).json({ success: false, message: "Active user not found." });
    if (["ADMIN", "SHOP_OWNER"].includes(user.role)) return res.status(400).json({ success: false, message: "Administrators and shop owners cannot be added as staff." });
    const data = await ShopStaff.create({ shopId: req.params.shopId, userId, role });
    if (user.role === "CUSTOMER") await User.updateOne({ _id: userId }, { $set: { role: "STAFF" } });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "User is already assigned to this shop." });
    return next(error);
  }
}

async function removeStaff(req, res, next) {
  try {
    if (!validId(req.params.shopId) || !validId(req.params.userId)) return res.status(400).json({ success: false, message: "Invalid id." });
    if (!await canManageShop(req.user, req.params.shopId)) return res.status(403).json({ success: false, message: "No access to this shop." });
    const result = await ShopStaff.findOneAndDelete({ shopId: req.params.shopId, userId: req.params.userId });
    if (!result) return res.status(404).json({ success: false, message: "Staff assignment not found." });
    const remaining = await ShopStaff.exists({ userId: req.params.userId });
    if (!remaining) await User.updateOne({ _id: req.params.userId, role: "STAFF" }, { $set: { role: "CUSTOMER" } });
    return res.json({ success: true, message: "Staff assignment removed." });
  } catch (error) { return next(error); }
}

async function listAdminShops(req, res, next) {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};
    if (req.query.approvalStatus) {
      if (!["PENDING", "APPROVED", "REJECTED", "SUSPENDED"].includes(req.query.approvalStatus)) return res.status(400).json({ success: false, message: "Invalid approvalStatus." });
      filter.approvalStatus = req.query.approvalStatus;
    }
    if (req.query.operationStatus) {
      if (!["OPEN", "CLOSED"].includes(req.query.operationStatus)) return res.status(400).json({ success: false, message: "Invalid operationStatus." });
      filter.operationStatus = req.query.operationStatus;
    }
    if (req.query.search) filter.shopName = { $regex: String(req.query.search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const [data, total] = await Promise.all([Shop.find(filter).populate("ownerId", "fullName email phone").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Shop.countDocuments(filter)]);
    return res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
}

async function updateShopApprovalStatus(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid shop id." });
    const { approvalStatus } = req.body || {};
    if (!["APPROVED", "SUSPENDED"].includes(approvalStatus)) return res.status(400).json({ success: false, message: "approvalStatus must be APPROVED or SUSPENDED." });
    const shop = await Shop.findByIdAndUpdate(req.params.id, { $set: { approvalStatus } }, { new: true, runValidators: true });
    if (!shop) return res.status(404).json({ success: false, message: "Shop not found." });
    await require("../models/notification").create({ receiverId: shop.ownerId, title: approvalStatus === "SUSPENDED" ? "Shop suspended" : "Shop reactivated", message: approvalStatus === "SUSPENDED" ? `Your shop ${shop.shopName} has been suspended.` : `Your shop ${shop.shopName} has been reactivated.`, type: "SHOP_REGISTRATION" }).catch((error) => console.error("Shop status notification failed:", error));
    return res.json({ success: true, data: shop });
  } catch (error) { return next(error); }
}

module.exports = { listShops, getShop, requestShop, myRequests, listRequests, reviewRequest, updateShop, listStaff, addStaff, removeStaff, listAdminShops, updateShopApprovalStatus };
