const express = require("express");
const productController = require("./product.controller.js");
const {
  validateCreate,
  validateUpdate,
  validateStatus,
} = require("./product.validation.js");
const { verifyToken } = require("../../shared/middlewares/auth.js");
const {
  authorize,
  loadOwnerShop,
} = require("../../shared/middlewares/authorize.js");
const { createImageUpload } = require("../../shared/utils/upload.js");

const productRouter = express.Router();
const ownerOnly = [verifyToken, authorize("SHOP_OWNER"), loadOwnerShop];
// field "images" trong form-data, tối đa 10 file
const uploadImages = createImageUpload("products").array("images", 10);

// Shop Owner - đặt trước /products/:id để không bị nhận nhầm "manage" là id
productRouter.get("/products/manage", ownerOnly, productController.getMyProducts);
productRouter.get(
  "/products/manage/:id",
  ownerOnly,
  productController.getMyProductById,
);
productRouter.post(
  "/products",
  ownerOnly,
  uploadImages,
  validateCreate,
  productController.createProduct,
); // UC22
productRouter.put(
  "/products/:id",
  ownerOnly,
  uploadImages,
  validateUpdate,
  productController.updateProduct,
); // UC23
productRouter.patch(
  "/products/:id/status",
  ownerOnly,
  validateStatus,
  productController.updateProductStatus,
); // UC24

// Guest / Customer
productRouter.get("/products", productController.getProducts); // UC25, UC26
productRouter.get("/products/:id", productController.getProductById); // UC27
productRouter.get("/shops/:shopId/page", productController.getShopPage); // UC28

module.exports = productRouter;
