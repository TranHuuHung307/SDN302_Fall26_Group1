const mongoose = require("mongoose");
const { Schema } = mongoose;
const shopSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    shopName: { type: String, required: true },
    address: { type: String },
    logoUrl: { type: String },
    phone: { type: String },
    bannerUrl: { type: String },
    // SUSPENDED = shop bị Admin khóa (UC19)
    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
      default: "PENDING",
    },
    operationStatus: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
    },
  },
  { timestamps: true },
);
shopSchema.index({ ownerId: 1 });
const Shop = mongoose.model("Shop", shopSchema);
module.exports = Shop;
