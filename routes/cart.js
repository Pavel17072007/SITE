const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware");
const { normalizeItem } = require("../utils");

const router = express.Router();

// Инициализация таблицы cart_items при первом использовании
async function ensureCartTableExists() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        item_id INT NOT NULL,
        quantity INT DEFAULT 1,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_item (user_id, item_id)
      )
    `);
  } catch (error) {
    console.error("Error creating cart_items table:", error);
  }
}

ensureCartTableExists();

// Получить корзину пользователя
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.query(
      `SELECT items.*, cart_items.quantity, cart_items.id as cart_item_id
       FROM cart_items
       JOIN items ON cart_items.item_id = items.id
       WHERE cart_items.user_id = ?
       ORDER BY cart_items.added_at DESC`,
      [userId]
    );

    const cartItems = rows.map(row => ({
      ...normalizeItem(row),
      quantity: row.quantity,
      cartItemId: row.cart_item_id
    }));

    res.json(cartItems);
  } catch (error) {
    next(error);
  }
});

// Добавить товар в корзину
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const itemId = Number(req.body.itemId);
    const quantity = Number(req.body.quantity) || 1;

    if (!itemId || itemId <= 0) {
      return res.status(400).json({ error: "Некорректный ID товара" });
    }

    // Проверить, что товар существует
    const [itemRows] = await db.query("SELECT * FROM items WHERE id = ? LIMIT 1", [itemId]);
    if (!itemRows.length) {
      return res.status(404).json({ error: "Товар не найден" });
    }

    // Добавить или обновить товар в корзине
    await db.query(
      `INSERT INTO cart_items (user_id, item_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
      [userId, itemId, quantity, quantity]
    );

    res.json({ message: "Товар добавлен в корзину" });
  } catch (error) {
    next(error);
  }
});

// Удалить товар из корзины
router.delete("/:itemId", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const itemId = Number(req.params.itemId);

    const [result] = await db.query(
      "DELETE FROM cart_items WHERE user_id = ? AND item_id = ?",
      [userId, itemId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Товар не найден в корзине" });
    }

    res.json({ message: "Товар удалён из корзины" });
  } catch (error) {
    next(error);
  }
});

// Обновить количество товара в корзине
router.patch("/:itemId", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const itemId = Number(req.params.itemId);
    const quantity = Number(req.body.quantity);

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: "Количество должно быть больше 0" });
    }

    const [result] = await db.query(
      "UPDATE cart_items SET quantity = ? WHERE user_id = ? AND item_id = ?",
      [quantity, userId, itemId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Товар не найден в корзине" });
    }

    res.json({ message: "Количество обновлено" });
  } catch (error) {
    next(error);
  }
});

// Очистить корзину
router.delete("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    await db.query("DELETE FROM cart_items WHERE user_id = ?", [userId]);
    res.json({ message: "Корзина очищена" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
