DECLARE @Data DATE = '2026-01-01';
DECLARE @Fim  DATE = '2026-12-31';

WHILE @Data <= @Fim
BEGIN
    INSERT INTO dbo.Calendario
    (
        Data, Ano, Mes, Dia,
        DiaSemana, NomeDiaSemana, EhFimDeSemana
    )
    VALUES
    (
        @Data,
        YEAR(@Data),
        MONTH(@Data),
        DAY(@Data),
        DATEPART(WEEKDAY, @Data),
        DATENAME(WEEKDAY, @Data),
        CASE WHEN DATENAME(WEEKDAY, @Data) IN ('Saturday','Sunday') THEN 1 ELSE 0 END
    );

    SET @Data = DATEADD(DAY, 1, @Data);
END;
GO
