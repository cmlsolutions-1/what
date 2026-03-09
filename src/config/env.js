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

const env = {
  port: getPort(),
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  logLevel: process.env.LOG_LEVEL ?? "info",
  printQrInTerminal: process.env.PRINT_QR_IN_TERMINAL !== "false",
  wwebjsAuthDir: path.resolve(process.cwd(), process.env.WWEBJS_AUTH_DIR ?? ".wwebjs_auth"),
  wwebjsHeadless: process.env.WWEBJS_HEADLESS !== "false",
  wwebjsExecutablePath: process.env.WWEBJS_EXECUTABLE_PATH || undefined,
};

export default env;
