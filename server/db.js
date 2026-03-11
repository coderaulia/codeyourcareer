import 'dotenv/config';
import mysql from 'mysql2/promise';

const requiredEnv = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length) {
  throw new Error(`Missing MySQL environment variables: ${missingEnv.join(', ')}`);
}

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  timezone: 'Z',
});

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

export async function transaction(callback) {
  const connection = await pool.getConnection();

  const helpers = {
    async query(sql, params = []) {
      const [rows] = await connection.execute(sql, params);
      return rows;
    },
    async one(sql, params = []) {
      const rows = await helpers.query(sql, params);
      return rows[0] ?? null;
    },
  };

  try {
    await connection.beginTransaction();
    const result = await callback(helpers);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function pingDatabase() {
  const row = await one('SELECT 1 AS ok');
  return row?.ok === 1;
}
