const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/user");

function tokenSecret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return process.env.JWT_SECRET;
}

async function authenticate(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ success: false, message: "Bearer token is required." });
    }
    const payload = jwt.verify(token, tokenSecret());
    if (!mongoose.isValidObjectId(payload.sub)) {
      return res.status(401).json({ success: false, message: "Invalid token." });
    }
    const user = await User.findById(payload.sub);
    if (!user || user.accountStatus !== "ACTIVE") {
      return res.status(401).json({ success: false, message: "Account is unavailable." });
    }
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }
    if (error.message === "JWT_SECRET is not configured") {
      return res.status(500).json({ success: false, message: error.message });
    }
    next(error);
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You do not have permission to perform this action." });
    }
    next();
  };
}

module.exports = { authenticate, allowRoles, tokenSecret };
