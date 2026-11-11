const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");
const { uploadRoot } = require("./src/middleware/upload");
const connectDB = require("./config/db");
const router = require("./src/routes/index.js");
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadRoot));
app.get("/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  return res.status(connected ? 200 : 503).json({ success: connected, data: { database: connected ? "connected" : "disconnected" } });
});
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  next();
});

app.use("/api", router);
// Keep the original root-level routes working for existing Postman collections.
app.use("/", router);
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found." }));
app.use((error, req, res, next) => {
  console.error("API error:", error);
  if (res.headersSent) return next(error);
  if (error.code === 11000) return res.status(409).json({ success: false, message: "A record with these values already exists." });
  if (error.name === "ValidationError" || error.name === "CastError" || error.name === "StrictModeError") {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE" || error.message?.startsWith("Only JPEG")) {
    return res.status(400).json({ success: false, message: error.message });
  }
  return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Internal server error." });
});
const PORT = process.env.PORT || 9999;
connectDB().then(() => app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
}));

module.exports = app;
