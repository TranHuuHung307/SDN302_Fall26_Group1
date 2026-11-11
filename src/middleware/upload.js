const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const uploadRoot = path.join(__dirname, "../../uploads");
const imageExtensions = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
const toPublicImageUrl = (file) => `/uploads/products/${file.filename}`;

function productImageUpload(req, res, next) {
  const targetDir = path.join(uploadRoot, "products");
  fs.mkdirSync(targetDir, { recursive: true });
  const upload = multer({
    storage: multer.diskStorage({
      destination: targetDir,
      filename: (request, file, callback) => callback(null, `${crypto.randomUUID()}${imageExtensions[file.mimetype] || ".img"}`),
    }),
    limits: { fileSize: 2 * 1024 * 1024, files: 10 },
    fileFilter: (request, file, callback) => {
      if (!imageExtensions[file.mimetype]) return callback(new Error("Only JPEG, PNG, WEBP, and GIF images are accepted."));
      callback(null, true);
    },
  }).array("images", 10);
  upload(req, res, next);
}

module.exports = { productImageUpload, uploadRoot, toPublicImageUrl };
