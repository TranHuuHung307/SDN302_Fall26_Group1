const express = require("express");
const {
  getProducts, getProductById, createProduct, updateProduct, deleteProduct,
  getMyProducts, getMyProductById, createMyShopProduct, updateMyShopProduct, updateMyProductStatus,
} = require("../controllers/product.js");
const { authenticate, allowRoles } = require("../middleware/auth.js");
const { productImageUpload } = require("../middleware/upload.js");

const productRouter = express.Router();

// Products
productRouter.get("/products", getProducts);
productRouter.get("/products/:id", getProductById);
productRouter.post("/products", authenticate, allowRoles("ADMIN", "SHOP_OWNER", "STAFF"), createProduct);
productRouter.put("/products/:id", authenticate, allowRoles("ADMIN", "SHOP_OWNER", "STAFF"), updateProduct);
productRouter.patch("/products/:id", authenticate, allowRoles("ADMIN", "SHOP_OWNER", "STAFF"), updateProduct);
productRouter.delete("/products/:id", authenticate, allowRoles("ADMIN", "SHOP_OWNER", "STAFF"), deleteProduct);
productRouter.get("/myshop/products", authenticate, allowRoles("ADMIN", "SHOP_OWNER", "STAFF"), getMyProducts);
productRouter.get("/myshop/products/:id", authenticate, allowRoles("ADMIN", "SHOP_OWNER", "STAFF"), getMyProductById);
productRouter.post("/myshop/products", authenticate, allowRoles("ADMIN", "SHOP_OWNER"), productImageUpload, createMyShopProduct);
productRouter.put("/myshop/products/:id", authenticate, allowRoles("ADMIN", "SHOP_OWNER"), productImageUpload, updateMyShopProduct);
productRouter.patch("/myshop/products/:id/status", authenticate, allowRoles("ADMIN", "SHOP_OWNER"), updateMyProductStatus);

module.exports = productRouter;
