const mongoose = require("mongoose");
const { Schema } = mongoose;
const shopRegistrationRequestSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    shopName: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
  },
  {
    timestamps: true,
    collection: "shop_registration_requests",
  },
);
shopRegistrationRequestSchema.index({ status: 1 });
const ShopRegistrationRequest = mongoose.model(
  "ShopRegistrationRequest",
  shopRegistrationRequestSchema,
);
module.exports = ShopRegistrationRequest;
