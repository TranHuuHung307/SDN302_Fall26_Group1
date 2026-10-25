const Order = require("../order/order.model.js");
const AppError = require("../../common/errors/AppError.js");

const TIMEZONE = "Asia/Ho_Chi_Minh";
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const GROUP_FORMATS = { day: "%Y-%m-%d", month: "%Y-%m" };

// from / to dạng YYYY-MM-DD theo giờ Việt Nam, tính trọn ngày "to"
const buildDateRange = (from, to) => {
  const range = {};
  if (from) {
    if (!DATE_REGEX.test(from)) throw new AppError(400, "from phải có dạng YYYY-MM-DD");
    range.$gte = new Date(`${from}T00:00:00.000+07:00`);
  }
  if (to) {
    if (!DATE_REGEX.test(to)) throw new AppError(400, "to phải có dạng YYYY-MM-DD");
    range.$lte = new Date(`${to}T23:59:59.999+07:00`);
  }
  if (Object.values(range).some((d) => Number.isNaN(d.getTime()))) {
    throw new AppError(400, "Ngày không hợp lệ");
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) {
    throw new AppError(400, "from không được sau to");
  }
  return Object.keys(range).length ? range : null;
};

// chỉ tính đơn đã giao và đã thanh toán (thống nhất với UC20)
const buildMatch = (shopId, { from, to }) => {
  const match = { shopId, orderStatus: "DELIVERED", paymentStatus: "PAID" };
  const range = buildDateRange(from, to);
  if (range) match.createdAt = range;
  return match;
};

// UC29 - doanh thu theo ngày / tháng
// ?groupBy=day|month&from=YYYY-MM-DD&to=YYYY-MM-DD
const getRevenue = async (shopId, query) => {
  const groupBy = query.groupBy || "day";
  if (!GROUP_FORMATS[groupBy]) {
    throw new AppError(400, "groupBy phải là day hoặc month");
  }

  const rows = await Order.aggregate([
    { $match: buildMatch(shopId, query) },
    {
      $group: {
        _id: {
          $dateToString: {
            format: GROUP_FORMATS[groupBy],
            date: "$createdAt",
            timezone: TIMEZONE,
          },
        },
        revenue: { $sum: "$totalAmount" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, period: "$_id", revenue: 1, orderCount: 1 } },
  ]);

  return {
    groupBy,
    from: query.from || null,
    to: query.to || null,
    totalRevenue: rows.reduce((sum, r) => sum + r.revenue, 0),
    totalOrders: rows.reduce((sum, r) => sum + r.orderCount, 0),
    rows,
  };
};

// UC29 - top sản phẩm bán chạy
// ?limit=5&from=YYYY-MM-DD&to=YYYY-MM-DD
const getTopProducts = async (shopId, query) => {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 5, 1), 50);

  return Order.aggregate([
    { $match: buildMatch(shopId, query) },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        productName: { $last: "$items.productName" },
        quantitySold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.subtotal" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { quantitySold: -1, revenue: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $project: {
        _id: 0,
        productId: "$_id",
        // ưu tiên tên hiện tại, sản phẩm đã xóa thì lấy tên lưu trong đơn
        productName: {
          $ifNull: [{ $first: "$product.productName" }, "$productName"],
        },
        image: { $first: { $first: "$product.images" } },
        price: { $first: "$product.price" },
        quantitySold: 1,
        revenue: 1,
        orderCount: 1,
      },
    },
  ]);
};

module.exports = { getRevenue, getTopProducts };
