const express = require("express");
const categoryRouter = require("./modules/categories/category.routes.js");
const productRouter = require("./modules/products/product.routes.js");
const statisticRouter = require("./modules/statistics/statistic.routes.js");

const router = express.Router();

// mỗi module tự khai báo đường dẫn đầy đủ, ở đây chỉ gom lại
// Luồng 3
router.use(categoryRouter);
router.use(productRouter);
router.use(statisticRouter);

module.exports = router;
