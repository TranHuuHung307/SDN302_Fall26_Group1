const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { tokenSecret } = require("../middleware/auth");

const publicUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  accountStatus: user.accountStatus,
});

async function register(req, res, next) {
  try {
    const { fullName, email, password, phone } = req.body || {};
    if (typeof fullName !== "string" || !fullName.trim() || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, message: "fullName and email are required." });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ success: false, message: "password must contain at least 8 characters." });
    }
    tokenSecret();
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ success: false, message: "Email is already registered." });
    }
    const user = await User.create({
      fullName: fullName.trim(), email: normalizedEmail,
      password: await bcrypt.hash(password, 12), phone,
      // Public registration must never grant a privileged role.
      role: "CUSTOMER",
    });
    const token = jwt.sign({ sub: user._id.toString(), role: user.role }, tokenSecret(), { expiresIn: "12h" });
    return res.status(201).json({ success: true, data: { token, tokenType: "Bearer", expiresIn: 43200, user: publicUser(user) } });
  } catch (error) { return next(error); }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ success: false, message: "email and password are required." });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || user.accountStatus !== "ACTIVE" || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Email or password is incorrect." });
    }
    const token = jwt.sign({ sub: user._id.toString(), role: user.role }, tokenSecret(), { expiresIn: "12h" });
    return res.json({ success: true, data: { token, tokenType: "Bearer", expiresIn: 43200, user: publicUser(user) } });
  } catch (error) { return next(error); }
}

function me(req, res) {
  return res.json({ success: true, data: publicUser(req.user) });
}

async function updateMe(req, res, next) {
  try {
    const { fullName, phone, currentPassword, newPassword } = req.body || {};
    const updates = {};
    if (fullName !== undefined) {
      if (typeof fullName !== "string" || !fullName.trim()) return res.status(400).json({ success: false, message: "fullName cannot be empty." });
      updates.fullName = fullName.trim();
    }
    if (phone !== undefined) {
      if (typeof phone !== "string") return res.status(400).json({ success: false, message: "phone must be a string." });
      updates.phone = phone.trim();
    }
    if (newPassword !== undefined) {
      if (typeof currentPassword !== "string" || !(await bcrypt.compare(currentPassword, req.user.password))) return res.status(400).json({ success: false, message: "currentPassword is incorrect." });
      if (typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({ success: false, message: "newPassword must contain at least 8 characters." });
      updates.password = await bcrypt.hash(newPassword, 12);
    }
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: "No supported fields were provided." });
    const user = await require("../models/user").findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true }).select("-password");
    return res.json({ success: true, data: publicUser(user) });
  } catch (error) { return next(error); }
}

async function listUsers(req, res, next) {
  try {
    const { role, accountStatus, search } = req.query;
    if (role && !["ADMIN", "SHOP_OWNER", "STAFF", "CUSTOMER"].includes(role)) return res.status(400).json({ success: false, message: "Invalid role." });
    if (accountStatus && !["ACTIVE", "BANNED"].includes(accountStatus)) return res.status(400).json({ success: false, message: "Invalid accountStatus." });
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};
    if (role) filter.role = role;
    if (accountStatus) filter.accountStatus = accountStatus;
    if (search) {
      const term = String(search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ fullName: { $regex: term, $options: "i" } }, { email: { $regex: term, $options: "i" } }];
    }
    const [users, total] = await Promise.all([User.find(filter).select("-password").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), User.countDocuments(filter)]);
    return res.json({ success: true, data: users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
}

async function updateAccountStatus(req, res, next) {
  try {
    const mongoose = require("mongoose");
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid user id." });
    const { accountStatus } = req.body || {};
    if (!["ACTIVE", "BANNED"].includes(accountStatus)) return res.status(400).json({ success: false, message: "accountStatus must be ACTIVE or BANNED." });
    if (String(req.user._id).toLowerCase() === req.params.id.toLowerCase() && accountStatus === "BANNED") return res.status(400).json({ success: false, message: "You cannot ban your own account." });
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { accountStatus } }, { new: true, runValidators: true }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.json({ success: true, data: publicUser(user) });
  } catch (error) { return next(error); }
}

module.exports = { register, login, me, updateMe, listUsers, updateAccountStatus };
