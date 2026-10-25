const success = (res, data, message = "Thành công", status = 200) => {
  res.status(status).json({ success: true, message, data });
};

// data kèm thông tin phân trang
const paginated = (res, items, { page, limit, total }, message = "Thành công") => {
  res.status(200).json({
    success: true,
    message,
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
};

module.exports = { success, paginated };
