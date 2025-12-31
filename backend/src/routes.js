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

/* =========================
   NEGÓCIO: AgendaDia (salvar/editar)
   POST /api/agenda/dia
   Body:
   {
     "items": [
       { "FuncionarioChave":"JMU9", "Data":"2025-07-05", "Codigo":"FS", "Fonte":"USUARIO", "Observacao":"..." }
     ]
   }

   Regras:
   - Faz UPSERT por (FuncionarioChave, Data)
   - Se Codigo vier vazio/null => APAGA o registro (limpa célula)
========================= */

function normStr(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function isIsoDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
}

async function isValidLegendaCodigo(pool, codigo) {
  // valida apenas se vier código (evita update com lixo)
  const c = normStr(codigo);
  if (!c) return true;

  const r = pool.request();
  r.input("codigo", sql.NVarChar(20), c);
  const rs = await r.query(`
    SELECT TOP (1) 1 AS ok
    FROM dbo.LegendaCodigo
    WHERE Ativo = 1 AND Codigo = @codigo
  `);
  return !!rs.recordset?.[0]?.ok;
}

router.post("/agenda/dia", async (req, res) => {
  try {
    const itemsRaw = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!itemsRaw.length) {
      return res.status(400).json({ error: "Informe body.items[]" });
    }

    // limite anti-bomba
    const items = itemsRaw.slice(0, 2000);

    // valida shape
    for (const it of items) {
      const fk = normStr(it.FuncionarioChave);
      const dt = normStr(it.Data);
      if (!fk) return res.status(400).json({ error: "FuncionarioChave obrigatório" });
      if (!isIsoDate(dt)) return res.status(400).json({ error: "Data inválida (YYYY-MM-DD)" });
    }

    const pool = await getPool();

    // opcional mas recomendado: validar códigos existentes na legenda
    // (se você quiser permitir códigos livres, basta remover esse bloco)
    for (const it of items) {
      const codigo = normStr(it.Codigo);
      if (codigo) {
        const ok = await isValidLegendaCodigo(pool, codigo);
        if (!ok) {
          return res.status(400).json({ error: "CODIGO_INVALIDO", codigo });
        }
      }
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      let upserted = 0;
      let deleted = 0;

      for (const it of items) {
        const fk = normStr(it.FuncionarioChave);
        const dt = normStr(it.Data);
        const codigo = normStr(it.Codigo);        // se vazio => delete
        const fonte = normStr(it.Fonte) || "USUARIO";
        const obs = normStr(it.Observacao);       // comentário => usa Observacao

        if (!codigo) {
          // limpa célula => apaga registro
          const rDel = new sql.Request(tx);
          rDel.input("fk", sql.NVarChar(50), fk);
          rDel.input("dt", sql.Date, dt);
          const rsDel = await rDel.query(`
            DELETE FROM dbo.AgendaDia
            WHERE FuncionarioChave = @fk AND Data = @dt
          `);
          deleted += rsDel.rowsAffected?.[0] || 0;
          continue;
        }

        const r = new sql.Request(tx);
        r.input("fk", sql.NVarChar(50), fk);
        r.input("dt", sql.Date, dt);
        r.input("codigo", sql.NVarChar(20), codigo);
        r.input("fonte", sql.NVarChar(50), fonte);
        r.input("obs", sql.NVarChar(sql.MAX), obs);

        // UPSERT por (FuncionarioChave, Data)
        await r.query(`
          MERGE dbo.AgendaDia AS T
          USING (SELECT @fk AS FuncionarioChave, @dt AS Data) AS S
          ON (T.FuncionarioChave = S.FuncionarioChave AND T.Data = S.Data)
          WHEN MATCHED THEN
            UPDATE SET
              Codigo = @codigo,
              Fonte = @fonte,
              Observacao = NULLIF(@obs, ''),
              CriadoEm = COALESCE(T.CriadoEm, GETDATE())
          WHEN NOT MATCHED THEN
            INSERT (FuncionarioChave, Data, Codigo, Fonte, Observacao, CriadoEm)
            VALUES (@fk, @dt, @codigo, @fonte, NULLIF(@obs, ''), GETDATE());
        `);

        upserted += 1;
      }

      await tx.commit();
      res.json({ ok: true, upserted, deleted, received: items.length });
    } catch (errTx) {
      await tx.rollback();
      throw errTx;
    }
  } catch (err) {
    res.status(500).json({ error: "AGENDA_DIA_SAVE", message: err.message });
  }
});

/* =========================
   DELETE /api/agenda/dia
   Body: { FuncionarioChave, Data }
   (atalho pra limpar 1 célula)
========================= */

/* =========================
   NEGÓCIO: AgendaDia (CRUD por API)
   POST /api/agenda/dia   (batch upsert)
   DELETE /api/agenda/dia (delete 1)
========================= */

function normStr(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function isIsoDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
}

async function isValidLegendaCodigo(pool, codigo) {
  const c = normStr(codigo);
  if (!c) return true;

  const r = pool.request();
  r.input("codigo", sql.NVarChar(20), c);
  const rs = await r.query(`
    SELECT TOP (1) 1 AS ok
    FROM dbo.LegendaCodigo
    WHERE Ativo = 1 AND Codigo = @codigo
  `);
  return !!rs.recordset?.[0]?.ok;
}

/**
 * POST /api/agenda/dia
 * Body:
 * {
 *   "items":[
 *     {"FuncionarioChave":"JMU9","Data":"2026-01-10","Codigo":"HO","Fonte":"USUARIO","Observacao":"..." },
 *     ...
 *   ]
 * }
 *
 * Regras:
 * - UPSERT por (FuncionarioChave, Data)
 * - Se Codigo vier vazio/null => DELETE (limpa célula)
 * - Observacao usa o campo já existente dbo.AgendaDia.Observacao
 */
router.post("/agenda/dia", async (req, res) => {
  try {
    const itemsRaw = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!itemsRaw.length) {
      return res.status(400).json({ error: "Informe body.items[]" });
    }

    // limite anti-bomba (ajuste se quiser)
    const items = itemsRaw.slice(0, 2000);

    for (const it of items) {
      const fk = normStr(it.FuncionarioChave);
      const dt = normStr(it.Data);
      if (!fk) return res.status(400).json({ error: "FuncionarioChave obrigatório" });
      if (!isIsoDate(dt)) return res.status(400).json({ error: "Data inválida (YYYY-MM-DD)" });
    }

    const pool = await getPool();

    // valida Codigo contra dbo.LegendaCodigo (Ativo=1)
    for (const it of items) {
      const codigo = normStr(it.Codigo);
      if (codigo) {
        const ok = await isValidLegendaCodigo(pool, codigo);
        if (!ok) return res.status(400).json({ error: "CODIGO_INVALIDO", codigo });
      }
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      let upserted = 0;
      let deleted = 0;

      for (const it of items) {
        const fk = normStr(it.FuncionarioChave);
        const dt = normStr(it.Data);
        const codigo = normStr(it.Codigo);              // vazio => delete
        const fonte = normStr(it.Fonte) || "USUARIO";   // ou "MANUAL"
        const obs = normStr(it.Observacao);             // comentário

        if (!codigo) {
          const rDel = new sql.Request(tx);
          rDel.input("fk", sql.NVarChar(50), fk);
          rDel.input("dt", sql.Date, dt);
          const rsDel = await rDel.query(`
            DELETE FROM dbo.AgendaDia
            WHERE FuncionarioChave = @fk AND Data = @dt
          `);
          deleted += rsDel.rowsAffected?.[0] || 0;
          continue;
        }

        const r = new sql.Request(tx);
        r.input("fk", sql.NVarChar(50), fk);
        r.input("dt", sql.Date, dt);
        r.input("codigo", sql.NVarChar(20), codigo);
        r.input("fonte", sql.NVarChar(50), fonte);
        r.input("obs", sql.NVarChar(sql.MAX), obs);

        await r.query(`
          MERGE dbo.AgendaDia AS T
          USING (SELECT @fk AS FuncionarioChave, @dt AS Data) AS S
          ON (T.FuncionarioChave = S.FuncionarioChave AND T.Data = S.Data)
          WHEN MATCHED THEN
            UPDATE SET
              Codigo = @codigo,
              Fonte = @fonte,
              Observacao = NULLIF(@obs, ''),
              CriadoEm = COALESCE(T.CriadoEm, GETDATE())
          WHEN NOT MATCHED THEN
            INSERT (FuncionarioChave, Data, Codigo, Fonte, Observacao, CriadoEm)
            VALUES (@fk, @dt, @codigo, @fonte, NULLIF(@obs, ''), GETDATE());
        `);

        upserted += 1;
      }

      await tx.commit();
      return res.json({ ok: true, received: items.length, upserted, deleted });
    } catch (errTx) {
      await tx.rollback();
      throw errTx;
    }
  } catch (err) {
    return res.status(500).json({ error: "AGENDA_DIA_SAVE", message: err.message });
  }
});

/**
 * DELETE /api/agenda/dia
 * Body: { "FuncionarioChave":"JMU9", "Data":"2026-01-10" }
 */
router.delete("/agenda/dia", async (req, res) => {
  try {
    const fk = normStr(req.body?.FuncionarioChave);
    const dt = normStr(req.body?.Data);

    if (!fk) return res.status(400).json({ error: "FuncionarioChave obrigatório" });
    if (!isIsoDate(dt)) return res.status(400).json({ error: "Data inválida (YYYY-MM-DD)" });

    const pool = await getPool();
    const r = pool.request();
    r.input("fk", sql.NVarChar(50), fk);
    r.input("dt", sql.Date, dt);

    const rs = await r.query(`
      DELETE FROM dbo.AgendaDia
      WHERE FuncionarioChave = @fk AND Data = @dt
    `);

    return res.json({ ok: true, deleted: rs.rowsAffected?.[0] || 0 });
  } catch (err) {
    return res.status(500).json({ error: "AGENDA_DIA_DELETE", message: err.message });
  }
});



module.exports = router;
