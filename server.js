const express = require("express");
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

let nextUserId = 3;
let nextItemId = 7;
const sessions = new Map();

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

const users = [
  {
    id: 1,
    login: "admin",
    passwordHash: hashPassword("admin123"),
    phone: "375291112233",
    role: "admin",
  },
  {
    id: 2,
    login: "foodlover",
    passwordHash: hashPassword("food1234"),
    phone: "375447778899",
    role: "user",
  },
];

const items = [
  {
    id: 1,
    title: "Поке с лососем",
    price: 24.9,
    rating: 4.9,
    reviews: 182,
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80",
    category: "Поке",
    restaurant: "FlashFood Kitchen",
    deliveryTime: "25-35 мин",
    popular: true,
    description: "Свежий лосось, рис, авокадо, эдамаме и фирменный цитрусовый соус.",
  },
  {
    id: 2,
    title: "Бургер Black Beef",
    price: 19.5,
    rating: 4.8,
    reviews: 241,
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
    category: "Бургеры",
    restaurant: "Street Grill",
    deliveryTime: "20-30 мин",
    popular: true,
    description: "Сочная говяжья котлета, чеддер, соус барбекю и хрустящий лук.",
  },
  {
    id: 3,
    title: "Суши-сет Tokyo",
    price: 31,
    rating: 4.9,
    reviews: 128,
    image:
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80",
    category: "Суши",
    restaurant: "Tokyo House",
    deliveryTime: "35-45 мин",
    popular: true,
    description: "Роллы с лососем, тунцом, креветкой и фирменными соусами.",
  },
  {
    id: 4,
    title: "Паста Alfredo",
    price: 21.4,
    rating: 4.7,
    reviews: 94,
    image:
      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80",
    category: "Паста",
    restaurant: "Pasta Fresca",
    deliveryTime: "30-40 мин",
    popular: false,
    description: "Тальятелле в сливочном соусе с курицей и пармезаном.",
  },
  {
    id: 5,
    title: "Пицца Маргарита",
    price: 18.8,
    rating: 4.6,
    reviews: 116,
    image:
      "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=900&q=80",
    category: "Пицца",
    restaurant: "Ciao Bella",
    deliveryTime: "25-35 мин",
    popular: true,
    description: "Томатный соус, моцарелла и свежий базилик на тонком тесте.",
  },
  {
    id: 6,
    title: "Боул Green Detox",
    price: 17.2,
    rating: 4.8,
    reviews: 76,
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
    category: "Салаты",
    restaurant: "Green Point",
    deliveryTime: "15-25 мин",
    popular: false,
    description: "Киноа, брокколи, огурец, шпинат, авокадо и кунжутный соус.",
  },
];

function getSafeUser(user) {
  return {
    id: user.id,
    login: user.login,
    phone: user.phone,
    role: user.role,
  };
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

function getCurrentUser(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionId = cookies.flashfood_sid;
  if (!sessionId || !sessions.has(sessionId)) {
    return null;
  }
  return users.find((user) => user.id === sessions.get(sessionId)) || null;
}

function requireAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }
  req.user = user;
  next();
}

function validatePhone(phone) {
  if (!phone) {
    return "Укажите номер телефона";
  }
  if (phone.startsWith("+")) {
    return "Укажите номер телефона без +";
  }
  if (!/^\d+$/.test(phone)) {
    return "Номер телефона должен содержать только цифры";
  }
  if (phone.length < 11) {
    return "Номер телефона слишком короткий";
  }
  return null;
}

function validateRegisterPayload(body) {
  const login = String(body.login || "").trim();
  const password = String(body.password || "");
  const phone = String(body.phone || "").trim();

  if (login.length < 3) {
    return "Логин должен содержать минимум 3 символа";
  }
  if (password.length < 6) {
    return "Пароль должен содержать минимум 6 символов";
  }

  const phoneError = validatePhone(phone);
  if (phoneError) {
    return phoneError;
  }
  if (users.some((user) => user.login.toLowerCase() === login.toLowerCase())) {
    return "Такой логин уже существует";
  }
  if (users.some((user) => user.phone === phone)) {
    return "Этот номер телефона уже зарегистрирован";
  }
  return null;
}

function validateItemPayload(body) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const image = String(body.image || "").trim();
  const category = String(body.category || "").trim() || "Разное";
  const restaurant = String(body.restaurant || "").trim() || "FlashFood";
  const deliveryTime = String(body.deliveryTime || "").trim() || "20-30 мин";
  const price = Number(body.price);
  const rating = body.rating === undefined ? 4.7 : Number(body.rating);
  const reviews = body.reviews === undefined ? 0 : Number(body.reviews);
  const popular = Boolean(body.popular);

  if (title.length < 2) {
    return { error: "Название блюда должно содержать минимум 2 символа" };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { error: "Цена должна быть положительным числом" };
  }
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    return { error: "Рейтинг должен быть числом от 0 до 5" };
  }
  if (!Number.isFinite(reviews) || reviews < 0) {
    return { error: "Количество отзывов должно быть неотрицательным числом" };
  }
  if (description.length < 10) {
    return { error: "Описание должно содержать минимум 10 символов" };
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
      popular,
    },
  };
}

app.post("/api/auth/register", async (req, res) => {
  const error = validateRegisterPayload(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const login = String(req.body.login).trim();
  const phone = String(req.body.phone).trim();
  const passwordHash = hashPassword(String(req.body.password));

  const user = {
    id: nextUserId++,
    login,
    phone,
    passwordHash,
    role: "user",
  };

  users.push(user);
  createSession(res, user.id);

  res.status(201).json({
    message: "Регистрация прошла успешно",
    user: getSafeUser(user),
  });
});

app.post("/api/auth/login", async (req, res) => {
  const login = String(req.body.login || "").trim();
  const password = String(req.body.password || "");
  const user = users.find((item) => item.login.toLowerCase() === login.toLowerCase());

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
});

app.get("/api/auth/me", (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "Пользователь не авторизован" });
  }
  res.json(getSafeUser(user));
});

app.post("/api/auth/logout", (req, res) => {
  clearSession(req, res);
  res.json({ message: "Вы вышли из системы" });
});

app.get("/api/items", (req, res) => {
  const { popular, search, category } = req.query;
  let result = [...items];

  if (popular === "true") {
    result = result.filter((item) => item.popular);
  }
  if (category) {
    const categoryQuery = String(category).trim().toLowerCase();
    result = result.filter((item) => item.category.toLowerCase() === categoryQuery);
  }
  if (search) {
    const searchQuery = String(search).trim().toLowerCase();
    result = result.filter((item) => {
      return (
        item.title.toLowerCase().includes(searchQuery) ||
        item.restaurant.toLowerCase().includes(searchQuery) ||
        item.category.toLowerCase().includes(searchQuery)
      );
    });
  }

  res.json(result);
});

app.get("/api/items/:id", (req, res) => {
  const id = Number(req.params.id);
  const item = items.find((entry) => entry.id === id);

  if (!item) {
    return res.status(404).json({ error: "Блюдо не найдено" });
  }

  res.json(item);
});

app.post("/api/items", requireAuth, (req, res) => {
  const validation = validateItemPayload(req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const newItem = {
    id: nextItemId++,
    ...validation.value,
  };

  items.unshift(newItem);
  res.status(201).json(newItem);
});

app.put("/api/items/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const itemIndex = items.findIndex((entry) => entry.id === id);

  if (itemIndex === -1) {
    return res.status(404).json({ error: "Блюдо не найдено" });
  }

  const validation = validateItemPayload(req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  items[itemIndex] = {
    id,
    ...validation.value,
  };

  res.json(items[itemIndex]);
});

app.delete("/api/items/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const itemIndex = items.findIndex((entry) => entry.id === id);

  if (itemIndex === -1) {
    return res.status(404).json({ error: "Блюдо не найдено" });
  }

  const [removed] = items.splice(itemIndex, 1);
  res.json({ message: "Блюдо удалено", item: removed });
});

app.use((req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});

app.listen(port, () => {
  console.log(`Сервер запущен: http://localhost:${port}`);
});
