require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const db = require("./db");

const app = express();
const port = Number(process.env.PORT || 3000);
const sessions = new Map();
const resetCodes = new Map();

const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;

app.use(express.json());
app.use(express.static(__dirname));

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function hashResetCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((accumulator, chunk) => {
    const [rawKey, ...rest] = chunk.trim().split("=");
    if (!rawKey) {
      return accumulator;
    }
    accumulator[rawKey] = decodeURIComponent(rest.join("="));
    return accumulator;
  }, {});
}

function createSession(res, userId) {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, userId);
  res.setHeader(
    "Set-Cookie",
    `flashfood_sid=${sessionId}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`
  );
}

function clearSession(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  if (cookies.flashfood_sid) {
    sessions.delete(cookies.flashfood_sid);
  }
  res.setHeader("Set-Cookie", "flashfood_sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
}

function getSafeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    phone: user.phone,
    role: user.role,
  };
}

function getMailTransportConfig() {
  const host = process.env.SMTP_HOST;
  const portValue = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from || !Number.isFinite(portValue)) {
    return null;
  }

  return {
    host,
    port: portValue,
    user,
    pass,
    secure,
    from,
  };
}

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendPasswordResetEmail(email, resetCode) {
  const mailConfig = getMailTransportConfig();

  if (!mailConfig) {
    console.log(`[password-reset] SMTP is not configured. Reset code for ${email}: ${resetCode}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    auth: {
      user: mailConfig.user,
      pass: mailConfig.pass,
    },
  });

  await transporter.sendMail({
    from: mailConfig.from,
    to: email,
    subject: "FlashFood password reset",
    text: `Your password reset code: ${resetCode}. It is valid for 10 minutes.`,
    html: `<p>Your password reset code:</p><p><strong style="font-size:22px;letter-spacing:2px">${resetCode}</strong></p><p>It is valid for 10 minutes.</p>`,
  });
}

async function findUserById(id) {
  const [rows] = await db.query(
    "SELECT id, email, name, phone, role, createdAt FROM users WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

async function getCurrentUser(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionId = cookies.flashfood_sid;

  if (!sessionId || !sessions.has(sessionId)) {
    return null;
  }

  const userId = sessions.get(sessionId);
  const user = await findUserById(userId);

  if (!user) {
    sessions.delete(sessionId);
    return null;
  }

  return user;
}

async function requireAuth(req, res, next) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function validatePhone(phone) {
  if (!phone) {
    return "Phone number is required";
  }
  if (phone.startsWith("+")) {
    return "Provide phone number without +";
  }
  if (!/^\d+$/.test(phone)) {
    return "Phone number must contain only digits";
  }
  if (phone.length < 11) {
    return "Phone number is too short";
  }
  return null;
}

async function validateRegisterPayload(body) {
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const phone = String(body.phone || "").trim();

  if (!email || !email.includes("@")) {
    return "Valid email is required";
  }
  if (name.length < 2) {
    return "Name must be at least 2 characters";
  }
  if (password.length < 6) {
    return "Password must be at least 6 characters";
  }

  const phoneError = validatePhone(phone);
  if (phoneError) {
    return phoneError;
  }

  const [emailRows] = await db.query("SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1", [
    email,
  ]);
  if (emailRows.length) {
    return "User with this email already exists";
  }

  const [phoneRows] = await db.query("SELECT id FROM users WHERE phone = ? LIMIT 1", [phone]);
  if (phoneRows.length) {
    return "This phone number is already registered";
  }

  return null;
}

function validateItemPayload(body) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const image = String(body.image || "").trim();
  const category = String(body.category || "").trim() || "Other";
  const restaurant = String(body.restaurant || "").trim() || "FlashFood";
  const deliveryTime = String(body.deliveryTime || "").trim() || "20-30 min";
  const price = Number(body.price);
  const rating = body.rating === undefined ? 4.7 : Number(body.rating);
  const reviews = body.reviews === undefined ? 0 : Number(body.reviews);
  const popular =
    body.popular === true ||
    body.popular === "true" ||
    body.popular === 1 ||
    body.popular === "1";

  if (title.length < 2) {
    return { error: "Title must be at least 2 characters" };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { error: "Price must be a positive number" };
  }
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    return { error: "Rating must be between 0 and 5" };
  }
  if (!Number.isFinite(reviews) || reviews < 0) {
    return { error: "Reviews must be a non-negative number" };
  }
  if (description.length < 10) {
    return { error: "Description must be at least 10 characters" };
  }

  return {
    value: {
      title,
      description,
      image:
        image ||
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80",
      category,
      restaurant,
      deliveryTime,
      price: Number(price.toFixed(2)),
      rating: Number(rating.toFixed(1)),
      reviews: Math.round(reviews),
      popular: popular ? 1 : 0,
    },
  };
}

function normalizeItem(item) {
  return {
    ...item,
    price: Number(item.price),
    rating: Number(item.rating),
    reviews: Number(item.reviews),
    popular: Boolean(item.popular),
  };
}

app.post("/api/auth/register", async (req, res, next) => {
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
      message: "Registration successful",
      user,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const [rows] = await db.query("SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1", [email]);
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = hashPassword(password) === user.passwordHash;
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Wrong password" });
    }

    createSession(res, user.id);
    res.json({
      message: "Login successful",
      user: getSafeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/forgot-password", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
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
      message: "If the email exists, a reset code has been sent",
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/reset-password", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "").trim();
    const newPassword = String(req.body.password || "");

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (!code) {
      return res.status(400).json({ error: "Reset code is required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const payload = resetCodes.get(email);

    if (!payload || payload.expiresAt < Date.now()) {
      resetCodes.delete(email);
      return res.status(400).json({ error: "Code is invalid or expired" });
    }

    const inputCodeHash = hashResetCode(code);
    if (inputCodeHash !== payload.codeHash) {
      payload.attempts += 1;
      if (payload.attempts >= RESET_CODE_MAX_ATTEMPTS) {
        resetCodes.delete(email);
      } else {
        resetCodes.set(email, payload);
      }
      return res.status(400).json({ error: "Code is invalid or expired" });
    }

    const [existingRows] = await db.query("SELECT id FROM users WHERE id = ? LIMIT 1", [payload.userId]);
    if (!existingRows.length) {
      resetCodes.delete(email);
      return res.status(400).json({ error: "Code is invalid or expired" });
    }

    const passwordHash = hashPassword(newPassword);
    await db.query("UPDATE users SET passwordHash = ? WHERE id = ?", [passwordHash, payload.userId]);
    resetCodes.delete(email);

    for (const [sessionId, userId] of sessions.entries()) {
      if (userId === payload.userId) {
        sessions.delete(sessionId);
      }
    }

    res.json({ message: "Password has been reset" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json(getSafeUser(user));
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (req, res) => {
  clearSession(req, res);
  res.json({ message: "Logged out" });
});

app.get("/api/items", async (req, res, next) => {
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

app.get("/api/items/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await db.query("SELECT * FROM items WHERE id = ? LIMIT 1", [id]);
    const item = rows[0];

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(normalizeItem(item));
  } catch (error) {
    next(error);
  }
});

app.post("/api/items", requireAuth, async (req, res, next) => {
  try {
    const validation = validateItemPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const item = validation.value;
    const [result] = await db.query(
      `INSERT INTO items
      (title, price, rating, reviews, image, category, restaurant, deliveryTime, popular, description)
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
    res.status(201).json(normalizeItem(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.put("/api/items/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const validation = validateItemPayload(req.body);

    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const [existingRows] = await db.query("SELECT id FROM items WHERE id = ? LIMIT 1", [id]);
    if (!existingRows.length) {
      return res.status(404).json({ error: "Item not found" });
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

app.delete("/api/items/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await db.query("SELECT * FROM items WHERE id = ? LIMIT 1", [id]);
    const item = rows[0];

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    await db.query("DELETE FROM items WHERE id = ?", [id]);
    res.json({ message: "Item deleted", item: normalizeItem(item) });
  } catch (error) {
    next(error);
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [email, payload] of resetCodes.entries()) {
    if (!payload || payload.expiresAt < now) {
      resetCodes.delete(email);
    }
  }
}, 60 * 1000);

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  if (error && error.code === "ER_BAD_DB_ERROR") {
    return res.status(500).json({ error: "Database flashfood_user was not found" });
  }

  if (error && error.code === "ECONNREFUSED") {
    return res.status(500).json({ error: "Cannot connect to MySQL on localhost" });
  }

  res.status(500).json({ error: "Internal server error" });
});

app.use((req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});

app.listen(port, async () => {
  try {
    await db.query("SELECT 1");
    console.log(`Server started: http://localhost:${port}`);
    console.log("MySQL connected: localhost / flashfood_user");
  } catch (error) {
    console.error("MySQL connection error:", error.message);
    console.log(`Server started: http://localhost:${port}`);
  }
});
