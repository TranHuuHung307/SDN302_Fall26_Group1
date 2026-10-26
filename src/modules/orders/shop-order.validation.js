const mongoose = require("mongoose");
const AppError = require("../../common/errors/AppError.js");

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "SHIPPING",
  "DELIVERED",
  "CANCELLED",
];

const PAYMENT_STATUSES = ["UNPAID", "PAID", "REFUNDED"];

const ALLOWED_DELIVERY_STATUSES = ["PREPARING", "SHIPPING", "DELIVERED"];

const validateOrderId = (req, res, next) => {
  const { id } = req.params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return next(new AppError(400, "Mã đơn hàng (id) không hợp lệ"));
  }
  next();
};

const validateListOrdersQuery = (req, res, next) => {
  const { orderStatus, paymentStatus } = req.query;

  if (orderStatus && !ORDER_STATUSES.includes(orderStatus.toUpperCase())) {
    return next(
      new AppError(
        400,
        `orderStatus không hợp lệ. Các giá trị cho phép: ${ORDER_STATUSES.join(", ")}`,
      ),
    );
  }

  if (paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus.toUpperCase())) {
    return next(
      new AppError(
        400,
        `paymentStatus không hợp lệ. Các giá trị cho phép: ${PAYMENT_STATUSES.join(", ")}`,
      ),
    );
  }

  next();
};

const validateUpdateStatus = (req, res, next) => {
  const { orderStatus } = req.body;

  if (
    typeof orderStatus !== "string" ||
    !ALLOWED_DELIVERY_STATUSES.includes(orderStatus.toUpperCase())
  ) {
    return next(
      new AppError(
        400,
        `orderStatus phải là một trong: ${ALLOWED_DELIVERY_STATUSES.join(", ")}`,
      ),
    );
  }

  req.body.orderStatus = orderStatus.toUpperCase();
  next();
};

const validateCancelOrder = (req, res, next) => {
  const { reason } = req.body;
  req.body = {
    reason: typeof reason === "string" ? reason.trim() : "",
  };
  next();
};

module.exports = {
  validateOrderId,
  validateListOrdersQuery,
  validateUpdateStatus,
  validateCancelOrder,
};
