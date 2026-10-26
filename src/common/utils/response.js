const success = (res, data, message = "Thành công", status = 200) => {
  res.status(status).json({ success: true, message, data });
};

// có phân trang: data = { items, total, page, limit } (theo sheet API)
const paginated = (res, items, { page, limit, total }, message = "Thành công") => {
  success(res, { items, total, page, limit }, message);
};

module.exports = { success, paginated };
