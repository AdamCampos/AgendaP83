const express = require("express");
const router = express.Router();
const { sql, getPool } = require("./db");

/* =========================
   Helpers
========================= */

function safeIdent(s) {
  return /^[A-Za-z0-9_]+$/.test(s);
}

function parseISODateOrDefault(v, fallback) {
  const s = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return fallback;
}

function parseChavesList(v) {
  const s = String(v || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 500);
}

/* =========================
   Health
========================= */

router.get("/health", async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1 as ok");
    res.json({ status: "ok", db: "ok" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "error", message: err.message });
  }
});

/* =========================
   META (mantém)
========================= */

router.get("/meta/tabelas", async (req, res) => {
  try {
    const pool = await getPool();
    const rs = await pool.request().query(`
      SELECT s.name AS schema_name, t.name AS table_name
      FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE s.name = 'dbo'
      ORDER BY t.name
    `);
    res.json(rs.recordset);
  } catch (err) {
    res.status(500).json({ error: "META_TABELAS", message: err.message });
  }
});

router.get("/meta/colunas", async (req, res) => {
  try {
    const schema = (req.query.schema || "dbo").trim();
    const tabela = (req.query.tabela || "").trim();
    if (!tabela) return res.status(400).json({ error: "Informe ?tabela=" });

    const pool = await getPool();
    const r = pool.request();
    r.input("schema", sql.NVarChar(128), schema);
    r.input("tabela", sql.NVarChar(128), tabela);

    const rs = await r.query(`
      SELECT
        c.ORDINAL_POSITION,
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE,
        c.IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_SCHEMA = @schema
        AND c.TABLE_NAME = @tabela
      ORDER BY c.ORDINAL_POSITION
    `);

    res.json(rs.recordset || []);
  } catch (err) {
    res.status(500).json({ error: "META_COLUNAS", message: err.message });
  }
});

router.get("/meta/contagem", async (req, res) => {
  try {
    const schema = (req.query.schema || "dbo").trim();
    const tabela = (req.query.tabela || "").trim();
    if (!tabela) return res.status(400).json({ error: "Informe ?tabela=" });

    if (!safeIdent(schema) || !safeIdent(tabela)) {
      return res.status(400).json({ error: "schema/tabela inválidos" });
    }

    const pool = await getPool();
    const rs = await pool.request().query(`
      SELECT COUNT(1) as total
      FROM [${schema}].[${tabela}]
    `);

    res.json({ schema, tabela, total: rs.recordset?.[0]?.total ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "META_CONTAGEM", message: err.message });
  }
});

router.get("/meta/top", async (req, res) => {
  try {
    const schema = (req.query.schema || "dbo").trim();
    const tabela = (req.query.tabela || "").trim();
    const n = Math.min(Number(req.query.n || 10), 100);

    if (!tabela) return res.status(400).json({ error: "Informe ?tabela=" });
    if (!safeIdent(schema) || !safeIdent(tabela)) {
      return res.status(400).json({ error: "schema/tabela inválidos" });
    }

    const pool = await getPool();
    const rs = await pool.request().query(`
      SELECT TOP (${n}) *
      FROM [${schema}].[${tabela}]
    `);

    res.json(rs.recordset || []);
  } catch (err) {
    res.status(500).json({ error: "META_TOP", message: err.message });
  }
});

/* =========================
   NEGÓCIO: Funcionários
   GET /api/funcionarios?q=&ativos=1|0&top=500
========================= */

router.get("/funcionarios", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const ativos = String(req.query.ativos ?? "1").trim();
    const onlyAtivos = ativos !== "0";
    const top = Math.min(Number(req.query.top || 500), 2000);

    const pool = await getPool();
    const r = pool.request();
    r.input("top", sql.Int, top);

    const where = [];
    if (onlyAtivos) where.push("Ativo = 1");

    if (q) {
      r.input("qLike", sql.NVarChar(200), `%${q}%`);
      where.push(`(
        Nome LIKE @qLike OR
        Matricula LIKE @qLike OR
        Chave LIKE @qLike OR
        Funcao LIKE @qLike
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rs = await r.query(`
      SELECT TOP (@top)
        Chave,
        Matricula,
        Nome,
        Funcao,
        Ativo
      FROM dbo.Funcionarios
      ${whereSql}
      ORDER BY Nome
    `);

    res.json(rs.recordset || []);
  } catch (err) {
    res.status(500).json({ error: "FUNCIONARIOS", message: err.message });
  }
});

/* =========================
   NEGÓCIO: Legenda
   GET /api/legenda?tipo=STATUS|LOCAL|EVENTO (opcional)
========================= */

router.get("/legenda", async (req, res) => {
  try {
    const tipo = String(req.query.tipo || "").trim();

    const pool = await getPool();
    const r = pool.request();

    let whereSql = "WHERE Ativo = 1";
    if (tipo) {
      r.input("tipo", sql.NVarChar(50), tipo);
      whereSql += " AND Tipo = @tipo";
    }

    const rs = await r.query(`
      SELECT
        Codigo,
        Descricao,
        Tipo,
        Icone,
        Ordem,
        Ativo
      FROM dbo.LegendaCodigo
      ${whereSql}
      ORDER BY
        CASE WHEN Ordem IS NULL THEN 1 ELSE 0 END,
        Ordem,
        Tipo,
        Codigo
    `);

    res.json(rs.recordset || []);
  } catch (err) {
    res.status(500).json({ error: "LEGENDA", message: err.message });
  }
});

/* =========================
   NEGÓCIO: Calendário (range)
   GET /api/calendario?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
========================= */

router.get("/calendario", async (req, res) => {
    try {
      const inicio = parseISODateOrDefault(req.query.inicio, "2022-01-01");
      const fim = parseISODateOrDefault(req.query.fim, "2022-12-31");
  
      const pool = await getPool();
      const r = pool.request();
      r.input("inicio", sql.Date, inicio);
      r.input("fim", sql.Date, fim);
  
      const rs = await r.query(`
        SELECT
          CONVERT(varchar(10), Data, 23) AS Data,
          Ano, Mes, Dia, DiaSemana, NomeDiaSemana,
          EhFimDeSemana, EhFeriado, DescricaoFeriado
        FROM dbo.Calendario
        WHERE Data >= @inicio AND Data <= @fim
        ORDER BY Data
      `);
  
      res.json(rs.recordset || []);
    } catch (err) {
      res.status(500).json({ error: "CALENDARIO", message: err.message });
    }
  });
  
/**
 * GET /api/agenda/dia/chaves?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
 * Retorna quais FuncionarioChave têm registros no período (pra você não chutar)
 */
router.get("/agenda/dia/chaves", async (req, res) => {
    try {
      const inicio = parseISODateOrDefault(req.query.inicio, "2022-01-01");
      const fim = parseISODateOrDefault(req.query.fim, "2022-12-31");
  
      const pool = await getPool();
      const r = pool.request();
      r.input("inicio", sql.Date, inicio);
      r.input("fim", sql.Date, fim);
  
      const rs = await r.query(`
        SELECT
          FuncionarioChave,
          COUNT(1) AS Total
        FROM dbo.AgendaDia
        WHERE Data >= @inicio AND Data <= @fim
        GROUP BY FuncionarioChave
        ORDER BY Total DESC, FuncionarioChave
      `);
  
      res.json(rs.recordset || []);
    } catch (err) {
      res.status(500).json({ error: "AGENDA_DIA_CHAVES", message: err.message });
    }
  });
  

/* =========================
   NEGÓCIO: AgendaDia (range + chaves)
   GET /api/agenda/dia?chaves=URFG,URFA&inicio=YYYY-MM-DD&fim=YYYY-MM-DD
========================= */

router.get("/agenda/dia", async (req, res) => {
  try {
    const inicio = parseISODateOrDefault(req.query.inicio, "2022-01-01");
    const fim = parseISODateOrDefault(req.query.fim, "2022-12-31");
    const chaves = parseChavesList(req.query.chaves);

    const pool = await getPool();
    const r = pool.request();
    r.input("inicio", sql.Date, inicio);
    r.input("fim", sql.Date, fim);

    const where = ["Data >= @inicio AND Data <= @fim"];

    if (chaves.length) {
      const params = chaves.map((_, i) => `@c${i}`);
      chaves.forEach((v, i) => r.input(`c${i}`, sql.NVarChar(50), v));
      where.push(`FuncionarioChave IN (${params.join(",")})`);
    }

    const rs = await r.query(`
      SELECT
        AgendaDiaId,
        FuncionarioChave,
        CONVERT(varchar(10), Data, 23) AS Data,
        Codigo,
        Fonte,
        Observacao
      FROM dbo.AgendaDia
      WHERE ${where.join(" AND ")}
      ORDER BY FuncionarioChave, Data
    `);

    res.json(rs.recordset || []);
  } catch (err) {
    res.status(500).json({ error: "AGENDA_DIA", message: err.message });
  }
});

/* =========================
   NEGÓCIO: AgendaPeriodo
   (por enquanto vazio no banco → retorna [] sempre)
   GET /api/agenda/periodo?chaves=...&inicio=...&fim=...
========================= */

router.get("/agenda/periodo", async (req, res) => {
  try {
    // Quando você popular a tabela e mandar o TOP/colunas,
    // a gente implementa query real. Por ora:
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: "AGENDA_PERIODO", message: err.message });
  }
});

/* =========================
   Endpoint “combo” (para o front chamar 1 vez)
   GET /api/agenda?chaves=...&inicio=...&fim=...
   Retorna: { calendario, agendaDia, agendaPeriodo, legenda }
========================= */

router.get("/agenda", async (req, res) => {
  try {
    const inicio = parseISODateOrDefault(req.query.inicio, "2022-01-01");
    const fim = parseISODateOrDefault(req.query.fim, "2022-12-31");
    const chaves = parseChavesList(req.query.chaves);

    const pool = await getPool();

    // 1) Calendário
    const rCal = pool.request();
    rCal.input("inicio", sql.Date, inicio);
    rCal.input("fim", sql.Date, fim);
    const calRs = await rCal.query(`
      SELECT
        CONVERT(varchar(10), Data, 23) AS Data,
        Ano,
        Mes,
        Dia,
        DiaSemana,
        NomeDiaSemana,
        EhFimDeSemana,
        EhFeriado,
        DescricaoFeriado
      FROM dbo.Calendario
      WHERE Data >= @inicio AND Data <= @fim
      ORDER BY Data
    `);

    // 2) AgendaDia
    const rDia = pool.request();
    rDia.input("inicio", sql.Date, inicio);
    rDia.input("fim", sql.Date, fim);

    const where = ["Data >= @inicio AND Data <= @fim"];
    if (chaves.length) {
      const params = chaves.map((_, i) => `@c${i}`);
      chaves.forEach((v, i) => rDia.input(`c${i}`, sql.NVarChar(50), v));
      where.push(`FuncionarioChave IN (${params.join(",")})`);
    }

    const diaRs = await rDia.query(`
      SELECT
        AgendaDiaId,
        FuncionarioChave,
        CONVERT(varchar(10), Data, 23) AS Data,
        Codigo,
        Fonte,
        Observacao
      FROM dbo.AgendaDia
      WHERE ${where.join(" AND ")}
      ORDER BY FuncionarioChave, Data
    `);

    // 3) Periodo (vazio por enquanto)
    const periodo = [];

    // 4) Legenda (ativa)
    const legRs = await pool.request().query(`
      SELECT
        Codigo,
        Descricao,
        Tipo,
        Icone,
        Ordem,
        Ativo
      FROM dbo.LegendaCodigo
      WHERE Ativo = 1
      ORDER BY
        CASE WHEN Ordem IS NULL THEN 1 ELSE 0 END,
        Ordem,
        Tipo,
        Codigo
    `);

    res.json({
      inicio,
      fim,
      chaves,
      calendario: calRs.recordset || [],
      agendaDia: diaRs.recordset || [],
      agendaPeriodo: periodo,
      legenda: legRs.recordset || []
    });
  } catch (err) {
    res.status(500).json({ error: "AGENDA_COMBO", message: err.message });
  }
});

module.exports = router;
