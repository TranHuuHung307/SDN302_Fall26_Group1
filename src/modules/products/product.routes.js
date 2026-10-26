const express = require("express");
const productController = require("./product.controller.js");

const productRouter = express.Router();

// Guest / Customer
productRouter.get("/products", productController.getProducts); // UC25, UC26
productRouter.get("/products/:id", productController.getProductById); // UC27

module.exports = productRouter;
