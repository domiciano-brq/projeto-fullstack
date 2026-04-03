'use strict';

const express = require('express');
const routes = require('./routes/index');
const { startWorker } = require('./workers/analysisWorker');

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ---------------------------------------------------------------------------
// Routes — all registered under /api prefix
// ---------------------------------------------------------------------------
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada.' });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[App] Unhandled error:', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[App] Server listening on port ${PORT}`);
  // Start BullMQ worker in the same process for simplicity
  startWorker();
  console.log('[App] BullMQ worker started.');
});

module.exports = app;
