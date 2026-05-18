const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware");
const { validateItemPayload } = require("../validators");
const { normalizeItem } = require("../utils");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { popular, search, category } = req.query;
    const conditions = [];
    const params = [];

    if (popular === "true") {
      conditions.push("popular = ?");
      params.push(1);
    }

    if (category) {
      conditions.push("LOWER(category) = LOWER(?)");
      params.push(String(category).trim());
    }

    if (search) {
      conditions.push("(LOWER(title) LIKE LOWER(?) OR LOWER(restaurant) LIKE LOWER(?) OR LOWER(category) LIKE LOWER(?))");
      const pattern = `%${String(search).trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await db.query(`SELECT * FROM items ${whereClause} ORDER BY id DESC`, params);

    res.json(rows.map(normalizeItem));
  } catch (error) {
    next(error);
  }
});

router.get("/liked/list", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.query(
      `SELECT items.* FROM items 
       JOIN likes ON items.id = likes.item_id 
       WHERE likes.user_id = ? ORDER BY likes.id DESC`,
      [userId]
    );
    res.json(rows.map(normalizeItem));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await db.query("SELECT * FROM items WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) {
      return res.status(404).json({ error: "Блюдо не найдено" });
    }
    res.json(normalizeItem(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/liked", requireAuth, async (req, res, next) => {
  try {
    const itemId = Number(req.params.id);
    const userId = req.user.id;

    const [rows] = await db.query(
      "SELECT 1 FROM likes WHERE user_id = ? AND item_id = ? LIMIT 1",
      [userId, itemId]
    );

    res.json({ liked: rows.length > 0 });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/like", requireAuth, async (req, res, next) => {
  try {
    const itemId = Number(req.params.id);
    const userId = req.user.id;

    const [rows] = await db.query(
      "SELECT id FROM likes WHERE user_id = ? AND item_id = ? LIMIT 1",
      [userId, itemId]
    );

    if (rows.length > 0) {
      await db.query("DELETE FROM likes WHERE user_id = ? AND item_id = ?", [userId, itemId]);
      res.json({ liked: false, message: "Удалено из понравившихся" });
    } else {
      await db.query("INSERT INTO likes (user_id, item_id) VALUES (?, ?)", [userId, itemId]);
      res.json({ liked: true, message: "Добавлено в понравившиеся" });
    }
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const validation = validateItemPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const item = validation.value;
    const [result] = await db.query(
      `INSERT INTO items (title, price, rating, reviews, image, category, restaurant, deliveryTime, popular, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.title,
        item.price,
        item.rating,
        item.reviews,
        item.image,
        item.category,
        item.restaurant,
        item.deliveryTime,
        item.popular,
        item.description,
      ]
    );

    const [rows] = await db.query("SELECT * FROM items WHERE id = ? LIMIT 1", [result.insertId]);
    res.status(211).json(normalizeItem(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const validation = validateItemPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const [existingRows] = await db.query("SELECT id FROM items WHERE id = ? LIMIT 1", [id]);
    if (!existingRows.length) {
      return res.status(404).json({ error: "Блюдо не найдено" });
    }

    const item = validation.value;
    await db.query(
      `UPDATE items SET
        title = ?,
        price = ?,
        rating = ?,
        reviews = ?,
        image = ?,
        category = ?,
        restaurant = ?,
        deliveryTime = ?,
        popular = ?,
        description = ?
      WHERE id = ?`,
      [
        item.title,
        item.price,
        item.rating,
        item.reviews,
        item.image,
        item.category,
        item.restaurant,
        item.deliveryTime,
        item.popular,
        item.description,
        id,
      ]
    );

    const [rows] = await db.query("SELECT * FROM items WHERE id = ? LIMIT 1", [id]);
    res.json(normalizeItem(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await db.query("SELECT * FROM items WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) {
      return res.status(404).json({ error: "Блюдо не найдено" });
    }

    await db.query("DELETE FROM likes WHERE item_id = ?", [id]);
    await db.query("DELETE FROM items WHERE id = ?", [id]);
    res.json({ message: `Блюдо "${rows[0].title}" успешно удалено.` });
  } catch (error) {
    next(error);
  }
});

module.exports = router;