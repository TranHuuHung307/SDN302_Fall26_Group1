const mongoose = require("mongoose");
const { Schema } = mongoose;
const shopStaffSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["INVENTORY_STAFF", "ORDER_STAFF"],
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "shop_staff",
  },
);
shopStaffSchema.index({ shopId: 1, userId: 1 }, { unique: true });
const ShopStaff = mongoose.model("ShopStaff", shopStaffSchema);
module.exports = ShopStaff;
