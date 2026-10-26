const express = require("express");
const categoryController = require("./category.controller.js");
const { validateCreate, validateUpdate } = require("./category.validation.js");
const { auth } = require("../../common/middlewares/auth.js");
const { shopRole, SHOP_ROLES } = require("../../common/middlewares/role.js");

const categoryRouter = express.Router();
const ownerOnly = [auth, shopRole("SHOP_OWNER")];
const shopMembers = [auth, shopRole(...SHOP_ROLES)];

// UC21 - quản lý danh mục (ngưng / mở lại danh mục bằng PUT với status)
categoryRouter.get(
  "/myshop/categories",
  shopMembers,
  categoryController.getMyCategories,
);
categoryRouter.post(
  "/myshop/categories",
  ownerOnly,
  validateCreate,
  categoryController.createCategory,
);
categoryRouter.put(
  "/myshop/categories/:id",
  ownerOnly,
  validateUpdate,
  categoryController.updateCategory,
);

module.exports = categoryRouter;
