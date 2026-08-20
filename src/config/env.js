import path from "path";
import dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getPort() {
  const rawPort = process.env.PORT ?? "3010";
  const parsedPort = Number(rawPort);

  if (Number.isNaN(parsedPort) || parsedPort <= 0) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  return parsedPort;
}

function getBooleanEnv(name, defaultValue = false) {
  const value = process.env[name];

  if (value === undefined) {
    return defaultValue;
  }

  return value === "true";
}

function getNumberEnv(name, defaultValue) {
  const value = process.env[name];

  if (!value) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue) || parsedValue < 0) {
    throw new Error(`Invalid ${name} value: ${value}`);
  }

  return parsedValue;
}

const env = {
  port: getPort(),
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  logLevel: process.env.LOG_LEVEL ?? "info",
  printQrInTerminal: process.env.PRINT_QR_IN_TERMINAL !== "false",
  wwebjsAuthDir: path.resolve(process.cwd(), process.env.WWEBJS_AUTH_DIR ?? ".wwebjs_auth"),
  wwebjsHeadless: process.env.WWEBJS_HEADLESS !== "false",
  wwebjsExecutablePath: process.env.WWEBJS_EXECUTABLE_PATH || undefined,
  alertEmailEnabled: getBooleanEnv("ALERT_EMAIL_ENABLED", false),
  alertEmailTo: process.env.ALERT_EMAIL_TO || undefined,
  gmailUser: process.env.GMAIL_USER || undefined,
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || undefined,
  alertEmailCooldownMs: getNumberEnv("ALERT_EMAIL_COOLDOWN_MS", 60 * 60 * 1000),
  restoreSessionsOnStartup: getBooleanEnv("RESTORE_SESSIONS_ON_STARTUP", true),
  reconnectBaseDelayMs: getNumberEnv("RECONNECT_BASE_DELAY_MS", 3000),
  reconnectMaxDelayMs: getNumberEnv("RECONNECT_MAX_DELAY_MS", 15 * 60 * 1000),
};

export default env;
