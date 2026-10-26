const express = require("express");
const categoryRouter = require("./modules/categories/category.routes.js");
const productRouter = require("./modules/products/product.routes.js");
const myshopProductRouter = require("./modules/products/myshop-product.routes.js");
const shopRouter = require("./modules/shops/shop.routes.js");
const shopStatsRouter = require("./modules/statistics/shop-stats.routes.js");
const inventoryRouter = require("./modules/inventory/inventory.routes.js");
const shopOrderRouter = require("./modules/orders/shop-order.routes.js");

const router = express.Router();

// mỗi module tự khai báo đường dẫn đầy đủ, ở đây chỉ gom lại
// Luồng 3
router.use(categoryRouter);
router.use(productRouter);
router.use(myshopProductRouter);
router.use(shopRouter);
router.use(shopStatsRouter);

// Luồng 5: Kho hàng & xử lý đơn (phía shop) - Trần Hữu Hưng
router.use(inventoryRouter);
router.use(shopOrderRouter);

module.exports = router;
