'use strict';

/**
 * Central route registry — all API routes.
 * All routes are prefixed with /api (applied in app.js).
 *
 * Routes registered here:
 *   US-3  — auth, organizations, invites, me
 *   US-5  — contracts analyze/jobs/search
 *   US-6  — documents upload/get/content/versions/audit
 *   US-7  — signature-request/status/webhook
 */

const express = require('express');
const multer = require('multer');

const { requireAuth, requireOrgContext, requireRole } = require('../middleware/auth');

// Controllers
const { signup, login, refresh, googleAuth, googleCallback } = require('../controllers/auth.controller');
const { createOrganization, editOrganization, deactivateOrganization, listMembers, sendInvite } = require('../controllers/organizations.controller');
const { acceptInviteHandler } = require('../controllers/invites.controller');
const { getMe } = require('../controllers/me.controller');
const contractsController = require('../controllers/contracts.controller');
const {
  multerUploadMiddleware,
  uploadDocument,
  getDocument,
  getDocumentContent,
  getDocumentVersions,
  getDocumentVersion,
  getDocumentAudit,
} = require('../controllers/documents.controller');
const signatureController = require('../controllers/signature.controller');

const router = express.Router();

// ---------------------------------------------------------------------------
// Multer for contracts analyze (in-memory, limit allows controller to return 413)
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 + 1, // +1 so controller can return 413 with correct message
  },
});

// ---------------------------------------------------------------------------
// US-3 — Auth
// ---------------------------------------------------------------------------
router.post('/auth/signup', signup);
router.post('/auth/login', login);
router.post('/auth/refresh', refresh);
router.get('/auth/google', googleAuth);
router.get('/auth/google/callback', googleCallback);

// ---------------------------------------------------------------------------
// US-3 — Me
// ---------------------------------------------------------------------------
router.get('/me', requireAuth, getMe);

// ---------------------------------------------------------------------------
// US-3 — Organizations
// ---------------------------------------------------------------------------

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

// List members — any org member
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

// ---------------------------------------------------------------------------
// US-3 — Invites
// ---------------------------------------------------------------------------
router.post('/invites/:token/accept', requireAuth, acceptInviteHandler);

// ---------------------------------------------------------------------------
// US-5 — Contracts (AI analysis pipeline)
// ---------------------------------------------------------------------------

// POST /api/contracts/analyze — submit contract for async AI analysis
router.post('/contracts/analyze', upload.single('file'), contractsController.analyzeContract);

// GET /api/contracts/jobs/:jobId — poll analysis job status
router.get('/contracts/jobs/:jobId', contractsController.getJobStatus);

// GET /api/contracts/search — semantic search
router.get('/contracts/search', contractsController.searchContracts);

// ---------------------------------------------------------------------------
// US-6 — Documents
// ---------------------------------------------------------------------------

// POST /api/documents/upload — multipart upload (PDF or DOCX, max 10 MB)
router.post('/documents/upload', multerUploadMiddleware, uploadDocument);

// GET /api/documents/:id — latest version metadata
router.get('/documents/:id', getDocument);

// GET /api/documents/:id/content — extracted text / OCR status
router.get('/documents/:id/content', getDocumentContent);

// GET /api/documents/:id/versions — all versions, newest first
router.get('/documents/:id/versions', getDocumentVersions);

// GET /api/documents/:id/versions/:versionId — specific version metadata + text
router.get('/documents/:id/versions/:versionId', getDocumentVersion);

// GET /api/documents/:id/audit — audit history
router.get('/documents/:id/audit', getDocumentAudit);

// ---------------------------------------------------------------------------
// US-7 — Digital Signature
// ---------------------------------------------------------------------------

// POST /api/contracts/:id/signature-request — send contract for signing
router.post('/contracts/:id/signature-request', signatureController.createSignatureRequest);

// GET /api/contracts/:id/signature-status — current signature status
router.get('/contracts/:id/signature-status', signatureController.getSignatureStatus);

// DELETE /api/contracts/:id/signature-request — cancel pending signature
router.delete('/contracts/:id/signature-request', signatureController.cancelSignatureRequest);

// POST /api/webhooks/signature — receive platform status notifications
router.post('/webhooks/signature', signatureController.handleWebhook);

module.exports = router;
