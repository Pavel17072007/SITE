const express = require("express");
const db = require("./db");
const { PORT, RESET_CODE_CLEANUP_INTERVAL_MS } = require("./config");
const { getResetCodes } = require("./auth");
const { errorHandler } = require("./middleware");
const authRoutes = require("./routes/auth");
const itemsRoutes = require("./routes/items");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.use("/api/auth", authRoutes);
app.use("/api/items", itemsRoutes);

setInterval(() => {
  const now = Date.now();
  const resetCodes = getResetCodes();
  for (const [email, payload] of resetCodes.entries()) {
    if (!payload || payload.expiresAt < now) {
      resetCodes.delete(email);
    }
  }
}, RESET_CODE_CLEANUP_INTERVAL_MS);

app.get("/cart", (req, res) => {
  res.sendFile(`${__dirname}/cart.html`);
});

app.use(errorHandler);

app.use((req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});

app.listen(PORT, async () => {
  try {
    await db.query("SELECT 1");
    console.log(`Server started: http://localhost:${PORT}`);
    console.log("MySQL connected: localhost / flashfood_user");
  } catch (error) {
    console.error("MySQL connection error:", error.message);
    console.log(`Server started: http://localhost:${PORT}`);
  }
});
