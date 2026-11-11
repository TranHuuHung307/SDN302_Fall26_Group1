const Notification = require("../models/notification");
const { validId } = require("../utils/access");

async function listNotifications(req, res, next) {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = { receiverId: req.user._id };
    if (req.query.isRead !== undefined) {
      if (!["true", "false"].includes(req.query.isRead)) return res.status(400).json({ success: false, message: "isRead must be true or false." });
      filter.isRead = req.query.isRead === "true";
    }
    const [data, total, unread] = await Promise.all([Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Notification.countDocuments(filter), Notification.countDocuments({ receiverId: req.user._id, isRead: false })]);
    return res.json({ success: true, data, unread, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
}

async function markRead(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid notification id." });
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, receiverId: req.user._id }, { $set: { isRead: true } }, { new: true });
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found." });
    return res.json({ success: true, data: notification });
  } catch (error) { return next(error); }
}

async function markAllRead(req, res, next) {
  try {
    const result = await Notification.updateMany({ receiverId: req.user._id, isRead: false }, { $set: { isRead: true } });
    return res.json({ success: true, data: { markedRead: result.modifiedCount } });
  } catch (error) { return next(error); }
}

module.exports = { listNotifications, markRead, markAllRead };
