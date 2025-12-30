# AgendaP83

Projeto organizado em duas pastas na raiz:

- `backend/` — API Node.js (Express) conectando ao SQL Server
- `frontend/` — Vite + React

Este README documenta **apenas o backend**.

---

## Backend

Caminho do projeto:

`AgendaP83/backend`

---

## Arquivos principais

### server.js

- Inicializa o Express
- Habilita CORS e JSON
- Monta todas as rotas em `/api`
- Serve arquivos estáticos da pasta `public`
- Implementa fallback SPA quando o frontend estiver buildado

---

### routes.js

Arquivo responsável por **todas as rotas da API**.

Principais grupos:

- **Health**
  - `GET /api/health`

- **Meta (SQL Server)**
  - `GET /api/meta/tabelas`
  - `GET /api/meta/colunas`
  - `GET /api/meta/top`
  - `GET /api/meta/contagem`

- **Funcionários**
  - `GET /api/funcionarios`
    - Filtros: `q`, `ativos`, `top`

- **Legenda**
  - `GET /api/legenda`
    - Filtro opcional: `tipo`

- **Calendário**
  - `GET /api/calendario`
    - Parâmetros: `inicio`, `fim`

- **Agenda**
  - `GET /api/agenda/dia`
  - `GET /api/agenda/dia/chaves`
  - `GET /api/agenda/periodo` (atualmente vazio)
  - `GET /api/agenda` (endpoint agregado)

---

### db.js

Responsável pela conexão com o SQL Server usando `mssql`.

Características:

- Pool de conexões reutilizável
- Configuração via variáveis de ambiente
- Falha imediata se variáveis obrigatórias não existirem

---

## Variáveis de ambiente

Arquivo `.env`:

```env
PORT=3001

DB_SERVER=SERVIDOR_SQL
DB_DATABASE=BASE_DADOS
DB_USER=USUARIO
DB_PASSWORD=SENHA
DB_PORT=1433
