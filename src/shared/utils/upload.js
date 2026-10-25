const fs = require("fs");
const path = require("path");
const multer = require("multer");
const AppError = require("../errors/AppError.js");

const UPLOAD_ROOT = path.join(__dirname, "../../../uploads");

// upload ảnh vào uploads/<folder>, file được serve tại /uploads/<folder>/<tên file>
const createImageUpload = (folder) => {
  const dir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith("image/")) {
        return cb(new AppError(400, "Chỉ cho phép upload file ảnh"));
      }
      cb(null, true);
    },
  });
};

const toPublicUrl = (folder, file) => `/uploads/${folder}/${file.filename}`;

module.exports = { UPLOAD_ROOT, createImageUpload, toPublicUrl };
