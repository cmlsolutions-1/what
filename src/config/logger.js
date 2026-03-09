import pino from "pino";
import env from "./env.js";

const logger = pino({
  level: env.logLevel,
});

export default logger;
