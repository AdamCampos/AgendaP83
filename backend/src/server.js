const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// API
app.use("/api", require("./routes"));

// Static (produção)
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// Fallback SPA protegido (Express 5: sem app.get("*"))
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const indexPath = path.join(publicDir, "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);

  return res.status(404).send("Frontend ainda não foi buildado.");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});
