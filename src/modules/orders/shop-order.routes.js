const express = require("express");
const shopOrderController = require("./shop-order.controller.js");
const {
  validateOrderId,
  validateListOrdersQuery,
  validateUpdateStatus,
  validateCancelOrder,
} = require("./shop-order.validation.js");
const { auth } = require("../../common/middlewares/auth.js");
const { shopRole } = require("../../common/middlewares/role.js");

const shopOrderRouter = express.Router();
const orderAuth = [auth, shopRole("SHOP_OWNER", "ORDER_STAFF")];

// UC42: Xem danh sách đơn của shop
shopOrderRouter.get(
  ["/myshop/orders", "/shop/orders"],
  orderAuth,
  validateListOrdersQuery,
  shopOrderController.getShopOrders,
);

// UC42: Xem chi tiết đơn của shop
shopOrderRouter.get(
  ["/myshop/orders/:id", "/shop/orders/:id"],
  orderAuth,
  validateOrderId,
  shopOrderController.getShopOrderById,
);

// UC43: Xác nhận đơn hàng
shopOrderRouter.patch(
  ["/myshop/orders/:id/confirm", "/shop/orders/:id/confirm"],
  orderAuth,
  validateOrderId,
  shopOrderController.confirmOrder,
);

// UC44: Cập nhật trạng thái giao hàng
shopOrderRouter.patch(
  ["/myshop/orders/:id/status", "/shop/orders/:id/status"],
  orderAuth,
  validateOrderId,
  validateUpdateStatus,
  shopOrderController.updateDeliveryStatus,
);

// UC45: Shop hủy đơn & hoàn tiền
shopOrderRouter.patch(
  ["/myshop/orders/:id/cancel", "/shop/orders/:id/cancel"],
  orderAuth,
  validateOrderId,
  validateCancelOrder,
  shopOrderController.cancelShopOrder,
);

module.exports = shopOrderRouter;
