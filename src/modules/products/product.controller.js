const productService = require("./product.service.js");
const asyncHandler = require("../../common/utils/asyncHandler.js");
const { success, paginated } = require("../../common/utils/response.js");
const { toPublicUrl } = require("../../common/middlewares/upload.js");

const uploadedImages = (req) =>
  (req.files || []).map((file) => toPublicUrl("products", file));

/* ---------- Guest / Customer ---------- */

// GET /api/products
const getProducts = asyncHandler(async (req, res) => {
  const { items, pagination } = await productService.getPublicProducts(req.query);
  paginated(res, items, pagination);
});

// GET /api/products/:id
const getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getPublicProductById(req.params.id);
  success(res, product);
});

/* ---------- Shop Owner / Staff ---------- */

// GET /api/myshop/products
const getMyProducts = asyncHandler(async (req, res) => {
  const { items, pagination } = await productService.getMyProducts(
    req.shopId,
    req.query,
  );
  paginated(res, items, pagination);
});

// GET /api/myshop/products/:id
const getMyProductById = asyncHandler(async (req, res) => {
  const product = await productService.getMyProductById(
    req.shopId,
    req.params.id,
  );
  success(res, product);
});

// POST /api/myshop/products
const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.shopId, {
    ...req.body,
    images: [...req.body.images, ...uploadedImages(req)],
  });
  success(res, product, "Thêm sản phẩm thành công", 201);
});

// PUT /api/myshop/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(
    req.shopId,
    req.params.id,
    req.body,
    uploadedImages(req),
  );
  success(res, product, "Cập nhật sản phẩm thành công");
});

// PATCH /api/myshop/products/:id/status
const updateProductStatus = asyncHandler(async (req, res) => {
  const product = await productService.updateProductStatus(
    req.shopId,
    req.params.id,
    req.body?.productStatus,
  );
  const message =
    product.productStatus === "HIDDEN" ? "Đã ẩn sản phẩm" : "Đã hiện sản phẩm";
  success(res, product, message);
});

module.exports = {
  getProducts,
  getProductById,
  getMyProducts,
  getMyProductById,
  createProduct,
  updateProduct,
  updateProductStatus,
};
