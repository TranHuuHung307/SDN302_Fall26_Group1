const shopOrderService = require("./shop-order.service.js");
const asyncHandler = require("../../common/utils/asyncHandler.js");
const { success, paginated } = require("../../common/utils/response.js");

// GET /api/myshop/orders - UC42
const getShopOrders = asyncHandler(async (req, res) => {
  const shopId = req.shopId || req.shop?._id;
  const { items, page, limit, total } = await shopOrderService.getShopOrders({
    shopId,
    query: req.query,
  });
  paginated(
    res,
    items,
    { page, limit, total },
    "Lấy danh sách đơn hàng thành công",
  );
});

// GET /api/myshop/orders/:id - UC42
const getShopOrderById = asyncHandler(async (req, res) => {
  const shopId = req.shopId || req.shop?._id;
  const order = await shopOrderService.getShopOrderById({
    shopId,
    orderId: req.params.id,
  });
  success(res, order, "Lấy thông tin chi tiết đơn hàng thành công");
});

// PATCH /api/myshop/orders/:id/confirm - UC43
const confirmOrder = asyncHandler(async (req, res) => {
  const shopId = req.shopId || req.shop?._id;
  const order = await shopOrderService.confirmOrder({
    shopId,
    orderId: req.params.id,
    userId: req.user._id,
  });
  success(res, order, "Xác nhận đơn hàng thành công");
});

// PATCH /api/myshop/orders/:id/status - UC44
const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const shopId = req.shopId || req.shop?._id;
  const order = await shopOrderService.updateDeliveryStatus({
    shopId,
    orderId: req.params.id,
    orderStatus: req.body.orderStatus,
  });
  success(res, order, "Cập nhật trạng thái đơn hàng thành công");
});

// PATCH /api/myshop/orders/:id/cancel - UC45
const cancelShopOrder = asyncHandler(async (req, res) => {
  const shopId = req.shopId || req.shop?._id;
  const order = await shopOrderService.cancelShopOrder({
    shopId,
    orderId: req.params.id,
    reason: req.body.reason,
    userId: req.user._id,
  });
  success(res, order, "Hủy đơn hàng thành công");
});

module.exports = {
  getShopOrders,
  getShopOrderById,
  confirmOrder,
  updateDeliveryStatus,
  cancelShopOrder,
};
