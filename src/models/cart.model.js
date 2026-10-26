const mongoose = require("mongoose");
const { Schema } = mongoose;
const cartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);
const cartSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;
