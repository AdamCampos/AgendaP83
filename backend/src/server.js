const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* =====================
   Middlewares
===================== */
app.use(cors());
app.use(express.json());

/* =====================
   API
===================== */
const apiRoutes = require("./routes");
app.use("/api", apiRoutes);

/* =====================
   Static (para produção)
   Vite build vai gerar em backend/public
===================== */
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

/**
 * Fallback SPA (somente se existir index.html)
 * Express 5: NÃO usar app.get("*")
 */
app.use((req, res, next) => {
  // Se for API e caiu aqui, é 404 de API.
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const indexPath = path.join(publicDir, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  // Sem front ainda: responde uma mensagem simples ao invés de crashar (ENOENT)
  return res.status(404).send(
    "Frontend ainda não foi buildado. Use o Vite no frontend/ (dev) ou rode o build para gerar backend/public."
  );
});

/* =====================
   Server
===================== */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});
