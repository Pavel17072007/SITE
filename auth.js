const crypto = require("crypto");
const nodemailer = require("nodemailer");
const db = require("./db");
const { SESSION_COOKIE_OPTIONS } = require("./config");
const { parseCookies, hashResetCode, getSafeUser, getMailTransportConfig } = require("./utils");

const sessions = new Map();
const resetCodes = new Map();

function createSession(res, userId) {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, userId);
  const cookie = `${SESSION_COOKIE_OPTIONS.name}=${sessionId}; HttpOnly; Path=${SESSION_COOKIE_OPTIONS.path}; Max-Age=${SESSION_COOKIE_OPTIONS.maxAge}; SameSite=${SESSION_COOKIE_OPTIONS.sameSite}`;
  res.setHeader("Set-Cookie", cookie);
}

function clearSession(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  if (cookies[SESSION_COOKIE_OPTIONS.name]) {
    sessions.delete(cookies[SESSION_COOKIE_OPTIONS.name]);
  }
  const cookie = `${SESSION_COOKIE_OPTIONS.name}=; HttpOnly; Path=${SESSION_COOKIE_OPTIONS.path}; Max-Age=0; SameSite=${SESSION_COOKIE_OPTIONS.sameSite}`;
  res.setHeader("Set-Cookie", cookie);
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
  const sessionId = cookies[SESSION_COOKIE_OPTIONS.name];

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
    subject: "Сброс пароля FlashFood",
    text: `Код для сброса пароля: ${resetCode}. Код действует 10 минут.`,
    html: `<p>Код для сброса пароля:</p><p><strong style="font-size:22px;letter-spacing:2px">${resetCode}</strong></p><p>Код действует 10 минут.</p>`,
  });
}

function getResetCodes() {
  return resetCodes;
}

function getSessions() {
  return sessions;
}

module.exports = {
  createSession,
  clearSession,
  findUserById,
  getCurrentUser,
  sendPasswordResetEmail,
  getResetCodes,
  getSessions,
};
