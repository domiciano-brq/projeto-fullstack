'use strict';

/**
 * Entry point do servidor Express.
 *
 * Variaveis de ambiente (ver .env.example):
 *   PORT            - Porta HTTP (default: 3000)
 *   OPENAI_API_KEY  - Chave da API OpenAI (opcional; sem ela, modo simulado e ativado)
 */

const express = require('express');
const routes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
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
  console.error(`[App] Erro nao tratado: ${err.message}`);
  return res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`[App] Servidor iniciado na porta ${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[App] OPENAI_API_KEY nao configurada — modo simulado ativo');
  }
});

module.exports = app;
