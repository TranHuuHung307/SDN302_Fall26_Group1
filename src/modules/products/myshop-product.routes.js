const express = require("express");
const productController = require("./product.controller.js");
const {
  validateCreate,
  validateUpdate,
  validateStatus,
} = require("./product.validation.js");
const { auth } = require("../../common/middlewares/auth.js");
const { shopRole, SHOP_ROLES } = require("../../common/middlewares/role.js");
const { createImageUpload } = require("../../common/middlewares/upload.js");

const myshopProductRouter = express.Router();
const ownerOnly = [auth, shopRole("SHOP_OWNER")];
const shopMembers = [auth, shopRole(...SHOP_ROLES)];
// field "images" trong form-data, tối đa 10 file
const uploadImages = createImageUpload("products").array("images", 10);

myshopProductRouter.get(
  "/myshop/products",
  shopMembers,
  productController.getMyProducts,
); // UC22
myshopProductRouter.get(
  "/myshop/products/:id",
  shopMembers,
  productController.getMyProductById,
);
myshopProductRouter.post(
  "/myshop/products",
  ownerOnly,
  uploadImages,
  validateCreate,
  productController.createProduct,
); // UC22
myshopProductRouter.put(
  "/myshop/products/:id",
  ownerOnly,
  uploadImages,
  validateUpdate,
  productController.updateProduct,
); // UC23
myshopProductRouter.patch(
  "/myshop/products/:id/status",
  ownerOnly,
  validateStatus,
  productController.updateProductStatus,
); // UC24

module.exports = myshopProductRouter;
