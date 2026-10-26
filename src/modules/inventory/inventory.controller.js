const inventoryService = require("./inventory.service.js");
const asyncHandler = require("../../common/utils/asyncHandler.js");
const { success, paginated } = require("../../common/utils/response.js");

// POST /api/myshop/inventory/import - UC38
const importStock = asyncHandler(async (req, res) => {
  const shopId = req.shopId || req.shop?._id;
  const result = await inventoryService.importStock({
    shopId,
    productId: req.body.productId,
    quantity: req.body.quantity,
    note: req.body.note,
    userId: req.user._id,
  });
  success(res, result, "Nhập kho thành công", 201);
});

// POST /api/myshop/inventory/export - UC39
const exportStock = asyncHandler(async (req, res) => {
  const shopId = req.shopId || req.shop?._id;
  const result = await inventoryService.exportStock({
    shopId,
    productId: req.body.productId,
    quantity: req.body.quantity,
    note: req.body.note,
    userId: req.user._id,
  });
  success(res, result, "Xuất hủy hàng thành công");
});

// GET /api/myshop/inventory/transactions - UC40
const getTransactions = asyncHandler(async (req, res) => {
  const shopId = req.shopId || req.shop?._id;
  const { items, page, limit, total } = await inventoryService.getTransactions({
    shopId,
    query: req.query,
  });
  paginated(
    res,
    items,
    { page, limit, total },
    "Lấy danh sách giao dịch kho thành công",
  );
});

// GET /api/myshop/inventory/alerts - UC41
const getAlerts = asyncHandler(async (req, res) => {
  const shopId = req.shopId || req.shop?._id;
  const alerts = await inventoryService.getAlerts({
    shopId,
    days: req.query.days,
  });
  success(res, alerts, "Lấy danh sách cảnh báo tồn kho thành công");
});

module.exports = {
  importStock,
  exportStock,
  getTransactions,
  getAlerts,
};
