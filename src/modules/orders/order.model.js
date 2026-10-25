const mongoose = require("mongoose");
const { Schema } = mongoose;
const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
const orderSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    items: [orderItemSchema],
    shippingAddress: { type: String, required: true },
    phone: { type: String },
    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE"],
      default: "COD",
    },
    totalAmount: { type: Number, required: true, min: 0 },
    orderStatus: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "PREPARING",
        "SHIPPING",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "PENDING",
    },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PAID", "REFUNDED"],
      default: "UNPAID",
    },
  },
  { timestamps: true },
);
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ shopId: 1, orderStatus: 1 });
const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
