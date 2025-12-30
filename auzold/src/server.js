const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

/**
 * Front-end
 * src/server.js → ../public
 */
app.use(express.static(path.join(__dirname, "..", "public")));

/**
 * React LOCAL (UMD)
 * Sem CDN, sem vendor
 */
app.use(
  "/react",
  express.static(path.join(__dirname, "..", "node_modules", "react", "umd"))
);

app.use(
  "/react-dom",
  express.static(path.join(__dirname, "..", "node_modules", "react-dom", "umd"))
);

/**
 * Banco
 */
const { sql, getPool } = require("./db.js");

/**
 * APIs
 */
app.get("/api/funcionarios", async (req, res) => {
  try {
    const pool = await getPool();

    const rs = await pool.request().query(`
      SELECT
        Chave,
        Matricula,
        Nome,
        Funcao
      FROM dbo.Funcionarios
      ORDER BY Nome
    `);

    res.json(rs.recordset || []);
  } catch (err) {
    console.error("ERRO /api/funcionarios:", err);
    res.status(500).json({
      error: "DB_FUNCIONARIOS",
      message: err.message
    });
  }
});


app.get("/api/agenda/por-funcionarios", async (req, res) => {
  try {
    const { chaves, inicio, fim } = req.query;

    if (!chaves || !inicio || !fim) {
      return res.status(400).json({ error: "Parâmetros inválidos" });
    }

    const lista = chaves.split(",").map(s => s.trim()).filter(Boolean);

    const pool = await getPool();
    const r = pool.request();

    r.input("inicio", sql.Date, inicio);
    r.input("fim", sql.Date, fim);

    const params = lista.map((_, i) => `@c${i}`);
    lista.forEach((c, i) =>
      r.input(`c${i}`, sql.NVarChar(20), c)
    );

    const query = `
      SELECT
        FuncionarioChave,
        Data,
        Codigo
      FROM dbo.AgendaDia
      WHERE FuncionarioChave IN (${params.join(",")})
        AND Data BETWEEN @inicio AND @fim
      ORDER BY FuncionarioChave, Data
    `;

    const rs = await r.query(query);
    res.json(rs.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Server
 */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
