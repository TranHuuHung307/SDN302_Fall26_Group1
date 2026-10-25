const express = require("express");
const categoryRouter = require("./modules/category/category.routes.js");
const productRouter = require("./modules/product/product.routes.js");
const statisticRouter = require("./modules/statistic/statistic.routes.js");

const router = express.Router();

// mỗi module tự khai báo đường dẫn đầy đủ, ở đây chỉ gom lại
// Luồng 3
router.use(categoryRouter);
router.use(productRouter);
router.use(statisticRouter);

module.exports = router;
