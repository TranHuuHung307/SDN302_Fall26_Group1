const express = require("express");
const categoryController = require("./category.controller.js");
const {
  validateCreate,
  validateUpdate,
  validateStatus,
} = require("./category.validation.js");
const { verifyToken } = require("../../shared/middlewares/auth.js");
const {
  authorize,
  loadOwnerShop,
} = require("../../shared/middlewares/authorize.js");

const categoryRouter = express.Router();
const ownerOnly = [verifyToken, authorize("SHOP_OWNER"), loadOwnerShop];

// Public
categoryRouter.get("/categories", categoryController.getPublicCategories);

// Shop Owner - UC21
categoryRouter.get(
  "/categories/manage",
  ownerOnly,
  categoryController.getMyCategories,
);
categoryRouter.post(
  "/categories",
  ownerOnly,
  validateCreate,
  categoryController.createCategory,
);
categoryRouter.put(
  "/categories/:id",
  ownerOnly,
  validateUpdate,
  categoryController.updateCategory,
);
categoryRouter.patch(
  "/categories/:id/status",
  ownerOnly,
  validateStatus,
  categoryController.updateCategoryStatus,
);

module.exports = categoryRouter;
