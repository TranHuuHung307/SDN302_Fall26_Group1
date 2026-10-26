const express = require("express");
const inventoryController = require("./inventory.controller.js");
const {
  validateStockChange,
  validateTransactionsQuery,
} = require("./inventory.validation.js");
const { auth } = require("../../common/middlewares/auth.js");
const { shopRole } = require("../../common/middlewares/role.js");

const inventoryRouter = express.Router();
const inventoryAuth = [auth, shopRole("SHOP_OWNER", "INVENTORY_STAFF")];

// UC38: Nhập kho
inventoryRouter.post(
  ["/myshop/inventory/import", "/inventory/import"],
  inventoryAuth,
  validateStockChange,
  inventoryController.importStock,
);

// UC39: Xuất hủy hàng
inventoryRouter.post(
  ["/myshop/inventory/export", "/inventory/export"],
  inventoryAuth,
  validateStockChange,
  inventoryController.exportStock,
);

// UC40: Xem lịch sử giao dịch kho
inventoryRouter.get(
  ["/myshop/inventory/transactions", "/inventory/transactions"],
  inventoryAuth,
  validateTransactionsQuery,
  inventoryController.getTransactions,
);

// UC41: Cảnh báo hết hàng / sắp hết hạn
inventoryRouter.get(
  ["/myshop/inventory/alerts", "/inventory/alerts"],
  inventoryAuth,
  inventoryController.getAlerts,
);

module.exports = inventoryRouter;
