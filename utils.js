const crypto = require("crypto");

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

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
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

function normalizeItem(item) {
  return {
    ...item,
    price: Number(item.price),
    rating: Number(item.rating),
    reviews: Number(item.reviews),
    popular: Boolean(item.popular),
  };
}

module.exports = {
  hashPassword,
  hashResetCode,
  parseCookies,
  generateResetCode,
  getSafeUser,
  getMailTransportConfig,
  normalizeItem,
};
