WITH HierarquiaOrganograma AS (
    -- Base da CTE: Subordinados diretos
    SELECT 
        f.[SuperiorChave] AS Superior, 
        f.[SubordinadoChave] AS Subordinado,
        1 AS Nivel
    FROM 
        [dbo].[FuncionarioHierarquia] f
    WHERE 
        f.[DtFim] >= GETDATE() -- Considerando registros ainda válidos (pode ajustar conforme necessário)

    UNION ALL

    -- Parte recursiva: Subordinados indiretos
    SELECT 
        f.[SuperiorChave] AS Superior, 
        f.[SubordinadoChave] AS Subordinado,
        h.Nivel + 1 AS Nivel -- Aumenta o nível à medida que vai descendo na hierarquia
    FROM 
        [dbo].[FuncionarioHierarquia] f
    JOIN 
        HierarquiaOrganograma h 
    ON 
        f.[SuperiorChave] = h.[Subordinado] -- Conecta subordinado direto ao superior
    WHERE 
        f.[DtFim] >= GETDATE() -- Considerando registros ainda válidos
)
-- Consulta final: Mostra todos os superiores, subordinados e o nível na hierarquia
SELECT 
    Superior, 
    Subordinado,
    Nivel,
    f1.Nome AS NomeSuperior,
    f2.Nome AS NomeSubordinado
FROM 
    HierarquiaOrganograma h
JOIN 
    [dbo].[Funcionarios] f1 ON f1.Chave = h.Superior
JOIN 
    [dbo].[Funcionarios] f2 ON f2.Chave = h.Subordinado
ORDER BY 
    Nivel, Superior;
