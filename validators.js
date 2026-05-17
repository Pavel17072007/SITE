const db = require("./db");

function validatePhone(phone) {
  if (!phone) {
    return "Номер телефона обязателен";
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

function validatePasswordComplexity(password) {
  if (password.length < 6) {
    return "Пароль должен содержать минимум 6 символов";
  }
  if (!/\p{Lu}/u.test(password)) {
    return "Пароль должен содержать хотя бы одну заглавную букву";
  }
  if (!/\p{Nd}/u.test(password)) {
    return "Пароль должен содержать хотя бы одну цифру";
  }
  if (!/[^\p{L}\p{N}]/u.test(password)) {
    return "Пароль должен содержать хотя бы один символ";
  }
  return null;
}

async function validateRegisterPayload(body) {
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const phone = String(body.phone || "").trim();

  if (!email || !email.includes("@")) {
    return "Укажите корректный email";
  }
  if (name.length < 2) {
    return "Имя должно содержать минимум 2 символа";
  }
  const passwordError = validatePasswordComplexity(password);
  if (passwordError) {
    return passwordError;
  }

  const phoneError = validatePhone(phone);
  if (phoneError) {
    return phoneError;
  }

  const [emailRows] = await db.query("SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1", [
    email,
  ]);
  if (emailRows.length) {
    return "Пользователь с таким email уже существует";
  }

  const [phoneRows] = await db.query("SELECT id FROM users WHERE phone = ? LIMIT 1", [phone]);
  if (phoneRows.length) {
    return "Этот номер телефона уже зарегистрирован";
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
    return { error: "Название должно содержать минимум 2 символа" };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { error: "Цена должна быть положительным числом" };
  }
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    return { error: "Рейтинг должен быть в диапазоне от 0 до 5" };
  }
  if (!Number.isFinite(reviews) || reviews < 0) {
    return { error: "Количество отзывов не может быть отрицательным" };
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
      popular: popular ? 1 : 0,
    },
  };
}

module.exports = {
  validatePhone,
  validatePasswordComplexity,
  validateRegisterPayload,
  validateItemPayload,
};
