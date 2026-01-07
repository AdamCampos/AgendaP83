const express = require("express");
const router = express.Router();
const { sql, getPool } = require("./db");

/* =========================
   Helpers
========================= */

// Função para garantir que o valor seja um identificador seguro (apenas letras, números e underline)
function safeIdent(s) {
  return /^[A-Za-z0-9_]+$/.test(s);
}

// Função para garantir que a data esteja no formato ISO ou retornar um valor default
function parseISODateOrDefault(v, fallback) {
  const s = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return fallback;
}

// Função para processar a lista de chaves de funcionários de forma segura (split, trim e validar)
function parseChavesList(v) {
  const s = String(v || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 500);  // Limite de 500 chaves
}

/* =========================
   Health (Verifica se o servidor está funcionando corretamente)
========================= */
router.get("/health", async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1 as ok");  // Simples consulta para verificar o banco
    res.json({ status: "ok", db: "ok" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "error", message: err.message });
  }
});

/* =========================
   META (Mantém informações do banco, como tabelas e colunas)
========================= */

// Rota para retornar todas as tabelas do schema dbo
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

// Rota para retornar todas as colunas de uma tabela específica
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

// Função para buscar subordinados diretos
async function getSubordinadosDiretos(funcionarioChave) {
  const pool = await getPool();
  const r = pool.request();

  r.input('FuncionarioChave', sql.Char(4), funcionarioChave);

  const result = await r.query(`
    SELECT
      f.SuperiorChave, 
      f.SubordinadoChave,
      f1.Nome AS NomeSuperior,
      f2.Nome AS NomeSubordinado,
      f1.Funcao AS FuncaoSuperior
    FROM [dbo].[FuncionarioHierarquia] f
    JOIN [dbo].[Funcionarios] f1 ON f1.Chave = f.SuperiorChave
    JOIN [dbo].[Funcionarios] f2 ON f2.Chave = f.SubordinadoChave
    WHERE f.SuperiorChave = @FuncionarioChave
  `);

  console.log("Subordinados diretos:", result.recordset);
  return result.recordset || [];
}

// Função recursiva para pegar subordinados completos (diretos e indiretos) com agrupamento de subordinados únicos
async function getSubordinadosCompletos(funcionarioChave) {
  const todosSubordinados = [];
  const subordinadosMap = new Map(); // Usado para garantir subordinados únicos

  // Função recursiva para buscar todos os subordinados
  async function buscarSubordinados(funcionarioChave, nivel = 1) {
    const subordinadosDiretos = await getSubordinadosDiretos(funcionarioChave);

    console.log(`Subordinados diretos para ${funcionarioChave}:`, subordinadosDiretos);

    // Agrupando subordinados por NomeSubordinado de forma única
    for (const subordinado of subordinadosDiretos) {
      if (!subordinadosMap.has(subordinado.SubordinadoChave)) {
        subordinadosMap.set(subordinado.SubordinadoChave, subordinado);
        subordinado.Nivel = nivel;

        // Verificando se há supervisores duplicados, e substituindo pela função do superior
        const supervisores = subordinadosDiretos.filter(item => item.SubordinadoChave === subordinado.SubordinadoChave);
        if (supervisores.length > 1) {
          // Substitui os nomes dos supervisores pela função do superior
          subordinado.NomeSuperior = supervisores.map(s => s.FuncaoSuperior).join(", ");
        } else {
          // Caso haja um único superior, substitui o nome do superior pela função
          subordinado.NomeSuperior = subordinado.FuncaoSuperior;
        }

        // Limpa ou mantém o campo 'SuperiorChave' vazio
        subordinado.SuperiorChave = "";  // Ou pode deixar vazio

        todosSubordinados.push(subordinado);
      }
    }

    // Recursão para pegar subordinados do subordinado (indiretos)
    for (const subordinado of subordinadosDiretos) {
      await buscarSubordinados(subordinado.SubordinadoChave, nivel + 1);
    }
  }

  // Inicia a busca com o funcionário
  await buscarSubordinados(funcionarioChave);

  console.log("Subordinados completos (únicos):", todosSubordinados);

  return todosSubordinados;
}


// Rota para retornar a hierarquia com debug
router.get('/hierarquia', async (req, res) => {
  try {
    const funcionarioChave = req.query.funcionarioChave;

    if (!funcionarioChave || funcionarioChave.length !== 4) {
      return res.status(400).json({ error: "A chave do funcionário deve ter 4 caracteres." });
    }

    // Obtemos todos os subordinados (diretos e indiretos) do funcionário
    const subordinados = await getSubordinadosCompletos(funcionarioChave);

    if (subordinados.length === 0) {
      return res.status(404).json({ message: "Nenhum subordinado encontrado." });
    }

    // Retorna os subordinados como resposta
    return res.json(subordinados);

  } catch (err) {
    console.error("Erro ao obter hierarquia:", err);
    return res.status(500).json({ error: "Erro interno do servidor", message: err.message });
  }
});

/* =========================
   NEGÓCIO: Funcionários (LIST)
========================= */

// GET /api/funcionarios?q=...&funcao=...&hierarquia=...&ativo=1&limit=200
router.get("/funcionarios", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const funcao = String(req.query.funcao ?? "").trim();
    const hierarquia = String(req.query.hierarquia ?? "").trim();
    const ativoRaw = String(req.query.ativo ?? "").trim(); // "1" | "0" | ""
    const limit = Math.min(Math.max(Number(req.query.limit ?? 200) || 200, 1), 5000);

    const pool = await getPool();
    const r = pool.request();

    r.input("top", sql.Int, limit);

    const ativo =
      ativoRaw === "" ? null : (ativoRaw === "1" ? 1 : (ativoRaw === "0" ? 0 : null));
    r.input("ativo", sql.Bit, ativo);

    r.input("funcao", sql.NVarChar(120), funcao || null);
    r.input("hierarquia", sql.NVarChar(20), hierarquia || null);

    const qLike = q ? `%${q}%` : null;
    r.input("q", sql.NVarChar(200), q || null);
    r.input("qLike", sql.NVarChar(220), qLike);

    const rs = await r.query(`
      SELECT TOP (@top)
        Chave,
        Matricula,
        Nome,
        Funcao,
        Ativo,
        CriadoEm,
        AtualizadoEm,
        Hierarquia
      FROM dbo.Funcionarios
      WHERE
        (@ativo IS NULL OR Ativo = @ativo)
        AND (@funcao IS NULL OR Funcao = @funcao)
        AND (@hierarquia IS NULL OR Hierarquia = @hierarquia)
        AND (
          @q IS NULL
          OR Chave LIKE @qLike
          OR Matricula LIKE @qLike
          OR Nome LIKE @qLike
          OR Funcao LIKE @qLike
          OR Hierarquia LIKE @qLike
        )
      ORDER BY Nome;
    `);

    res.json(rs.recordset || []);
  } catch (err) {
    res.status(500).json({ error: "FUNCIONARIOS_LIST", message: err.message });
  }
});



// GET /api/funcionarios/byKeys?chaves=FRCF,NVBN,...
router.get("/funcionarios/byKeys", async (req, res) => {
  try {
    const chaves = parseChavesList(req.query.chaves);
    if (!chaves.length) return res.json([]);

    const pool = await getPool();
    const r = pool.request();

    r.input("chaves", sql.NVarChar(sql.MAX), chaves.join(","));

    const rs = await r.query(`
      SELECT
        Chave,
        Matricula,
        Nome,
        Funcao,
        Ativo
      FROM dbo.Funcionarios
      WHERE Chave IN (
        SELECT LTRIM(RTRIM(value))
        FROM string_split(@chaves, ',')
      )
      ORDER BY Nome;
    `);

    res.json(rs.recordset || []);
  } catch (err) {
    res.status(500).json({ error: "FUNCIONARIOS_BY_KEYS", message: err.message });
  }
});


/* =========================
   NEGÓCIO: AgendaDia (CRUD)
========================= */

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
router.get("/agenda", async (req, res) => {
  try {
    const inicio = parseISODateOrDefault(req.query.inicio, "2026-01-01");
    const fim = parseISODateOrDefault(req.query.fim, "2026-01-31");
    const chaves = parseChavesList(req.query.chaves);

    if (!chaves.length) {
      return res.json({ calendario: [], legenda: [], agendaDia: [] });
    }

    const pool = await getPool();
    const r = pool.request();

    r.input("inicio", sql.Date, inicio);
    r.input("fim", sql.Date, fim);

    // IN seguro via parâmetros
    const params = [];
    chaves.forEach((k, idx) => {
      const p = `k${idx}`;
      params.push(`@${p}`);
      r.input(p, sql.Char(4), String(k).trim());
    });

    const inClause = params.join(",");

    // agendaDia
    const rs = await r.query(`
      SELECT
        FuncionarioChave,
        CONVERT(varchar(10), Data, 23) as Data,
        Codigo,
        Fonte,
        Observacao
      FROM dbo.AgendaDia
      WHERE Data >= @inicio AND Data <= @fim
        AND FuncionarioChave IN (${inClause})
      ORDER BY FuncionarioChave, Data
    `);

    const agendaDia = rs.recordset || [];

    // legenda mínima: códigos distintos (nome vazio)
    const codes = Array.from(new Set(agendaDia.map(x => String(x.Codigo ?? "").trim()).filter(Boolean)));
    const legenda = codes.map(c => ({ Codigo: c, Nome: "" }));

    res.json({
      calendario: [],      // o front já tem fallback
      legenda,
      agendaDia,
    });
  } catch (err) {
    console.error("Erro /api/agenda:", err);
    res.status(500).json({ error: "AGENDA_GET", message: err.message });
  }
});


module.exports = router;
