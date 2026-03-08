const fs = require("fs");
const path = require("path");

const pool = require("../infrastructure/database/postgres-pool");

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

