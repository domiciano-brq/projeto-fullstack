'use strict';

const { Router } = require('express');
const {
  analyzeContract,
  getAnalysisResult,
  searchContracts,
} = require('../controllers/contracts.controller');

const router = Router();

// ---------------------------------------------------------------------------
// Contract Analysis Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/contracts/analyze
 * Upload a contract file (PDF, DOCX, TXT) for asynchronous AI analysis.
 * Accepts multipart/form-data with a `file` field.
 * Returns 202 with analysisId immediately; checks Redis cache first.
 */
router.post('/contracts/analyze', analyzeContract);

/**
 * GET /api/contracts/analyze/:analysisId
 * Poll the status and result of a previously submitted analysis.
 * Returns 200 with status (queued | processing | completed | failed).
 * Returns 404 if analysisId is unknown.
 */
router.get('/contracts/analyze/:analysisId', getAnalysisResult);

/**
 * GET /api/contracts/search
 * Semantic search across analysed contracts using pgvector cosine similarity.
 * Query params: q (required), limit (optional, default 10, max 50)
 */
router.get('/contracts/search', searchContracts);

module.exports = router;
