/**
 * Registro central de rotas da API.
 * Prefixo base: /api
 *
 * Convencoes:
 *   - Todos os endpoints usam prefixo /api/
 *   - Upload de arquivos via multer (campo 'file', max 10MB)
 *   - Validacao de tamanho feita no controller antes de qualquer processamento
 */

const express = require('express');
const multer = require('multer');
const contractsController = require('../controllers/contracts.controller');

const router = express.Router();

// Configuracao do multer para upload em memoria (sem gravacao em disco)
// O limite de 10MB e validado no controller para retornar 413 conforme contrato
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 + 1 // +1 para permitir que o controller retorne 413 com msg correta
  }
});

// --- Rotas de contratos ---

/**
 * POST /api/contracts/analyze
 * Envia contrato (PDF ou texto) para analise assincrona via IA
 */
router.post(
  '/contracts/analyze',
  upload.single('file'),
  contractsController.analyzeContract
);

/**
 * GET /api/contracts/jobs/:jobId
 * Consulta status e resultado de um job de analise
 */
router.get(
  '/contracts/jobs/:jobId',
  contractsController.getJobStatus
);

/**
 * GET /api/contracts/search
 * Busca semantica por contratos similares
 * Query: q (obrigatorio), limit (opcional, default 10, max 50)
 */
router.get(
  '/contracts/search',
  contractsController.searchContracts
);

module.exports = router;
