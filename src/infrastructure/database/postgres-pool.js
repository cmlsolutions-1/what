import pg from "pg";
import env from "../../config/env.js";
import logger from "../../config/logger.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on("error", (error) => {
  logger.error({ error }, "Unexpected error on postgres pool");
});

export default pool;
