const mongoose = require("mongoose");
const AppError = require("../errors/AppError.js");

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const assertObjectId = (id, field = "id") => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, `${field} không hợp lệ`);
  }
};

// ?page=&limit= -> { page, limit, skip }
const getPagination = (query, defaultLimit = 12, maxLimit = 50) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || defaultLimit, 1),
    maxLimit,
  );
  return { page, limit, skip: (page - 1) * limit };
};

module.exports = { escapeRegex, assertObjectId, getPagination };
