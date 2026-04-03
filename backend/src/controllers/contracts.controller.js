/**
 * Controller: Analise de contratos com IA
 *
 * Endpoints:
 *   POST   /api/contracts/analyze     — Envia contrato para analise assincrona
 *   GET    /api/contracts/jobs/:jobId — Consulta status e resultado de um job
 *   GET    /api/contracts/search      — Busca semantica por similaridade
 *
 * Convencoes:
 *   - Dados em memoria (sem banco): cache, fila e embeddings via inMemoryStore
 *   - Conteudo sensivel do contrato NAO e logado — apenas jobId e contractHash
 *   - Validacao de tamanho (10MB) ocorre antes de qualquer processamento
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { cache, jobs, embeddings } = require('../services/inMemoryStore');
const { generateEmbedding } = require('../services/aiAnalysis');
const { enqueueAnalysis } = require('../workers/contractAnalysis.worker');

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/contracts/analyze
 *
 * Recebe arquivo via multipart/form-data (campo 'file').
 * Valida tamanho, calcula hash SHA-256, verifica cache e enfileira analise.
 *
 * Resposta 202: job criado (status pending) ou resultado do cache (cachedResult: true)
 */
async function analyzeContract(req, res) {
  try {
    const file = req.file;

    // Validacao: arquivo obrigatorio e formato aceito (PDF ou texto)
    if (!file) {
      return res.status(400).json({ error: 'Arquivo ausente ou formato invalido' });
    }

    const allowedMimeTypes = ['application/pdf', 'text/plain'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Arquivo ausente ou formato invalido' });
    }

    // Validacao de tamanho — deve ocorrer antes de qualquer processamento do conteudo
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return res.status(413).json({ error: 'Arquivo excede o limite de 10MB' });
    }

    // Extrai texto do arquivo
    const contractText = extractText(file);

    // Calcula hash SHA-256 do conteudo — chave de cache no Redis
    const contractHash = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    // Verifica cache (Redis simulado)
    const cachedResult = cache.get(contractHash);
    if (cachedResult) {
      console.log(`[Analyze] Cache hit. hash=${contractHash}`);
      return res.status(202).json({
        jobId: null,
        status: 'completed',
        contractHash,
        cachedResult: true,
        result: cachedResult
      });
    }

    // Enfileira analise assincrona (BullMQ simulado)
    const jobId = uuidv4();
    jobs.create(jobId, contractHash, contractText, file.originalname);
    enqueueAnalysis(jobId, contractHash, contractText, file.originalname);

    console.log(`[Analyze] Job criado. jobId=${jobId} hash=${contractHash}`);

    return res.status(202).json({
      jobId,
      status: 'pending',
      contractHash,
      cachedResult: false
    });
  } catch (err) {
    console.error(`[Analyze] Erro interno: ${err.message}`);
    return res.status(500).json({ error: 'Erro interno ao enfileirar analise' });
  }
}

/**
 * GET /api/contracts/jobs/:jobId
 *
 * Consulta o status e resultado de um job de analise.
 * Retorna status parcial (pending/active/failed) ou resultado completo (completed).
 */
async function getJobStatus(req, res) {
  try {
    const { jobId } = req.params;

    const job = jobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job nao encontrado' });
    }

    if (job.status === 'completed') {
      return res.status(200).json({
        jobId: job.jobId,
        status: 'completed',
        result: job.result
      });
    }

    // pending, active ou failed
    const response = {
      jobId: job.jobId,
      status: job.status
    };

    // Em caso de falha, inclui informacao de erro sem expor conteudo sensivel
    if (job.status === 'failed' && job.result && job.result.error) {
      response.error = 'Falha no processamento do contrato. Tente novamente.';
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error(`[JobStatus] Erro ao consultar job: ${err.message}`);
    return res.status(500).json({ error: 'Erro ao consultar status do job' });
  }
}

/**
 * GET /api/contracts/search
 *
 * Busca contratos semanticamente similares usando embeddings (pgvector simulado).
 * Query params:
 *   - q     (string, obrigatorio): texto de busca
 *   - limit (integer, opcional, default 10, max 50): numero maximo de resultados
 */
async function searchContracts(req, res) {
  try {
    const { q, limit: limitParam } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({ error: "Parametro 'q' e obrigatorio" });
    }

    // Valida e normaliza limite
    let limit = parseInt(limitParam, 10);
    if (isNaN(limit) || limit < 1) {
      limit = 10;
    }
    if (limit > 50) {
      limit = 50;
    }

    // Gera embedding para a query de busca
    const queryEmbedding = await generateEmbedding(q.trim());

    // Busca por similaridade de cosseno no store de embeddings simulado
    const results = embeddings.search(queryEmbedding, limit);

    return res.status(200).json({ results });
  } catch (err) {
    console.error(`[Search] Erro na busca semantica: ${err.message}`);
    return res.status(500).json({ error: 'Erro ao realizar busca semantica' });
  }
}

/**
 * Extrai texto do arquivo recebido.
 * Para PDF: usa texto bruto do buffer (producao usaria pdf-parse).
 * Para texto plano: decodifica como UTF-8.
 */
function extractText(file) {
  if (file.mimetype === 'text/plain') {
    return file.buffer.toString('utf-8');
  }

  // Para PDFs em producao, usar: const pdfParse = require('pdf-parse'); return pdfParse(file.buffer)
  // Em modo de desenvolvimento/simulado, tenta extrair texto legivel do buffer
  const raw = file.buffer.toString('utf-8', 0, Math.min(file.buffer.length, 50000));
  // Remove caracteres de controle PDF e retorna texto legivel
  return raw.replace(/[^\x20-\x7E\u00C0-\u024F\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = { analyzeContract, getJobStatus, searchContracts };
