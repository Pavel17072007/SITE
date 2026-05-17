const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { 
  createSession, 
  clearSession, 
  findUserById, 
  getCurrentUser, 
  sendPasswordResetEmail,
  getResetCodes,
  getSessions
} = require("../auth");
const { requireAuth } = require("../middleware");
const { RESET_CODE_TTL_MS, RESET_CODE_MAX_ATTEMPTS } = require("../config");
const { 
  hashPassword, 
  hashResetCode, 
  generateResetCode,
  getSafeUser 
} = require("../utils");
const { 
  validateRegisterPayload, 
  validatePasswordComplexity, 
  validatePhone 
} = require("../validators");

const router = express.Router();
const resetCodes = getResetCodes();

router.post("/register", async (req, res, next) => {
  try {
    const error = await validateRegisterPayload(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    const email = String(req.body.email).trim().toLowerCase();
    const name = String(req.body.name).trim();
    const phone = String(req.body.phone).trim();
    const passwordHash = hashPassword(String(req.body.password));
    const role = "user";

    const [result] = await db.query(
      "INSERT INTO users (email, passwordHash, name, createdAt, phone, role) VALUES (?, ?, ?, NOW(), ?, ?)",
      [email, passwordHash, name, phone, role]
    );

    const user = {
      id: result.insertId,
      email,
      name,
      createdAt: new Date().toISOString(),
      phone,
      role,
    };

    createSession(res, user.id);
    res.status(201).json({
      message: "Регистрация успешна",
      user,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const [rows] = await db.query("SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1", [email]);
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    const isPasswordValid = hashPassword(password) === user.passwordHash;
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Неверный пароль" });
    }

    createSession(res, user.id);
    res.json({
      message: "Вход выполнен",
      user: getSafeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Укажите корректный email" });
    }

    const [rows] = await db.query("SELECT id, email FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1", [
      email,
    ]);
    const user = rows[0];

    if (user) {
      const rawCode = generateResetCode();
      const codeHash = hashResetCode(rawCode);
      const expiresAt = Date.now() + RESET_CODE_TTL_MS;
      resetCodes.set(user.email, {
        userId: user.id,
        codeHash,
        expiresAt,
        attempts: 0,
      });

      await sendPasswordResetEmail(user.email, rawCode);
    }

    res.json({
      message: "Если такой email существует, код восстановления отправлен",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "").trim();
    const newPassword = String(req.body.password || "");

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Укажите корректный email" });
    }
    if (!code) {
      return res.status(400).json({ error: "Требуется код восстановления" });
    }
    const passwordError = validatePasswordComplexity(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const payload = resetCodes.get(email);

    if (!payload || payload.expiresAt < Date.now()) {
      resetCodes.delete(email);
      return res.status(400).json({ error: "Код неверный или срок действия истек" });
    }

    const inputCodeHash = hashResetCode(code);
    if (inputCodeHash !== payload.codeHash) {
      payload.attempts += 1;
      if (payload.attempts >= RESET_CODE_MAX_ATTEMPTS) {
        resetCodes.delete(email);
      } else {
        resetCodes.set(email, payload);
      }
      return res.status(400).json({ error: "Код неверный или срок действия истек" });
    }

    const [existingRows] = await db.query("SELECT id FROM users WHERE id = ? LIMIT 1", [payload.userId]);
    if (!existingRows.length) {
      resetCodes.delete(email);
      return res.status(400).json({ error: "Код неверный или срок действия истек" });
    }

    const passwordHash = hashPassword(newPassword);
    await db.query("UPDATE users SET passwordHash = ? WHERE id = ?", [passwordHash, payload.userId]);
    resetCodes.delete(email);

    const sessions = getSessions();
    for (const [sessionId, userId] of sessions.entries()) {
      if (userId === payload.userId) {
        sessions.delete(sessionId);
      }
    }

    res.json({ message: "Пароль был сброшен" });
  } catch (error) {
    next(error);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "Пользователь не авторизован" });
    }
    res.json(getSafeUser(user));
  } catch (error) {
    next(error);
  }
});

router.put("/profile", requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const phone = String(req.body.phone || "").trim();

    if (name.length < 2) {
      return res.status(400).json({ error: "Имя должно содержать минимум 2 символа" });
    }

    const phoneError = validatePhone(phone);
    if (phoneError) {
      return res.status(400).json({ error: phoneError });
    }

    const [phoneRows] = await db.query("SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1", [
      phone,
      req.user.id,
    ]);
    if (phoneRows.length) {
      return res.status(400).json({ error: "Этот номер телефона уже зарегистрирован" });
    }

    await db.query("UPDATE users SET name = ?, phone = ? WHERE id = ?", [name, phone, req.user.id]);
    const updatedUser = await findUserById(req.user.id);
    if (!updatedUser) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    res.json({
      message: "Профиль обновлен",
      user: getSafeUser(updatedUser),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res) => {
  clearSession(req, res);
  res.json({ message: "Вы вышли из системы" });
});

module.exports = router;
