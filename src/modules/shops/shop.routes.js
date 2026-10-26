const express = require("express");
const shopController = require("./shop.controller.js");

const shopRouter = express.Router();

// Guest / Customer - UC28
shopRouter.get("/shops/:id", shopController.getShopPage);
shopRouter.get("/shops/:id/categories", shopController.getShopCategories);

module.exports = shopRouter;
