const { Pool } = require("pg");
const env = require("../../config/env");
const logger = require("../../config/logger");

const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on("error", (error) => {
  logger.error({ error }, "Unexpected error on postgres pool");
});

module.exports = pool;

