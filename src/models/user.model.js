const mongoose = require("mongoose");
const { Schema } = mongoose;
const userSchema = new Schema(
  {
    fullName: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    phone: { type: String },
    role: {
      type: String,
      enum: ["ADMIN", "SHOP_OWNER", "STAFF", "CUSTOMER"],
      default: "CUSTOMER",
    },
    accountStatus: {
      type: String,
      enum: ["ACTIVE", "BANNED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);
const User = mongoose.model("User", userSchema);
module.exports = User;
