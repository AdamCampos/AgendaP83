const express = require("express");
const router = express.Router();

/**
 * Health-check
 */
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * Funcionários (stub por enquanto)
 * Depois pluga no banco.
 */
router.get("/funcionarios", (req, res) => {
  res.json([]);
});

module.exports = router;
