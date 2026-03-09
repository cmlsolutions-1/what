import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import pool from "../infrastructure/database/postgres-pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const migrationPath = path.resolve(
    __dirname,
    "../infrastructure/database/migrations/001_create_whatsapp_senders.sql",
  );

  const sql = fs.readFileSync(migrationPath, "utf8");

  await pool.query(sql);
  await pool.end();

  console.log("Database initialized");
}

run().catch(async (error) => {
  console.error("Failed to initialize database", error);
  await pool.end();
  process.exit(1);
});
