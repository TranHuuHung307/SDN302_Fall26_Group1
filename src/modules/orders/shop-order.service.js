const Order = require("../../models/order.model.js");
const Product = require("../../models/product.model.js");
const StockTransaction = require("../../models/stockTransaction.model.js");
const Notification = require("../../models/notification.model.js");
const AppError = require("../../common/errors/AppError.js");
const { getPagination } = require("../../common/utils/query.js");

// UC42: Xem danh sách đơn của shop
const getShopOrders = async ({ shopId, query }) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { shopId };

  if (query.orderStatus) {
    filter.orderStatus = query.orderStatus.toUpperCase();
  }

  if (query.paymentStatus) {
    filter.paymentStatus = query.paymentStatus.toUpperCase();
  }

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) {
      filter.createdAt.$gte = new Date(query.from);
    }
    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = toDate;
    }
  }

  const [items, total] = await Promise.all([
    Order.find(filter)
      .populate("customerId", "fullName email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return { items, page, limit, total };
};

// UC42: Xem chi tiết đơn hàng của shop
const getShopOrderById = async ({ shopId, orderId }) => {
  const order = await Order.findOne({ _id: orderId, shopId })
    .populate("customerId", "fullName email phone")
    .populate(
      "items.productId",
      "productName price images stockQuantity expiryDate",
    );

  if (!order) {
    throw new AppError(404, "Không tìm thấy đơn hàng");
  }

  return order;
};

// UC43: Xác nhận đơn hàng (PENDING -> CONFIRMED, trừ kho, tạo EXPORT)
const confirmOrder = async ({ shopId, orderId, userId }) => {
  const order = await Order.findOne({ _id: orderId, shopId });
  if (!order) {
    throw new AppError(404, "Không tìm thấy đơn hàng");
  }

  if (order.orderStatus !== "PENDING") {
    throw new AppError(
      400,
      `Chỉ có thể xác nhận đơn hàng đang ở trạng thái PENDING (trạng thái hiện tại: ${order.orderStatus})`,
    );
  }

  // 1. Kiểm tra tồn kho của tất cả sản phẩm trong đơn
  const productMap = new Map();
  for (const item of order.items) {
    const product = await Product.findOne({ _id: item.productId, shopId });
    if (!product) {
      throw new AppError(
        400,
        `Sản phẩm "${item.productName}" không tồn tại hoặc không thuộc shop`,
      );
    }

    const currentStock = product.stockQuantity || 0;
    if (currentStock < item.quantity) {
      throw new AppError(
        400,
        `Sản phẩm "${item.productName}" không đủ tồn kho để xác nhận đơn (cần ${item.quantity}, hiện có ${currentStock})`,
      );
    }

    productMap.set(item.productId.toString(), product);
  }

  // 2. Trừ tồn kho và ghi nhận giao dịch EXPORT
  for (const item of order.items) {
    const product = productMap.get(item.productId.toString());
    product.stockQuantity -= item.quantity;
    await product.save();

    await StockTransaction.create({
      productId: item.productId,
      shopId,
      type: "EXPORT",
      quantity: item.quantity,
      note: `Xuất kho tự động khi xác nhận đơn hàng #${order._id}`,
      createdBy: userId,
    });
  }

  // 3. Cập nhật trạng thái đơn
  order.orderStatus = "CONFIRMED";
  await order.save();

  // 4. Báo thông báo cho khách
  await Notification.create({
    receiverId: order.customerId,
    title: "Đơn hàng đã được xác nhận",
    message: `Đơn hàng #${order._id} của bạn đã được xác nhận và đang chờ chuẩn bị.`,
    type: "ORDER",
  });

  return order;
};

// UC44: Cập nhật trạng thái giao hàng (CONFIRMED -> PREPARING -> SHIPPING -> DELIVERED)
const updateDeliveryStatus = async ({ shopId, orderId, orderStatus }) => {
  const order = await Order.findOne({ _id: orderId, shopId });
  if (!order) {
    throw new AppError(404, "Không tìm thấy đơn hàng");
  }

  if (order.orderStatus === "PENDING") {
    throw new AppError(
      400,
      "Đơn hàng đang ở trạng thái PENDING. Vui lòng xác nhận đơn hàng trước.",
    );
  }
  if (order.orderStatus === "DELIVERED") {
    throw new AppError(
      400,
      "Đơn hàng đã hoàn tất giao hàng, không thể thay đổi trạng thái.",
    );
  }
  if (order.orderStatus === "CANCELLED") {
    throw new AppError(
      400,
      "Đơn hàng đã bị hủy, không thể thay đổi trạng thái.",
    );
  }

  const allowedTransitions = {
    CONFIRMED: ["PREPARING"],
    PREPARING: ["SHIPPING"],
    SHIPPING: ["DELIVERED"],
  };

  const nextAllowed = allowedTransitions[order.orderStatus] || [];
  if (!nextAllowed.includes(orderStatus)) {
    throw new AppError(
      400,
      `Không thể chuyển từ "${order.orderStatus}" sang "${orderStatus}". Các trạng thái hợp lệ tiếp theo: ${nextAllowed.join(", ") || "Không có"}`,
    );
  }

  // COD khi giao thành công (DELIVERED) thì paymentStatus = PAID
  if (orderStatus === "DELIVERED" && order.paymentMethod === "COD") {
    order.paymentStatus = "PAID";
  }

  order.orderStatus = orderStatus;
  await order.save();

  // Gửi thông báo cho khách hàng
  const statusMessages = {
    PREPARING: "đang được đóng gói và chuẩn bị",
    SHIPPING: "đang trên đường giao đến bạn",
    DELIVERED: "đã giao hàng thành công. Cảm ơn bạn đã mua hàng!",
  };

  await Notification.create({
    receiverId: order.customerId,
    title: "Cập nhật trạng thái đơn hàng",
    message: `Đơn hàng #${order._id} ${statusMessages[orderStatus] || orderStatus}.`,
    type: "ORDER",
  });

  return order;
};

// UC45: Shop hủy đơn & hoàn tiền
const cancelShopOrder = async ({ shopId, orderId, reason, userId }) => {
  const order = await Order.findOne({ _id: orderId, shopId });
  if (!order) {
    throw new AppError(404, "Không tìm thấy đơn hàng");
  }

  const cancellableStatuses = ["PENDING", "CONFIRMED", "PREPARING"];
  if (!cancellableStatuses.includes(order.orderStatus)) {
    throw new AppError(
      400,
      `Chỉ có thể hủy đơn khi chưa giao hàng (trạng thái hiện tại: ${order.orderStatus})`,
    );
  }

  // Nếu đơn đã CONFIRMED hoặc PREPARING, tồn kho đã bị trừ ở UC43 -> hoàn lại kho
  if (["CONFIRMED", "PREPARING"].includes(order.orderStatus)) {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stockQuantity: item.quantity },
      });

      await StockTransaction.create({
        productId: item.productId,
        shopId,
        type: "IMPORT",
        quantity: item.quantity,
        note: `Nhập lại kho do hủy đơn hàng #${order._id}${reason ? `: ${reason}` : ""}`,
        createdBy: userId,
      });
    }
  }

  // Nếu đã thanh toán (PAID) -> chuyển sang REFUNDED
  if (order.paymentStatus === "PAID") {
    order.paymentStatus = "REFUNDED";
  }

  order.orderStatus = "CANCELLED";
  await order.save();

  // Báo khách
  const reasonText = reason ? ` Lý do: ${reason}.` : "";
  const refundText =
    order.paymentStatus === "REFUNDED"
      ? " Số tiền đã thanh toán sẽ được hoàn lại."
      : "";

  await Notification.create({
    receiverId: order.customerId,
    title: "Đơn hàng đã bị hủy",
    message: `Đơn hàng #${order._id} đã bị hủy bởi shop.${reasonText}${refundText}`,
    type: "ORDER",
  });

  return order;
};

module.exports = {
  getShopOrders,
  getShopOrderById,
  confirmOrder,
  updateDeliveryStatus,
  cancelShopOrder,
};
