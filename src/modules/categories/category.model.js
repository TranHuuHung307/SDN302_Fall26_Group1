const mongoose = require("mongoose");
const { Schema } = mongoose;
const categorySchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    categoryName: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);
categorySchema.index({ shopId: 1, categoryName: 1 }, { unique: true });
const Category = mongoose.model("Category", categorySchema);
module.exports = Category;
