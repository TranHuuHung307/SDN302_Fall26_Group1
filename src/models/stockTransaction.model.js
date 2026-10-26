const mongoose = require("mongoose");
const { Schema } = mongoose;
const stockTransactionSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    type: {
      type: String,
      enum: ["IMPORT", "EXPORT"],
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    note: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "stock_transactions",
  },
);
stockTransactionSchema.index({ productId: 1, createdAt: -1 });
const StockTransaction = mongoose.model(
  "StockTransaction",
  stockTransactionSchema,
);
module.exports = StockTransaction;
