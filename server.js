require("dotenv").config();
const connectDB = require("./src/config/db.js");
const app = require("./src/app.js");

const PORT = process.env.PORT || 9999;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
  });
});
