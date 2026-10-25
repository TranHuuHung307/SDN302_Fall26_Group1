const productService = require("./product.service.js");
const asyncHandler = require("../../shared/utils/asyncHandler.js");
const { success, paginated } = require("../../shared/utils/response.js");
const { toPublicUrl } = require("../../shared/utils/upload.js");

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

// GET /api/shops/:shopId/page
const getShopPage = asyncHandler(async (req, res) => {
  const { shop, categories, items, pagination } =
    await productService.getShopPage(req.params.shopId, req.query);
  paginated(res, { shop, categories, products: items }, pagination);
});

/* ---------- Shop Owner ---------- */

// GET /api/products/manage
const getMyProducts = asyncHandler(async (req, res) => {
  const { items, pagination } = await productService.getMyProducts(
    req.shop._id,
    req.query,
  );
  paginated(res, items, pagination);
});

// GET /api/products/manage/:id
const getMyProductById = asyncHandler(async (req, res) => {
  const product = await productService.getMyProductById(
    req.shop._id,
    req.params.id,
  );
  success(res, product);
});

// POST /api/products
const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.shop._id, {
    ...req.body,
    images: [...req.body.images, ...uploadedImages(req)],
  });
  success(res, product, "Thêm sản phẩm thành công", 201);
});

// PUT /api/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(
    req.shop._id,
    req.params.id,
    req.body,
    uploadedImages(req),
  );
  success(res, product, "Cập nhật sản phẩm thành công");
});

// PATCH /api/products/:id/status
const updateProductStatus = asyncHandler(async (req, res) => {
  const product = await productService.updateProductStatus(
    req.shop._id,
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
  getShopPage,
  getMyProducts,
  getMyProductById,
  createProduct,
  updateProduct,
  updateProductStatus,
};
