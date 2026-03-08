const env = require("./config/env");
const logger = require("./config/logger");
const createApp = require("./app");

const app = createApp();

app.listen(env.port, () => {
  logger.info({ port: env.port }, "WhatsApp notification API started");
});

