const mongoose = require("mongoose");
const { Schema } = mongoose;
const notificationSchema = new Schema(
  {
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String },
    type: {
      type: String,
      enum: ["ORDER", "INVENTORY", "SHOP_REGISTRATION"],
    },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
notificationSchema.index({ receiverId: 1, isRead: 1, createdAt: -1 });
const Notification = mongoose.model("Notification", notificationSchema);
module.exports = Notification;
