const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = require("./config/db");

function parseEJSON(obj) {
  if (Array.isArray(obj)) return obj.map(parseEJSON);
  if (obj !== null && typeof obj === "object") {
    if (obj.$oid) return new mongoose.Types.ObjectId(obj.$oid);
    if (obj.$date) return new Date(obj.$date);
    const parsed = {};
    for (const key of Object.keys(obj)) {
      parsed[key] = parseEJSON(obj[key]);
    }
    return parsed;
  }
  return obj;
}

const collections = [
  { file: "users.json", collection: "users" },
  { file: "shops.json", collection: "shops" },
  { file: "shop_staff.json", collection: "shop_staff" },
  { file: "categories.json", collection: "categories" },
  { file: "products.json", collection: "products" },
  { file: "carts.json", collection: "carts" },
  { file: "orders.json", collection: "orders" },
  { file: "stock_transactions.json", collection: "stock_transactions" },
  { file: "notifications.json", collection: "notifications" },
  { file: "shop_registration_requests.json", collection: "shop_registration_requests" },
];

async function seed() {
  await connectDB();
  const db = mongoose.connection.db;
  console.log("Đang nạp dữ liệu mẫu vào cơ sở dữ liệu...");

  const dataDir = path.join(__dirname, "seed_data");

  for (const { file, collection } of collections) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`[Bỏ qua] Không tìm thấy ${file}`);
      continue;
    }

    const rawData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const data = parseEJSON(rawData);

    await db.collection(collection).deleteMany({});
    if (data.length > 0) {
      await db.collection(collection).insertMany(data);
    }
    console.log(`[OK] Đã nạp ${data.length} bản ghi vào collection ${collection}`);
  }

  console.log("=== NẠP DỮ LIỆU SEED HOÀN TẤT THÀNH CÔNG! ===");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Lỗi khi nạp dữ liệu:", err);
  process.exit(1);
});
