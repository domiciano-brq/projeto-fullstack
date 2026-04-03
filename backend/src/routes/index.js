'use strict';

/**
 * Central route registry — US-6
 *
 * All routes are prefixed with /api (applied in app.js).
 */

const express = require('express');
const router = express.Router();

const {
  multerUploadMiddleware,
  uploadDocument,
  getDocument,
  getDocumentContent,
  getDocumentVersions,
  getDocumentVersion,
  getDocumentAudit,
} = require('../controllers/documents.controller');

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

// POST /api/documents/upload
// Multipart upload: validates MIME type (magic bytes) and size (<= 10MB).
// Returns 201 immediately without waiting for OCR.
router.post('/documents/upload', multerUploadMiddleware, uploadDocument);

// GET /api/documents/:id
// Returns metadata of the latest version of the document.
router.get('/documents/:id', getDocument);

// GET /api/documents/:id/content
// Returns extracted text (or status if OCR is still pending).
router.get('/documents/:id/content', getDocumentContent);

// GET /api/documents/:id/versions
// Lists all versions, newest first.
router.get('/documents/:id/versions', getDocumentVersions);

// GET /api/documents/:id/versions/:versionId
// Returns metadata + text of a specific version.
router.get('/documents/:id/versions/:versionId', getDocumentVersion);

// GET /api/documents/:id/audit
// Lists audit history in reverse chronological order.
router.get('/documents/:id/audit', getDocumentAudit);
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

 * Routes — US-3: Autenticacao e Estrutura Multi-tenant
 * All routes are prefixed with /api via the Express app.
 */

const { Router } = require('express');
const { requireAuth, requireOrgContext, requireRole } = require('../middleware/auth');

const { signup, login, refresh, googleAuth, googleCallback } = require('../controllers/auth.controller');
const { createOrganization, editOrganization, deactivateOrganization, listMembers, sendInvite } = require('../controllers/organizations.controller');
const { acceptInviteHandler } = require('../controllers/invites.controller');
const { getMe } = require('../controllers/me.controller');

const router = Router();

// ---- Auth ----
router.post('/auth/signup', signup);
router.post('/auth/login', login);
router.post('/auth/refresh', refresh);
router.get('/auth/google', googleAuth);
router.get('/auth/google/callback', googleCallback);

// ---- Me ----
router.get('/me', requireAuth, getMe);

// ---- Organizations ----
// Create org — any authenticated user
router.post('/organizations', requireAuth, createOrganization);

// Edit org — Admin only
router.patch(
  '/organizations/:id',
  requireAuth,
  requireOrgContext,
  requireRole('Admin'),
  editOrganization
);

// Deactivate org (soft delete) — Admin only
router.delete(
  '/organizations/:id',
  requireAuth,
  requireOrgContext,
  requireRole('Admin'),
  deactivateOrganization
);

// List members — any org member (Admin, Member, Viewer)
router.get(
  '/organizations/:id/members',
  requireAuth,
  requireOrgContext,
  listMembers
);

// Send invite — Admin only
router.post(
  '/organizations/:id/invites',
  requireAuth,
  requireOrgContext,
  requireRole('Admin'),
  sendInvite
);

// ---- Invites ----
// Accept invite — authenticated user
router.post('/invites/:token/accept', requireAuth, acceptInviteHandler);

module.exports = router;
