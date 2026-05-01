// db/mysql.js
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let pool = null;

/**
 * Create and test a single shared pool.
 * Subsequent calls return the same pool.
 */
export async function connectMySQL() {
  if (pool) {
    return pool;
  }

  const host = process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASS || "";
  const database = process.env.DB_NAME || "university_db";

  if (!user) {
    throw new Error("DB_USER is not set in .env");
  }

  // Create pool
  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // Test the connection once (fails fast if creds wrong)
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`✅ MySQL pool created (host=${host}, database=${database}).`);
    return pool;
  } catch (err) {
    // Clean up pool reference so next call can retry after fix
    try { await pool.end(); } catch (_) {}
    pool = null;
    // Re-throw with a clearer message
    throw new Error(`MySQL connection failed: ${err.message}`);
  }
}

/**
 * Return the pool if created, otherwise throw.
 * Use this inside routes to get the shared pool.
 */
export function getPool() {
  if (!pool) throw new Error("MySQL pool not initialized. Call connectMySQL() first.");
  return pool;
}

export default { connectMySQL, getPool };
