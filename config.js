require("dotenv").config();

const PORT = Number(process.env.PORT || 3000);

const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;
const RESET_CODE_CLEANUP_INTERVAL_MS = 60 * 1000;

const SESSION_COOKIE_OPTIONS = {
  name: "flashfood_sid",
  httpOnly: true,
  path: "/",
  maxAge: 86400,
  sameSite: "Lax",
};

module.exports = {
  PORT,
  RESET_CODE_TTL_MS,
  RESET_CODE_MAX_ATTEMPTS,
  RESET_CODE_CLEANUP_INTERVAL_MS,
  SESSION_COOKIE_OPTIONS,
};
