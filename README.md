
# AgendaP83

AgendaP83 é um projeto de agenda corporativa para acompanhamento de **funcionários**, seus **estados de trabalho/ausência** e **períodos** desses estados, com visualização em **linha do tempo** (timeline) no front-end.

O objetivo é permitir que líderes e equipes visualizem rapidamente **como está a equipe** (férias, folga, home office, presencial, missão no exterior etc.), com **agrupamento por hierarquia**.

---

## Visão geral

Cada funcionário terá, no mínimo:

1. **Nome** e **Função**
2. **Estado atual**, por exemplo:
   - Férias
   - Folga
   - Home Office
   - Presencial
   - Missão no exterior
3. **Períodos por estado**
   - Precisamos armazenar e consultar **de quando até quando** o funcionário estará em cada estado
   - Ex.: férias de 2026-01-05 até 2026-01-20, missão de 2026-02-01 até 2026-02-15 etc.
4. **Front-end em timeline**
   - Visualização em **linha do tempo**
   - Uso de **legendas e ícones** para identificar rapidamente o estado de cada pessoa
5. **Hierarquia**
   - Inicialmente usada para:
     - **SQL (grants / permissões)**
     - **agrupamento visual** (ex.: por time, líder, área)

---

## Tecnologias (Stack)

- **Banco de dados:** SQL Server 2012
- **Front-end:** HTML + JavaScript (sem framework inicialmente)
- **Back-end:** C# e Node.js  
  > O projeto pode conter serviços separados (ex.: API em C# e/ou camada Node para integrações/rotas), conforme a evolução.

---

## Funcionalidades planejadas

- Cadastro e manutenção de:
  - Funcionários (nome, função, equipe, hierarquia)
  - Estados possíveis (férias, folga, home office etc.)
  - Períodos (início/fim) associados a um funcionário e um estado
- Consultas para:
  - Situação atual do funcionário
  - Linha do tempo por pessoa
  - Visão de equipe (agrupado por hierarquia)
- Visualização (front-end):
  - Timeline por funcionário
  - Legenda de ícones por estado
  - Filtros por equipe/hierarquia

---

## Banco de Dados e Tabelas

O banco de dados utilizado é o **SQL Server 2012** e as tabelas essenciais incluem:

- **dbo.Funcionarios**: Armazena as informações dos funcionários, como nome, função, matrícula e chave.
- **dbo.AgendaDia**: Contém os dados sobre os dias específicos da agenda, incluindo os estados e os códigos associados a cada um.
- **dbo.AgendaPeriodo**: Gerencia os períodos em que os funcionários estarão em determinados estados.
- **dbo.Calendario**: Contém as datas do calendário, junto com a informação de se são ou não fins de semana.
- **dbo.HierarquiaNiveis**: Define os níveis hierárquicos dos funcionários.
- **dbo.HierarquiaRegras**: Define as regras hierárquicas para permissões e agrupamento.
- **dbo.LegendaCodigo**: Contém os códigos e suas descrições para os estados de trabalho/ausência.
- **dbo.vw_HierarquiaCompleta**: View que combina dados de hierarquia para consultas rápidas e eficientes.

Essas tabelas permitem armazenar e consultar dados essenciais sobre a situação dos funcionários, seus estados de trabalho e a hierarquia organizacional.

---

## Regras e observações

- **Hierarquia** não é apenas visual: ela influencia permissões (grants) no SQL e o agrupamento da equipe.
- O projeto precisa considerar que:
  - Um funcionário pode ter **múltiplos períodos** e **múltiplos estados** ao longo do tempo
  - Estados podem ser **sequenciais** ou **registrados historicamente** (linha do tempo)

---

## Como começar (setup local)

### 1) Criar o repositório e clonar

Repositório: **AgandaP83** (GitHub)

Clone local (destino):
`C:\Projetos\VisualCode\JavaScript`

Exemplo (Git Bash / terminal):
```bash
cd /c/Projetos/VisualCode/JavaScript
git clone https://github.com/AdamCampos/AgendaP83
```

