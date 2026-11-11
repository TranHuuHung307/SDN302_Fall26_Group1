const mongoose = require('mongoose');
const Category = require('../models/category');
const Shop = require('../models/shop');
const Product = require('../models/product');
const { canManageShop, resolveShopScope } = require('../utils/access');

const allowedStatuses = ['ACTIVE', 'INACTIVE'];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sendError(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function handleError(res, error) {
  if (error.code === 11000) return sendError(res, 409, 'Tên category đã tồn tại trong shop này.');
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return sendError(res, 400, error.message);
  }
  console.error('Category API error:', error);
  return sendError(res, 500, 'Lỗi máy chủ khi xử lý category.');
}

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      handleError(res, error);
    }
  };
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

const getCategories = asyncHandler(async (req, res) => {
  const { shopId, status, search } = req.query;
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);

  if (shopId && !validId(shopId)) return sendError(res, 400, 'shopId không hợp lệ.');
  if (status && !allowedStatuses.includes(status)) {
    return sendError(res, 400, `status phải là một trong: ${allowedStatuses.join(', ')}.`);
  }

  const filter = {};
  if (shopId) filter.shopId = shopId;
  if (status) filter.status = status;
  if (search) filter.categoryName = { $regex: escapeRegex(String(search).trim()), $options: 'i' };

  const [items, total] = await Promise.all([
    Category.find(filter).sort({ createdAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Category.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    data: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

const getCategoriesByShop = asyncHandler(async (req, res) => {
  const { shopId } = req.params;
  if (!validId(shopId)) return sendError(res, 400, 'shopId không hợp lệ.');

  const filter = { shopId };
  if (req.query.status) {
    if (!allowedStatuses.includes(req.query.status)) {
      return sendError(res, 400, `status phải là một trong: ${allowedStatuses.join(', ')}.`);
    }
    filter.status = req.query.status;
  }
  const categories = await Category.find(filter).sort({ categoryName: 1 }).lean();
  return res.json({ success: true, data: categories });
});

const getShopPageCategories = asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, 'shopId không hợp lệ.');
  const visibleShop = await Shop.exists({ _id: req.params.id, approvalStatus: 'APPROVED', operationStatus: 'OPEN' });
  if (!visibleShop) return sendError(res, 404, 'Không tìm thấy shop.');
  const categories = await Category.find({ shopId: req.params.id, status: 'ACTIVE' }).sort({ categoryName: 1 }).lean();
  return res.json({ success: true, data: categories });
});

const getMyCategories = asyncHandler(async (req, res) => {
  const { shopId, error } = await resolveShopScope(req.user, req.query.shopId, ['INVENTORY_STAFF', 'ORDER_STAFF']);
  if (error) return sendError(res, error.status, error.message);
  const filter = { shopId };
  if (req.query.status) {
    if (!allowedStatuses.includes(req.query.status)) return sendError(res, 400, 'status phải là ACTIVE hoặc INACTIVE.');
    filter.status = req.query.status;
  }
  if (req.query.keyword || req.query.search) filter.categoryName = { $regex: escapeRegex(String(req.query.keyword || req.query.search).trim()), $options: 'i' };
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const [items, total] = await Promise.all([Category.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Category.countDocuments(filter)]);
  return res.json({ success: true, data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
});

const createMyCategory = asyncHandler(async (req, res) => {
  const { shopId, error } = await resolveShopScope(req.user, req.body?.shopId || req.query.shopId, []);
  if (error) return sendError(res, error.status, error.message);
  req.body.shopId = shopId;
  return createCategory(req, res);
});

const updateMyCategory = asyncHandler(async (req, res) => {
  const { shopId, error } = await resolveShopScope(req.user, req.body?.shopId || req.query.shopId, []);
  if (error) return sendError(res, error.status, error.message);
  if (!validId(req.params.id)) return sendError(res, 400, 'category id không hợp lệ.');
  const category = await Category.findOne({ _id: req.params.id, shopId });
  if (!category) return sendError(res, 404, 'Không tìm thấy category.');
  req.params.id = String(category._id);
  return updateCategory(req, res);
});

const getCategoryById = asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, 'category id không hợp lệ.');
  const category = await Category.findById(req.params.id).lean();
  if (!category) return sendError(res, 404, 'Không tìm thấy category.');
  return res.json({ success: true, data: category });
});

const createCategory = asyncHandler(async (req, res) => {
  const { shopId, categoryName, description = '', status = 'ACTIVE' } = req.body || {};
  if (!shopId || !validId(shopId)) return sendError(res, 400, 'shopId là bắt buộc và phải hợp lệ.');
  if (typeof categoryName !== 'string' || !categoryName.trim()) {
    return sendError(res, 400, 'categoryName là bắt buộc.');
  }
  if (!allowedStatuses.includes(status)) {
    return sendError(res, 400, `status phải là một trong: ${allowedStatuses.join(', ')}.`);
  }

  const shop = await Shop.findById(shopId);
  if (!shop) return sendError(res, 404, 'Không tìm thấy shop.');
  if (!await canManageShop(req.user, shopId)) return sendError(res, 403, 'Không có quyền quản lý shop này.');

  const category = await Category.create({ shopId, categoryName: categoryName.trim(), description, status });
  return res.status(201).json({ success: true, message: 'Tạo category thành công.', data: category });
});

const updateCategory = asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, 'category id không hợp lệ.');
  const body = req.body || {};
  const updates = {};
  for (const field of ['categoryName', 'description', 'status']) {
    if (Object.hasOwn(body, field)) updates[field] = body[field];
  }
  if (Object.hasOwn(updates, 'categoryName')) {
    if (typeof updates.categoryName !== 'string' || !updates.categoryName.trim()) {
      return sendError(res, 400, 'categoryName không được để trống.');
    }
    updates.categoryName = updates.categoryName.trim();
  }
  if (Object.hasOwn(updates, 'status') && !allowedStatuses.includes(updates.status)) {
    return sendError(res, 400, `status phải là một trong: ${allowedStatuses.join(', ')}.`);
  }
  if (Object.keys(updates).length === 0) {
    return sendError(res, 400, 'Cần gửi ít nhất một trường được hỗ trợ để cập nhật.');
  }

  const existing = await Category.findById(req.params.id);
  if (!existing) return sendError(res, 404, 'Không tìm thấy category.');
  if (!await canManageShop(req.user, existing.shopId)) return sendError(res, 403, 'Không có quyền quản lý shop này.');
  const category = await Category.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!category) return sendError(res, 404, 'Không tìm thấy category.');
  return res.json({ success: true, message: 'Cập nhật category thành công.', data: category });
});

const deleteCategory = asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, 'category id không hợp lệ.');
  const category = await Category.findById(req.params.id);
  if (!category) return sendError(res, 404, 'Không tìm thấy category.');
  if (!await canManageShop(req.user, category.shopId)) return sendError(res, 403, 'Không có quyền quản lý shop này.');

  if (await Product.exists({ categoryId: category._id })) {
    return res.status(409).json({
      success: false,
      message: 'Category đang được sản phẩm sử dụng. Hãy chuyển hoặc xóa sản phẩm trước khi xóa category.',
    });
  }

  await category.deleteOne();
  return res.json({ success: true, message: 'Xóa category thành công.' });
});

module.exports = {
  getCategories,
  getCategoriesByShop,
  getShopPageCategories,
  getMyCategories,
  createMyCategory,
  updateMyCategory,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
