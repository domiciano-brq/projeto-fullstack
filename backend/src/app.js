'use strict';

/**
 * Express application setup.
 * Entry point: node src/index.js
 */

const express = require('express');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies (for non-multipart endpoints)
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// All API routes under /api prefix
app.use('/api', routes);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Arquivo excede o limite de 10MB' });
  }
  console.error(err.stack || err.message);
  return res.status(500).json({ error: 'Erro interno do servidor' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[App] Servidor iniciado na porta ${PORT}`);
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[App] OPENAI_API_KEY nao configurada — modo simulado ativo');
    }
  });
}

module.exports = app;
