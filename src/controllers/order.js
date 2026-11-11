const Cart = require("../models/cart");
const Order = require("../models/order");
const Product = require("../models/product");
const Shop = require("../models/shop");
const ShopStaff = require("../models/shopStaff");
const StockTransaction = require("../models/stockTransaction");
const Notification = require("../models/notification");
const { canManageShop, validId, resolveShopScope } = require("../utils/access");

const orderStatuses = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPING", "DELIVERED", "CANCELLED"];

async function reserveOrderStock(order, userId) {
  const changed = [];
  try {
    for (const item of order.items) {
      const result = await Product.updateOne({ _id: item.productId, shopId: order.shopId, productStatus: "AVAILABLE", stockQuantity: { $gte: item.quantity } }, { $inc: { stockQuantity: -item.quantity } });
      if (!result.modifiedCount) throw Object.assign(new Error(`Not enough stock for ${item.productName}.`), { status: 409 });
      changed.push(item);
    }
    await StockTransaction.insertMany(order.items.map((item) => ({ productId: item.productId, shopId: order.shopId, type: "EXPORT", quantity: item.quantity, note: `Reserved for order ${order._id}`, createdBy: userId })));
  } catch (error) {
    await Promise.all(changed.map((item) => Product.updateOne({ _id: item.productId }, { $inc: { stockQuantity: item.quantity } }).catch(() => {})));
    await StockTransaction.deleteMany({ shopId: order.shopId, note: `Reserved for order ${order._id}` }).catch(() => {});
    throw error;
  }
}

async function restockOrder(order, userId, reason) {
  for (const item of order.items) {
    await Product.updateOne({ _id: item.productId }, { $inc: { stockQuantity: item.quantity } });
    await StockTransaction.create({ productId: item.productId, shopId: order.shopId, type: "IMPORT", quantity: item.quantity, note: `${reason} ${order._id}`, createdBy: userId });
  }
}

async function checkout(req, res, next) {
  const createdOrders = [];
  try {
    const { shippingAddress, phone, shopId: requestedShopId } = req.body || {};
    const requestedPaymentMethod = req.body?.paymentMethod || "COD";
    const paymentMethod = requestedPaymentMethod === "MOCK_ONLINE" ? "ONLINE" : requestedPaymentMethod;
    if (typeof shippingAddress !== "string" || !shippingAddress.trim()) return res.status(400).json({ success: false, message: "shippingAddress is required." });
    if (phone !== undefined && (typeof phone !== "string" || !phone.trim())) return res.status(400).json({ success: false, message: "phone must be a non-empty string." });
    if (!["COD", "ONLINE"].includes(paymentMethod)) return res.status(400).json({ success: false, message: "paymentMethod must be COD or ONLINE." });
    const cart = await Cart.findOne({ customerId: req.user._id });
    if (!cart || !cart.items.length) return res.status(400).json({ success: false, message: "Your cart is empty." });
    const productIds = cart.items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const productById = new Map(products.map((product) => [String(product._id), product]));
    if (products.length !== new Set(productIds.map(String)).size) return res.status(409).json({ success: false, message: "A product in your cart no longer exists." });
    const grouped = new Map();
    for (const item of cart.items) {
      const product = productById.get(String(item.productId));
      const key = String(product.shopId);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    }
    if (requestedShopId && !validId(requestedShopId)) return res.status(400).json({ success: false, message: "Invalid shopId." });
    const selectedGroups = requestedShopId ? [[requestedShopId, grouped.get(String(requestedShopId))]] : [...grouped.entries()];
    if (requestedShopId && !grouped.has(String(requestedShopId))) return res.status(400).json({ success: false, message: "No cart items belong to this shop." });

    // A cart may contain products from several shops; this schema stores one shop per order.
    // Create one order per shop, as the customer storefront expects.
    const shops = new Map();
    for (const [shopId] of selectedGroups) {
      const shop = await Shop.findOne({ _id: shopId, approvalStatus: "APPROVED", operationStatus: "OPEN" });
      if (!shop) return res.status(409).json({ success: false, message: "A shop in your cart is unavailable." });
      shops.set(String(shopId), shop);
    }

    for (const [shopId, chosen] of selectedGroups) {
      const orderItems = [];
      for (const item of chosen) {
      const product = productById.get(String(item.productId));
      if (!product || product.productStatus !== "AVAILABLE") return res.status(409).json({ success: false, message: "A product in your cart is no longer available." });
      if (item.quantity > product.stockQuantity) return res.status(409).json({ success: false, message: `Not enough stock for ${product.productName}.` });
      orderItems.push({ productId: product._id, productName: product.productName, price: product.price, quantity: item.quantity, subtotal: product.price * item.quantity });
      }
      const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
      const order = await Order.create({ customerId: req.user._id, shopId, items: orderItems, shippingAddress: shippingAddress.trim(), phone: phone?.trim(), paymentMethod, totalAmount, paymentStatus: "UNPAID" });
      createdOrders.push(order);
    }
    const checkedOutProductIds = new Set(selectedGroups.flatMap(([, items]) => items.map((item) => String(item.productId))));
    cart.items = cart.items.filter((item) => !checkedOutProductIds.has(String(item.productId)));
    await cart.save();
    await Notification.insertMany(createdOrders.map((order) => ({ receiverId: shops.get(String(order.shopId)).ownerId, title: "New order", message: `Order ${order._id} is waiting for confirmation.`, type: "ORDER" }))).catch((notificationError) => console.error("Order notification failed:", notificationError));
    return res.status(201).json({ success: true, message: "Order checkout completed.", data: { orders: createdOrders, totalOrders: createdOrders.length }, payment: { simulated: paymentMethod === "ONLINE", status: "UNPAID", nextActions: paymentMethod === "ONLINE" ? createdOrders.map((order) => `POST /orders/${order._id}/pay`) : [] } });
  } catch (error) {
    if (createdOrders.length) await Order.deleteMany({ _id: { $in: createdOrders.map((order) => order._id) } }).catch(() => {});
    return next(error);
  }
}

async function listOrders(req, res, next) {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};
    if (req.query.shopId) {
      if (!validId(req.query.shopId)) return res.status(400).json({ success: false, message: "Invalid shopId." });
      if (!await canManageShop(req.user, req.query.shopId, ["ORDER_STAFF"])) return res.status(403).json({ success: false, message: "No access to this shop." });
      filter.shopId = req.query.shopId;
    } else {
      filter.customerId = req.user._id;
    }
    const requestedStatus = req.query.status || req.query.orderStatus;
    if (requestedStatus) {
      if (!orderStatuses.includes(String(requestedStatus).toUpperCase())) return res.status(400).json({ success: false, message: "Invalid order status." });
      filter.orderStatus = String(requestedStatus).toUpperCase();
    }
    if (req.query.paymentStatus) {
      if (!["UNPAID", "PAID", "REFUNDED"].includes(String(req.query.paymentStatus).toUpperCase())) return res.status(400).json({ success: false, message: "Invalid paymentStatus." });
      filter.paymentStatus = String(req.query.paymentStatus).toUpperCase();
    }
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) { filter.createdAt.$lte = new Date(req.query.to); filter.createdAt.$lte.setHours(23, 59, 59, 999); }
      if (Object.values(filter.createdAt).some((date) => Number.isNaN(date.getTime()))) return res.status(400).json({ success: false, message: "Invalid date filter." });
      if (filter.createdAt.$gte && filter.createdAt.$lte && filter.createdAt.$gte > filter.createdAt.$lte) return res.status(400).json({ success: false, message: "from must not be after to." });
    }
    const [data, total] = await Promise.all([Order.find(filter).populate("shopId", "shopName phone").populate("customerId", "fullName email phone").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Order.countDocuments(filter)]);
    return res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
}

async function getOrder(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid order id." });
    const order = await Order.findById(req.params.id).populate("shopId", "shopName phone address").populate("customerId", "fullName email phone").populate("items.productId", "productName price images stockQuantity expiryDate").lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    const isCustomer = String(order.customerId?._id || order.customerId) === String(req.user._id);
    const canView = isCustomer || req.user.role === "ADMIN" || await canManageShop(req.user, order.shopId?._id || order.shopId, ["ORDER_STAFF"]);
    if (!canView) return res.status(403).json({ success: false, message: "No access to this order." });
    return res.json({ success: true, data: order });
  } catch (error) { return next(error); }
}

async function listShopOrders(req, res, next) {
  try {
    const scope = await resolveShopScope(req.user, req.query.shopId, ["ORDER_STAFF"]);
    if (scope.error) return res.status(scope.error.status).json({ success: false, message: scope.error.message });
    req.query.shopId = String(scope.shopId);
    return listOrders(req, res, next);
  } catch (error) { return next(error); }
}

async function getShopOrder(req, res, next) {
  try {
    const order = await Order.findById(req.params.id).select("shopId").lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    const scope = await resolveShopScope(req.user, req.query.shopId || String(order.shopId), ["ORDER_STAFF"]);
    if (scope.error) return res.status(scope.error.status).json({ success: false, message: scope.error.message });
    if (String(scope.shopId) !== String(order.shopId)) return res.status(404).json({ success: false, message: "Order not found in this shop." });
    return getOrder(req, res, next);
  } catch (error) { return next(error); }
}

async function payOrder(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid order id." });
    const order = await Order.findOne({ _id: req.params.id, customerId: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (order.paymentMethod !== "ONLINE") return res.status(400).json({ success: false, message: "Only ONLINE orders use simulated payment." });
    if (order.orderStatus === "CANCELLED") return res.status(409).json({ success: false, message: "Cancelled orders cannot be paid." });
    if (order.paymentStatus === "PAID") return res.json({ success: true, message: "Order is already paid.", data: order });
    order.paymentStatus = "PAID";
    await order.save();
    return res.json({ success: true, message: "Simulated payment succeeded.", data: order, payment: { simulated: true, status: "PAID" } });
  } catch (error) { return next(error); }
}

async function cancelOrder(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid order id." });
    const order = await Order.findOne({ _id: req.params.id, customerId: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (order.orderStatus !== "PENDING") return res.status(409).json({ success: false, message: "Only pending orders can be cancelled by the customer." });
    order.orderStatus = "CANCELLED";
    if (order.paymentStatus === "PAID") order.paymentStatus = "REFUNDED";
    await order.save();
    return res.json({ success: true, data: order, payment: { simulated: order.paymentMethod === "ONLINE", status: order.paymentStatus } });
  } catch (error) { return next(error); }
}

async function updateOrderStatus(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid order id." });
    const { orderStatus } = req.body || {};
    if (!orderStatuses.includes(orderStatus)) return res.status(400).json({ success: false, message: "Invalid orderStatus." });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (!await canManageShop(req.user, order.shopId, ["ORDER_STAFF"])) return res.status(403).json({ success: false, message: "No access to this shop." });
    const allowed = { PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PREPARING", "CANCELLED"], PREPARING: ["SHIPPING", "CANCELLED"], SHIPPING: ["DELIVERED"], DELIVERED: [], CANCELLED: [] };
    if (!allowed[order.orderStatus].includes(orderStatus)) return res.status(409).json({ success: false, message: `Cannot move order from ${order.orderStatus} to ${orderStatus}.` });
    if (orderStatus === "CONFIRMED") await reserveOrderStock(order, req.user._id);
    if (orderStatus === "CANCELLED") {
      if (["CONFIRMED", "PREPARING"].includes(order.orderStatus)) await restockOrder(order, req.user._id, "Restocked after cancellation of order");
      if (order.paymentStatus === "PAID") order.paymentStatus = "REFUNDED";
    }
    if (orderStatus === "DELIVERED" && order.paymentMethod === "COD") order.paymentStatus = "PAID";
    order.orderStatus = orderStatus;
    await order.save();
    await Notification.create({ receiverId: order.customerId, title: `Order ${orderStatus.toLowerCase()}`, message: `Your order ${order._id} is now ${orderStatus.toLowerCase()}.`, type: "ORDER" });
    return res.json({ success: true, data: order });
  } catch (error) { return next(error); }
}

module.exports = { checkout, listOrders, getOrder, payOrder, cancelOrder, updateOrderStatus, listShopOrders, getShopOrder };
