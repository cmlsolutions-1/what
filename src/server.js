import env from "./config/env.js";
import logger from "./config/logger.js";
import createApp from "./app.js";

const app = createApp();

app.listen(env.port, () => {
  logger.info({ port: env.port }, "WhatsApp notification API started");
});
