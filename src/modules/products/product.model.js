const mongoose = require("mongoose");
const { Schema } = mongoose;
const productSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    productName: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    stockQuantity: { type: Number, default: 0, min: 0 },
    images: [{ type: String }],
    expiryDate: { type: Date },
    productStatus: {
      type: String,
      enum: ["AVAILABLE", "HIDDEN"],
      default: "AVAILABLE",
    },
  },
  { timestamps: true },
);
productSchema.index({ shopId: 1, categoryId: 1 });
productSchema.index({ productName: "text" });
const Product = mongoose.model("Product", productSchema);
module.exports = Product;
