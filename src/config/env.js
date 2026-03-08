const path = require("path");
const dotenv = require("dotenv");

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

module.exports = {
  port: getPort(),
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  logLevel: process.env.LOG_LEVEL ?? "info",
  authBasePath: path.resolve(process.cwd(), process.env.BAILEYS_AUTH_DIR ?? ".baileys_auth"),
};

