'use strict';
/**
 * Express application — US-3
 * Entry point: node src/app.js
 */

const express = require('express');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies (for non-multipart endpoints)
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// All API routes under /api prefix
app.use('/api', routes);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada.' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`Backend US-6 rodando na porta ${PORT}`);
});

app.use(express.json());

// All routes under /api
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

module.exports = app;
