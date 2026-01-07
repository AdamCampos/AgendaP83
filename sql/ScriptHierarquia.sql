/* =========================================================
   P83_Agenda.dbo.Funcionarios
   Atualiza SOMENTE a coluna [Hierarquia] (não cria colunas)
   Regras: Funcao -> Hierarquia (cargo "pai")
   ========================================================= */

USE [P83_Agenda];
GO

BEGIN TRY
  BEGIN TRAN;

  /* 1) Preview do que vai mudar */
  ;WITH Src AS (
    SELECT
      f.Chave,
      f.Matricula,
      f.Nome,
      FuncaoNorm = UPPER(LTRIM(RTRIM(ISNULL(f.Funcao,'')))),
      HierarquiaAtual = UPPER(LTRIM(RTRIM(ISNULL(f.Hierarquia,''))))
    FROM dbo.Funcionarios f
    WHERE f.Ativo = 1
  ),
  Map AS (
    SELECT
      s.*,
      HierarquiaNova =
        CASE s.FuncaoNorm
          /* folhas -> supervisão */
          WHEN 'TMA'  THEN 'SUEIN'
          WHEN 'TMI'  THEN 'SUEIN'
          WHEN 'TME'  THEN 'SUEIN'
          WHEN 'TMM'  THEN 'SUMEC'
          WHEN 'TO_P' THEN 'SUPROD'
          WHEN 'TO_E' THEN 'SUEMB'
          WHEN 'TLT'  THEN 'SUEMB'

          /* supervisores -> coordenação */
          WHEN 'SUEIN'  THEN 'COMAN'
          WHEN 'SUMEC'  THEN 'COMAN'
          WHEN 'SUPROD' THEN 'COPROD'
          WHEN 'SUEMB'  THEN 'COEMB'

          /* coordenação -> gerência */
          WHEN 'COEMB'  THEN 'GEPLAT'
          WHEN 'COPROD' THEN 'GEPLAT'
          WHEN 'COMAN'  THEN 'GEPLAT'

          /* áreas -> gerência operacional */
          WHEN 'ENG' THEN 'GEOP'
          WHEN 'ADM' THEN 'GEOP'

          /* gerência plataforma -> gerência operacional */
          WHEN 'GEPLAT' THEN 'GEOP'

          /* sem mapeamento: mantém como está */
          ELSE NULL
        END
    FROM Src s
  )
  SELECT
    Chave, Matricula, Nome, FuncaoNorm,
    HierarquiaAtual,
    HierarquiaNova
  FROM Map
  WHERE HierarquiaNova IS NOT NULL
    AND HierarquiaAtual <> HierarquiaNova
  ORDER BY FuncaoNorm, Nome;

  /* 2) UPDATE (somente linhas ativas e quando houver mudança real) */
  ;WITH Src AS (
    SELECT
      f.Chave,
      FuncaoNorm = UPPER(LTRIM(RTRIM(ISNULL(f.Funcao,''))))
    FROM dbo.Funcionarios f
    WHERE f.Ativo = 1
  ),
  Map AS (
    SELECT
      s.Chave,
      HierarquiaNova =
        CASE s.FuncaoNorm
          WHEN 'TMA'  THEN 'SUEIN'
          WHEN 'TMI'  THEN 'SUEIN'
          WHEN 'TME'  THEN 'SUEIN'
          WHEN 'TMM'  THEN 'SUMEC'
          WHEN 'TO_P' THEN 'SUPROD'
          WHEN 'TO_E' THEN 'SUEMB'
          WHEN 'TLT'  THEN 'SUEMB'

          WHEN 'SUEIN'  THEN 'COMAN'
          WHEN 'SUMEC'  THEN 'COMAN'
          WHEN 'SUPROD' THEN 'COPROD'
          WHEN 'SUEMB'  THEN 'COEMB'

          WHEN 'COEMB'  THEN 'GEPLAT'
          WHEN 'COPROD' THEN 'GEPLAT'
          WHEN 'COMAN'  THEN 'GEPLAT'

          WHEN 'ENG' THEN 'GEOP'
          WHEN 'ADM' THEN 'GEOP'
          WHEN 'GEPLAT' THEN 'GEOP'

          ELSE NULL
        END
    FROM Src s
  )
  UPDATE f
    SET
      f.Hierarquia = m.HierarquiaNova,
      f.AtualizadoEm = SYSUTCDATETIME()
  FROM dbo.Funcionarios f
  INNER JOIN Map m
    ON m.Chave = f.Chave
  WHERE f.Ativo = 1
    AND m.HierarquiaNova IS NOT NULL
    AND UPPER(LTRIM(RTRIM(ISNULL(f.Hierarquia,'')))) <> m.HierarquiaNova;

  SELECT @@ROWCOUNT AS LinhasAtualizadas;

  COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  THROW;
END CATCH;
GO
