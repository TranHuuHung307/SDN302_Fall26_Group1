const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const router = require("./routes.js");
const { UPLOAD_ROOT } = require("./common/utils/upload.js");
const { notFound, errorHandler } = require("./common/errors/errorHandler.js");

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOAD_ROOT));

app.use("/api", router);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
