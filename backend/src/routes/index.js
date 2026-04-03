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

module.exports = router;
