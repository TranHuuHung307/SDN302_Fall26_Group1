const mongoose = require("mongoose");
const Order = require("../models/order");
const { resolveShopScope } = require("../utils/access");

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function dateRange(query, res) {
  const range = {};
  for (const key of ["from", "to"]) {
    if (!query[key]) continue;
    if (!datePattern.test(query[key])) {
      res.status(400).json({ success: false, message: `${key} must use YYYY-MM-DD.` });
      return null;
    }
    const date = new Date(`${query[key]}T${key === "from" ? "00:00:00.000" : "23:59:59.999"}+07:00`);
    if (Number.isNaN(date.getTime())) {
      res.status(400).json({ success: false, message: `Invalid ${key} date.` });
      return null;
    }
    range[key === "from" ? "$gte" : "$lte"] = date;
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) {
    res.status(400).json({ success: false, message: "from must not be after to." });
    return null;
  }
  return Object.keys(range).length ? range : null;
}

async function resolveStatisticsShop(req, res) {
  const scope = await resolveShopScope(req.user, req.query.shopId, []);
  if (scope.error) {
    res.status(scope.error.status).json({ success: false, message: scope.error.message });
    return null;
  }
  return new mongoose.Types.ObjectId(String(scope.shopId));
}

async function getRevenue(req, res, next) {
  try {
    const shopId = await resolveStatisticsShop(req, res);
    if (!shopId) return;
    const groupBy = req.query.groupBy || "day";
    if (!["day", "month"].includes(groupBy)) return res.status(400).json({ success: false, message: "groupBy must be day or month." });
    const range = dateRange(req.query, res);
    if (range === null && (req.query.from || req.query.to) && res.headersSent) return;
    const match = { shopId, orderStatus: "DELIVERED", paymentStatus: "PAID" };
    if (range) match.createdAt = range;
    const data = await Order.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: groupBy === "day" ? "%Y-%m-%d" : "%Y-%m", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } }, revenue: { $sum: "$totalAmount" }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", revenue: 1, orders: 1 } },
    ]);
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
}

async function getTopProducts(req, res, next) {
  try {
    const shopId = await resolveStatisticsShop(req, res);
    if (!shopId) return;
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 5, 1), 50);
    const range = dateRange(req.query, res);
    if (range === null && (req.query.from || req.query.to) && res.headersSent) return;
    const match = { shopId, orderStatus: "DELIVERED", paymentStatus: "PAID" };
    if (range) match.createdAt = range;
    const data = await Order.aggregate([
      { $match: match }, { $unwind: "$items" },
      { $group: { _id: "$items.productId", productName: { $last: "$items.productName" }, quantity: { $sum: "$items.quantity" }, revenue: { $sum: "$items.subtotal" } } },
      { $sort: { quantity: -1, revenue: -1 } }, { $limit: limit },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
      { $project: { _id: 0, productId: "$_id", productName: { $ifNull: [{ $first: "$product.productName" }, "$productName"] }, quantity: 1, revenue: 1 } },
    ]);
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
}

module.exports = { getRevenue, getTopProducts };
