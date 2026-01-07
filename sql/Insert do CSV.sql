USE [P83_Agenda];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @FilePath NVARCHAR(4000) =
N'C:\Projetos\VisualCode\JavaScript\AgendaP83\arquivos_auxiliares\exports\AgendaDia.csv';

--------------------------------------------------------------------------------
-- 1) (OPCIONAL) SEED DA LEGENDA "HOJE" (UPDATE/INSERT, sem DELETE)
--------------------------------------------------------------------------------
DECLARE @LegendaSeed TABLE
(
    Codigo    VARCHAR(10)   NOT NULL,
    Descricao NVARCHAR(120) NOT NULL,
    Tipo      VARCHAR(20)   NOT NULL,
    Icone     NVARCHAR(80)  NULL,
    Ordem     INT           NULL,
    Ativo     BIT           NOT NULL
);

INSERT INTO @LegendaSeed (Codigo, Descricao, Tipo, Icone, Ordem, Ativo)
VALUES
('0',   N'0',                      'STATUS', NULL, NULL, 1),
('A',   N'AFASTADO',               'STATUS', NULL, NULL, 1),
('ANG', N'ANGRA',                  'LOCAL',  NULL, NULL, 1),
('B',   N'BASE',                   'STATUS', NULL, NULL, 1),
('BT',  N'BATAM',                  'LOCAL',  NULL, NULL, 1),
('DR3T',N'DR30 TS',                'EVENTO', NULL, NULL, 1),
('DR6T',N'DR60 TOPSIDE',           'EVENTO', NULL, NULL, 1),
('EM',  N'EMBARCADO',              'STATUS', NULL, NULL, 1),
('EVT', N'EVENTO/MISSÃO',          'STATUS', NULL, NULL, 1),
('F',   N'FÉRIAS',                 'STATUS', NULL, NULL, 1),
('FS',  N'FINAL DE SEMANA/FERIADO','STATUS', NULL, NULL, 1),
('HAY', N'HAYANG',                 'LOCAL',  NULL, NULL, 1),
('HO',  N'HOME OFFICE',            'STATUS', NULL, NULL, 1),
('HOE', N'HOME OFFICE EXTRA',      'STATUS', NULL, NULL, 1),
('HZH1',N'HAZOP Vendor Hull 1',    'EVENTO', NULL, NULL, 1),
('HZH2',N'HAZOP Vendor Hull 2',    'EVENTO', NULL, NULL, 1),
('HZH3',N'HAZOP Vendor Hull 3',    'EVENTO', NULL, NULL, 1),
('HZPR',N'HAZOP Process',          'EVENTO', NULL, NULL, 1),
('HZUT',N'HAZOP Utilities',        'EVENTO', NULL, NULL, 1),
('IN',  N'INTERINO',               'STATUS', NULL, NULL, 1),
('IO',  N'IO',                     'STATUS', NULL, NULL, 1),
('L',   N'LICENÇA',                'STATUS', NULL, NULL, 1),
('NB',  N'NÃO MOBILIZADO',         'STATUS', NULL, NULL, 1),
('NTG', N'NANTONG',                'LOCAL',  NULL, NULL, 1),
('O',   N'FOLGA',                  'STATUS', NULL, NULL, 1),
('OH',  N'OH',                     'STATUS', NULL, NULL, 1),
('PT',  N'EM TRANSFERÊNCIA',       'STATUS', NULL, NULL, 1),
('PUN', N'PUNE',                   'LOCAL',  NULL, NULL, 1),
('PY',  N'PY',                     'STATUS', NULL, NULL, 1),
('SGP', N'SINGAPURA',              'LOCAL',  NULL, NULL, 1),
('TR',  N'TREINAMENTO',            'STATUS', NULL, NULL, 1),
('TUY', N'TUY',                    'STATUS', NULL, NULL, 1),
('V',   N'V',                      'STATUS', NULL, NULL, 1),
('YNT', N'YANTAI',                 'LOCAL',  NULL, NULL, 1);

UPDATE lc
SET lc.Descricao = s.Descricao,
    lc.Tipo      = s.Tipo,
    lc.Icone     = s.Icone,
    lc.Ordem     = s.Ordem,
    lc.Ativo     = s.Ativo
FROM dbo.LegendaCodigo lc
JOIN @LegendaSeed s ON s.Codigo = lc.Codigo;

INSERT INTO dbo.LegendaCodigo (Codigo, Descricao, Tipo, Icone, Ordem, Ativo)
SELECT s.Codigo, s.Descricao, s.Tipo, s.Icone, s.Ordem, s.Ativo
FROM @LegendaSeed s
WHERE NOT EXISTS (SELECT 1 FROM dbo.LegendaCodigo lc WHERE lc.Codigo = s.Codigo);

--------------------------------------------------------------------------------
-- 2) IMPORTAR CSV -> STAGING (NVARCHAR)
--------------------------------------------------------------------------------
IF OBJECT_ID('tempdb..#AgendaDia_Stg') IS NOT NULL DROP TABLE #AgendaDia_Stg;

CREATE TABLE #AgendaDia_Stg
(
    FuncionarioChave  NVARCHAR(50)  NOT NULL,
    [Data]            NVARCHAR(50)  NOT NULL,
    Codigo            NVARCHAR(200) NOT NULL,
    Fonte             NVARCHAR(200) NOT NULL
);

DECLARE @sql NVARCHAR(MAX);

SET @sql = N'
BULK INSERT #AgendaDia_Stg
FROM ' + QUOTENAME(@FilePath,'''') + N'
WITH
(
    FIRSTROW = 2,
    DATAFILETYPE    = ''widechar'',
    FIELDTERMINATOR = ''0x3B00'',
    ROWTERMINATOR   = ''0x0D000A00'',
    TABLOCK,
    KEEPNULLS
);';
EXEC sys.sp_executesql @sql;

UPDATE s
SET
    FuncionarioChave = LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(s.FuncionarioChave, NCHAR(13), N''), NCHAR(65279), N''), NCHAR(8203), N''), NCHAR(160), N' '))),
    [Data]           = LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(s.[Data],           NCHAR(13), N''), NCHAR(65279), N''), NCHAR(8203), N''), NCHAR(160), N' '))),
    Codigo           = LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(s.Codigo,           NCHAR(13), N''), NCHAR(65279), N''), NCHAR(8203), N''), NCHAR(160), N' '))),
    Fonte            = LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(s.Fonte,            NCHAR(13), N''), NCHAR(65279), N''), NCHAR(8203), N''), NCHAR(160), N' ')))
FROM #AgendaDia_Stg s;

--------------------------------------------------------------------------------
-- 3) NORMALIZAR + DEDUP -> #Src  (AJUSTADO PARA CHAVE=4 REAL)
--------------------------------------------------------------------------------
IF OBJECT_ID('tempdb..#Src') IS NOT NULL DROP TABLE #Src;

;WITH SrcRaw AS
(
    SELECT
        FuncionarioChaveFull =
            UPPER(
              REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                LTRIM(RTRIM(s.FuncionarioChave)),
                CHAR(9),  ''),         -- TAB
                NCHAR(160), ''),       -- NBSP
                ' ', ''),              -- espaço normal
                NCHAR(13), ''),        -- CR
                NCHAR(8203), ''),      -- zero-width
                NCHAR(65279), ''       -- BOM
              )
            ),
        DataConv  = TRY_CONVERT(date, s.[Data], 120),
        Codigo10  = LEFT(UPPER(LTRIM(RTRIM(s.Codigo))), 10),
        Fonte20   = LEFT(UPPER(LTRIM(RTRIM(s.Fonte))), 20)
    FROM #AgendaDia_Stg s
),
SrcDedup AS
(
    SELECT
        FuncionarioChave = LEFT(FuncionarioChaveFull, 4),
        [Data]  = DataConv,
        Codigo  = Codigo10,
        Fonte   = Fonte20,
        rn = ROW_NUMBER() OVER
             (PARTITION BY LEFT(FuncionarioChaveFull, 4), DataConv ORDER BY (SELECT 1))
    FROM SrcRaw
)
SELECT
    FuncionarioChave,
    [Data],
    Codigo,
    Fonte
INTO #Src
FROM SrcDedup
WHERE rn = 1
  AND [Data] IS NOT NULL
  AND Codigo <> ''
  AND Fonte  <> ''
  AND LEN(FuncionarioChave) = 4                    -- garante CHECK LEN=4
  AND FuncionarioChave NOT LIKE '%[^0-9A-Z]%'      -- (opcional) só alfanumérico
;

-- (opcional) relatório do que foi descartado por chave inválida:
SELECT DISTINCT
    FuncionarioChave_Invalido = FuncionarioChaveFull,
    LenInvalido = LEN(FuncionarioChaveFull)
FROM
(
    SELECT
        FuncionarioChaveFull =
            UPPER(
              REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                LTRIM(RTRIM(s.FuncionarioChave)),
                CHAR(9),  ''), NCHAR(160), ''), ' ', ''), NCHAR(13), ''), NCHAR(8203), ''), NCHAR(65279), '')
            )
    FROM #AgendaDia_Stg s
) x
WHERE LEN(FuncionarioChaveFull) <> 4
   OR FuncionarioChaveFull LIKE '%[^0-9A-Z]%'
ORDER BY LenInvalido, FuncionarioChave_Invalido;

--------------------------------------------------------------------------------
-- 4) CAMINHO B PARA FUNCIONARIOS: inserir chaves faltantes (AGORA NÃO QUEBRA CHECK)
--------------------------------------------------------------------------------
;WITH MissingFunc AS
(
    SELECT DISTINCT s.FuncionarioChave
    FROM #Src s
    LEFT JOIN dbo.Funcionarios f ON f.Chave = s.FuncionarioChave
    WHERE f.Chave IS NULL
)
INSERT INTO dbo.Funcionarios
(
    Chave, Matricula, Nome, Funcao,
    HierarquiaCodigoOriginal, HierarquiaTipoSugerido, HierarquiaObservacao,
    Ativo, CriadoEm, AtualizadoEm
)
SELECT
    m.FuncionarioChave,
    NULL,
    LEFT(N'AUTO - ' + CONVERT(NVARCHAR(150), m.FuncionarioChave), 150),
    NULL,
    NULL,
    'INDEFINIDO',
    N'Inserido automaticamente pelo import do AgendaDia',
    1,
    SYSUTCDATETIME(),
    NULL
FROM MissingFunc m;

--------------------------------------------------------------------------------
-- 5) CAMINHO B PARA LEGENDA: inserir códigos faltantes
--------------------------------------------------------------------------------
;WITH MissingCod AS
(
    SELECT DISTINCT s.Codigo
    FROM #Src s
    LEFT JOIN dbo.LegendaCodigo lc ON lc.Codigo = s.Codigo
    WHERE lc.Codigo IS NULL
)
INSERT INTO dbo.LegendaCodigo (Codigo, Descricao, Tipo, Icone, Ordem, Ativo)
SELECT
    m.Codigo,
    LEFT(N'AUTO - ' + CONVERT(NVARCHAR(120), m.Codigo), 120),
    'STATUS',
    NULL,
    NULL,
    1
FROM MissingCod m;

--------------------------------------------------------------------------------
-- 6) UPSERT AgendaDia (sem deletar): UPDATE + INSERT
--------------------------------------------------------------------------------
BEGIN TRAN;

UPDATE tgt
SET
    tgt.Codigo = src.Codigo,
    tgt.Fonte  = src.Fonte
FROM dbo.AgendaDia tgt
JOIN #Src src
  ON src.FuncionarioChave = tgt.FuncionarioChave
 AND src.[Data]           = tgt.[Data]
WHERE (tgt.Codigo <> src.Codigo OR tgt.Fonte <> src.Fonte);

INSERT INTO dbo.AgendaDia (FuncionarioChave, [Data], Codigo, Fonte)
SELECT src.FuncionarioChave, src.[Data], src.Codigo, src.Fonte
FROM #Src src
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.AgendaDia tgt
    WHERE tgt.FuncionarioChave = src.FuncionarioChave
      AND tgt.[Data]           = src.[Data]
);

COMMIT;

--------------------------------------------------------------------------------
-- 7) RESUMO
--------------------------------------------------------------------------------
SELECT
    (SELECT COUNT(1) FROM #AgendaDia_Stg) AS LinhasNoCSV_Staging,
    (SELECT COUNT(1) FROM #Src)          AS LinhasValidasParaUpsert,
    (SELECT COUNT(1) FROM dbo.Funcionarios) AS Funcionarios_Total,
    (SELECT COUNT(1) FROM dbo.LegendaCodigo) AS Legenda_Total,
    (SELECT COUNT(1) FROM dbo.AgendaDia) AS AgendaDia_Total;
GO
