const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const app = express();

// atrás do Apache (proxy)
app.set("trust proxy", true);

app.use(cors());
app.use(express.json());

// API
app.use("/api", require("./routes"));

// Static (produção)
const publicDir = path.join(__dirname, "..", "public");
app.use(
  express.static(publicDir, {
    index: false,      // deixa o fallback SPA controlar index.html
    fallthrough: true, // se não achar arquivo, cai no fallback
  })
);

// Fallback SPA (Express 5 friendly)
app.use((req, res) => {
  // protege API
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  // ✅ aceita GET e HEAD (curl -I, health-check)
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const indexPath = path.join(publicDir, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  return res.status(404).send("Frontend ainda não foi buildado.");
});

// ✅ porta final: 8311 (interno)
const PORT = Number(process.env.PORT) || 8311;

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Backend rodando internamente em http://127.0.0.1:${PORT}`);
  console.log(`Acesso público: https://10.22.39.23/AgendaP83/`);
});
