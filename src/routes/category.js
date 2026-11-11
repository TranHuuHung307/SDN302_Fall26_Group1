const express = require("express");
const {
  getCategories,
  getCategoriesByShop,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getShopPageCategories,
  getMyCategories,
  createMyCategory,
  updateMyCategory,
} = require("../controllers/category.js");
const { authenticate, allowRoles } = require("../middleware/auth.js");

const categoryRouter = express.Router();

categoryRouter.get("/categories", getCategories);
categoryRouter.get("/categories/shop/:shopId", getCategoriesByShop);
categoryRouter.get("/categories/:id", getCategoryById);
categoryRouter.post("/categories", authenticate, allowRoles("ADMIN", "SHOP_OWNER"), createCategory);
categoryRouter.put("/categories/:id", authenticate, allowRoles("ADMIN", "SHOP_OWNER"), updateCategory);
categoryRouter.patch("/categories/:id", authenticate, allowRoles("ADMIN", "SHOP_OWNER"), updateCategory);
categoryRouter.delete("/categories/:id", authenticate, allowRoles("ADMIN", "SHOP_OWNER"), deleteCategory);
categoryRouter.get("/shops/:id/categories", getShopPageCategories);
categoryRouter.get("/myshop/categories", authenticate, allowRoles("ADMIN", "SHOP_OWNER", "STAFF"), getMyCategories);
categoryRouter.post("/myshop/categories", authenticate, allowRoles("ADMIN", "SHOP_OWNER"), createMyCategory);
categoryRouter.put("/myshop/categories/:id", authenticate, allowRoles("ADMIN", "SHOP_OWNER"), updateMyCategory);

module.exports = categoryRouter;
