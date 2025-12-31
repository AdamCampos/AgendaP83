# AgendaP83 — Escala de Equipe P‑83

## Introdução

O **AgendaP83** é uma aplicação web criada para **substituir o uso de planilhas Excel** no planejamento e acompanhamento da escala de equipes da plataforma **P‑83**.

O Excel vinha sendo utilizado por múltiplos usuários simultaneamente, o que trouxe riscos operacionais — como o ocorrido recentemente, em que um arquivo foi **apagado e salvo automaticamente no OneDrive**, causando perda de informação e retrabalho.

Este sistema elimina esse risco ao centralizar os dados em um **banco SQL Server**, com controle via API e interface web moderna.

---

## Comparação com o Excel

### O que é semelhante ao Excel

- Visual em **grade (linhas × colunas)**, com:
  - Funcionários nas linhas
  - Dias do calendário nas colunas
- Uso de **siglas (FS, HO, TR, YNT, etc.)**
- **Cores por código**, semelhantes ao preenchimento condicional do Excel
- Visualização mensal contínua
- Leitura rápida do status diário de cada funcionário

### O que é melhoria em relação ao Excel

- ✅ **Banco de dados centralizado (SQL Server)** — sem risco de sobrescrita
- ✅ **Múltiplos usuários simultâneos**
- ✅ **Histórico confiável**
- ✅ **Edição controlada por célula ou período**
- ✅ **Comentários por dia**
- ✅ **Busca e filtros dinâmicos**
- ✅ **Legenda dinâmica**
- ✅ **Estilos customizáveis**
- ✅ **Sem dependência de OneDrive**
- ✅ **Base pronta para permissões e auditoria**

---

## Estrutura do Projeto

```
AgendaP83/
├── backend/
└── frontend/
```

---

# Backend

📁 `AgendaP83/backend`

API Node.js (Express) conectada ao SQL Server.

### Rotas principais

- `GET /api/health`
- `GET /api/funcionarios`
- `GET /api/legenda`
- `GET /api/agenda`
- `POST /api/agenda/dia`
- `DELETE /api/agenda/dia`

### Banco

Tabela principal:

`AgendaDia`

Campos:

- `FuncionarioChave`
- `Data`
- `Codigo`
- `Fonte`
- `Observacao`

Índice único:

```
(FuncionarioChave, Data)
```

---

# Frontend

📁 `AgendaP83/frontend`

Aplicação em **Vite + React** com visual inspirado no Excel.

### Funcionalidades

- Grid estilo Excel
- Edição por duplo clique
- Seleção múltipla
- Comentários com tooltip
- Legenda dinâmica
- Editor visual de estilos
- Drag & drop de linhas

---

## Conclusão

O AgendaP83 substitui o Excel com segurança, mantendo familiaridade visual e adicionando confiabilidade, multiusuário e evolução futura.
