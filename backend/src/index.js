/**
 * Entry point do servidor Express — Backend de Analise de Contratos com IA
 *
 * Variaveis de ambiente (ver .env.example):
 *   PORT            - Porta HTTP (default: 3000)
 *   OPENAI_API_KEY  - Chave da API OpenAI (opcional; sem ela, modo simulado e ativado)
 */

const express = require('express');
const routes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parse de JSON
app.use(express.json());

// Middleware para parse de URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Registra todas as rotas da API no prefixo /api
app.use('/api', routes);

// Rota de health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Handler global de erros nao tratados
app.use((err, req, res, next) => {
  // Erro de multer: arquivo muito grande
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
