const Cart = require("../models/cart");
const Product = require("../models/product");
const { validId } = require("../utils/access");

async function getCart(req, res, next) {
  try {
    let cart = await Cart.findOne({ customerId: req.user._id }).populate({ path: "items.productId", select: "productName price stockQuantity images productStatus shopId", populate: { path: "shopId", select: "shopName address approvalStatus operationStatus" } }).lean();
    if (!cart) cart = { customerId: req.user._id, items: [] };
    const items = cart.items.map((item) => ({ productId: item.productId, quantity: item.quantity, subtotal: item.productId ? item.productId.price * item.quantity : null }));
    const groups = new Map();
    for (const item of items) {
      const product = item.productId;
      if (!product) continue;
      const shop = product.shopId;
      const shopKey = String(shop?._id || shop || "unknown");
      if (!groups.has(shopKey)) groups.set(shopKey, { shop, items: [], subtotal: 0 });
      const group = groups.get(shopKey);
      group.items.push({ productId: String(product._id), productName: product.productName, price: product.price, stockQuantity: product.stockQuantity, images: product.images, quantity: item.quantity, subtotal: item.subtotal });
      group.subtotal += item.subtotal || 0;
    }
    return res.json({ success: true, data: { ...cart, items, shops: [...groups.values()], totalItems: items.reduce((sum, item) => sum + item.quantity, 0), totalAmount: items.reduce((sum, item) => sum + (item.subtotal || 0), 0) } });
  } catch (error) { return next(error); }
}

async function addItem(req, res, next) {
  try {
    const { productId, quantity } = req.body || {};
    if (!validId(productId) || !Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ success: false, message: "productId and a positive integer quantity are required." });
    const product = await Product.findOne({ _id: productId, productStatus: "AVAILABLE", stockQuantity: { $gt: 0 } });
    if (!product) return res.status(404).json({ success: false, message: "Available product not found." });
    let cart = await Cart.findOne({ customerId: req.user._id });
    if (!cart) cart = new Cart({ customerId: req.user._id, items: [] });
    const item = cart.items.find((entry) => String(entry.productId) === String(productId));
    if ((item?.quantity || 0) + quantity > product.stockQuantity) return res.status(409).json({ success: false, message: "Requested quantity exceeds available stock." });
    if (item) item.quantity += quantity;
    else cart.items.push({ productId, quantity });
    await cart.save();
    return getCart(req, res, next);
  } catch (error) { return next(error); }
}

async function setItemQuantity(req, res, next) {
  try {
    if (!validId(req.params.productId)) return res.status(400).json({ success: false, message: "Invalid product id." });
    const quantity = req.body?.quantity;
    if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ success: false, message: "quantity must be a positive integer." });
    const [cart, product] = await Promise.all([Cart.findOne({ customerId: req.user._id }), Product.findById(req.params.productId)]);
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found." });
    const item = cart.items.find((entry) => String(entry.productId) === req.params.productId);
    if (!item) return res.status(404).json({ success: false, message: "Cart item not found." });
    if (!product || product.productStatus !== "AVAILABLE" || quantity > product.stockQuantity) return res.status(409).json({ success: false, message: "Requested quantity exceeds available stock." });
    item.quantity = quantity;
    await cart.save();
    return getCart(req, res, next);
  } catch (error) { return next(error); }
}

async function removeItem(req, res, next) {
  try {
    if (!validId(req.params.productId)) return res.status(400).json({ success: false, message: "Invalid product id." });
    const cart = await Cart.findOne({ customerId: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found." });
    const before = cart.items.length;
    cart.items = cart.items.filter((item) => String(item.productId) !== req.params.productId);
    if (cart.items.length === before) return res.status(404).json({ success: false, message: "Cart item not found." });
    await cart.save();
    return getCart(req, res, next);
  } catch (error) { return next(error); }
}

async function clearCart(req, res, next) {
  try { await Cart.findOneAndUpdate({ customerId: req.user._id }, { $set: { items: [] } }, { upsert: true, new: true }); return res.json({ success: true, data: { items: [], totalAmount: 0 } }); }
  catch (error) { return next(error); }
}

module.exports = { getCart, addItem, setItemQuantity, removeItem, clearCart };
