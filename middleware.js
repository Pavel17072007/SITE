const { getCurrentUser } = require("./auth");

async function requireAuth(req, res, next) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "Требуется авторизация" });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function errorHandler(error, req, res, next) {
  console.error("Server error:", error);

  if (error && error.code === "ER_BAD_DB_ERROR") {
    return res.status(500).json({ error: "База данных flashfood_user не найдена" });
  }

  if (error && error.code === "ECONNREFUSED") {
    return res.status(500).json({ error: "Не удалось подключиться к MySQL на localhost" });
  }

  res.status(500).json({ error: "Внутренняя ошибка сервера" });
}

module.exports = {
  requireAuth,
  errorHandler,
};
