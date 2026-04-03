'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { OpenAIEmbeddings } = require('@langchain/openai');

const { getCachedResult, getAnalysisStatus, setAnalysisStatus } = require('../services/redis');
const { enqueueAnalysis } = require('../services/queue');
const { semanticSearch } = require('../services/db');

// ---------------------------------------------------------------------------
// Multer configuration
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(Object.assign(new Error('INVALID_TYPE'), { code: 'INVALID_TYPE' }));
    }
    cb(null, true);
  },
}).single('file');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate SHA-256 hash of a file on disk.
 */
function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// ---------------------------------------------------------------------------
// POST /api/contracts/analyze
// ---------------------------------------------------------------------------

async function analyzeContract(req, res) {
  // Handle multer upload via callback to capture multer-level errors
  await new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  }).catch((err) => {
    if (err.code === 'INVALID_TYPE') {
      return res.status(400).json({ error: 'Tipo de arquivo invalido. Envie PDF, DOCX ou TXT.' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo excede o limite de 50 MB.' });
    }
    return res.status(400).json({ error: err.message });
  });

  // If a response was already sent (error case above), stop here
  if (res.headersSent) return;

  if (!req.file) {
    return res.status(422).json({ error: 'Nenhum arquivo enviado.' });
  }

  const { path: filePath, mimetype: mimeType, originalname: fileName } = req.file;

  try {
    // Compute SHA-256 of the uploaded file for cache deduplication
    const fileHash = await hashFile(filePath);

    // Check Redis cache
    const cached = await getCachedResult(fileHash);
    if (cached) {
      // Remove the temp file — we already have a cached result
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }

      const analysisId = uuidv4();
      return res.status(202).json({
        analysisId,
        status: 'completed',
        cached: true,
        result: cached,
      });
    }

    // Create a new analysis record
    const analysisId = uuidv4();

    // Store initial status in Redis
    await setAnalysisStatus(analysisId, {
      status: 'queued',
      progress: 0,
      result: null,
      error: null,
    });

    // Enqueue the job
    await enqueueAnalysis({ analysisId, filePath, fileHash, mimeType, fileName });

    return res.status(202).json({
      analysisId,
      status: 'queued',
      cached: false,
    });
  } catch (err) {
    console.error('[POST /api/contracts/analyze]', err);
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    return res.status(500).json({ error: 'Erro interno ao processar a solicitacao.' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/contracts/analyze/:analysisId
// ---------------------------------------------------------------------------

async function getAnalysisResult(req, res) {
  const { analysisId } = req.params;

  try {
    const record = await getAnalysisStatus(analysisId);

    if (!record) {
      return res.status(404).json({ error: 'Analise nao encontrada.' });
    }

    const { status, progress, result, error } = record;

    if (status === 'completed') {
      return res.status(200).json({
        analysisId,
        status: 'completed',
        cached: false,
        result,
      });
    }

    if (status === 'failed') {
      return res.status(200).json({
        analysisId,
        status: 'failed',
        error: error || 'Erro desconhecido durante a analise.',
      });
    }

    // queued | processing
    return res.status(200).json({
      analysisId,
      status,
      progress: progress ?? 0,
    });
  } catch (err) {
    console.error('[GET /api/contracts/analyze/:analysisId]', err);
    return res.status(500).json({ error: 'Erro interno ao consultar o status da analise.' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/contracts/search
// ---------------------------------------------------------------------------

const embeddingsModel = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small',
  openAIApiKey: process.env.OPENAI_API_KEY,
});

async function searchContracts(req, res) {
  const { q, limit: rawLimit } = req.query;

  if (!q || q.trim() === '') {
    return res.status(400).json({ error: "Parametro 'q' e obrigatorio." });
  }

  const limit = Math.min(parseInt(rawLimit, 10) || 10, 50);

  try {
    // Convert query to embedding
    const [queryEmbedding] = await embeddingsModel.embedDocuments([q.trim()]);

    // Semantic search via pgvector
    const rows = await semanticSearch(queryEmbedding, limit);

    const results = rows.map((row) => ({
      analysisId: row.analysis_id,
      fileName: row.file_name,
      similarity: parseFloat(parseFloat(row.similarity).toFixed(4)),
      summary: row.summary,
      analyzedAt: row.analyzed_at,
    }));

    return res.status(200).json({
      query: q.trim(),
      results,
      total: results.length,
    });
  } catch (err) {
    console.error('[GET /api/contracts/search]', err);
    return res.status(500).json({ error: 'Erro interno ao executar a busca semantica.' });
  }
}

module.exports = { analyzeContract, getAnalysisResult, searchContracts };
