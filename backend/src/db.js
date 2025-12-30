const sql = require("mssql");
require("dotenv").config();

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Variável ${name} não definida no .env`);
  }
  return v;
}

const config = {
  user: requireEnv("DB_USER"),
  password: requireEnv("DB_PASSWORD"),
  server: requireEnv("DB_SERVER"),
  database: requireEnv("DB_DATABASE"),
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

module.exports = { sql, getPool };
