'use strict';

/**
 * Documents Controller — US-6
 *
 * Implements:
 *   POST /api/documents/upload
 *   GET  /api/documents/:id
 *   GET  /api/documents/:id/content
 *   GET  /api/documents/:id/versions
 *   GET  /api/documents/:id/versions/:versionId
 *   GET  /api/documents/:id/audit
 *
 * Storage: in-memory Maps (simulating relational DB + S3).
 * OCR:     simulated asynchronously with setTimeout (simulating BullMQ).
 * S3:      simulated — files are NOT uploaded to real S3; s3_key is generated
 *          following the production pattern. In production, replace the
 *          simulateS3Upload() call with the actual AWS SDK PutObject call.
 * DOCX text extraction: simulated synchronously (in production use mammoth/docx).
 * MIME validation: uses file-type to inspect magic bytes when available,
 *                  with a fallback to the declared MIME type from multer.
 */

const { v4: uuidv4 } = require('uuid');
const store = require('../store');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Older .doc format is NOT in scope per spec (PDF/DOCX only).
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Simulated user_id when no auth layer is present.
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect MIME type from buffer magic bytes.
 * Uses the synchronous file-type API (v16 CJS build).
 * Falls back to the MIME type reported by multer.
 */
async function detectMimeType(buffer, declaredMimeType) {
  try {
    // file-type v16 exports a named async function fromBuffer
    const fileType = require('file-type');
    const result = await fileType.fromBuffer(buffer);
    if (result) {
      return result.mime;
    }
  } catch (_) {
    // file-type not available — fall back to declared type
  }
  return declaredMimeType;
}

/**
 * Simulate uploading a file to S3 and return the s3_key.
 * In production, replace with:
 *   await s3Client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType }));
 */
function simulateS3Upload(documentId, versionId, filename) {
  return `documents/${documentId}/${versionId}/${filename}`;
}

/**
 * Simulate DOCX text extraction.
 * In production, replace with mammoth.extractRawText({ buffer }).
 */
function extractDocxText(buffer, filename) {
  // Synchronous simulation — returns placeholder text.
  return `[Texto extraido de ${filename} via DOCX parser]`;
}

/**
 * Simulate OCR processing for PDF files asynchronously.
 * In production, this is a BullMQ job worker that calls Tesseract / AWS Textract.
 */
function scheduleOcrJob(versionId, documentId, filename) {
  // Simulate async processing delay (2-5 seconds).
  const delayMs = 2000 + Math.floor(Math.random() * 3000);

  setTimeout(() => {
    const version = store.documentVersions.get(versionId);
    if (!version) return;

    // Simulate success (90%) or failure (10%).
    const success = Math.random() > 0.1;

    if (success) {
      version.ocr_status = 'completed';
      version.ocr_text = `[Texto extraido via OCR de ${filename}]`;
      version.ocr_error = null;
      addAuditEntry(documentId, versionId, SYSTEM_USER_ID, 'ocr_completed', {
        filename,
      });
    } else {
      version.ocr_status = 'failed';
      version.ocr_text = null;
      version.ocr_error = 'Falha ao processar OCR: timeout no servico de OCR.';
      addAuditEntry(documentId, versionId, SYSTEM_USER_ID, 'ocr_failed', {
        filename,
        error: version.ocr_error,
      });
    }
  }, delayMs);
}

/**
 * Append an audit entry for a document.
 */
function addAuditEntry(documentId, versionId, userId, action, metadata) {
  if (!store.documentAudit.has(documentId)) {
    store.documentAudit.set(documentId, []);
  }
  store.documentAudit.get(documentId).push({
    audit_id: uuidv4(),
    document_id: documentId,
    user_id: userId,
    action,
    version_id: versionId || null,
    metadata: metadata || {},
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get the latest version_id for a document.
 */
function getLatestVersionId(documentId) {
  const versionIds = store.documentVersionIndex.get(documentId);
  if (!versionIds || versionIds.length === 0) return null;
  return versionIds[versionIds.length - 1];
}

// ---------------------------------------------------------------------------
// Endpoint handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/documents/upload
 *
 * Multipart upload. Validates MIME type (magic bytes) and size.
 * Creates or updates a document, creates a new version, schedules OCR for PDFs.
 */
async function uploadDocument(req, res) {
  const file = req.file;

  // Validate: file present
  if (!file) {
    return res.status(400).json({ error: 'Arquivo vazio nao e permitido.' });
  }

  // Validate: size (multer limits handle this, but double-check here)
  if (file.size === 0) {
    return res.status(400).json({ error: 'Arquivo vazio nao e permitido.' });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return res.status(413).json({ error: 'Arquivo excede o limite de 10MB.' });
  }

  // Validate: MIME type via magic bytes
  const detectedMime = await detectMimeType(file.buffer, file.mimetype);

  if (!ALLOWED_MIME_TYPES.has(detectedMime)) {
    return res
      .status(400)
      .json({ error: 'Tipo de arquivo nao permitido. Aceitos: PDF, DOCX.' });
  }

  // Resolve document_id: new document or new version of existing
  const existingDocumentId = req.body.document_id || null;
  let documentId;
  let isNewDocument = false;

  if (existingDocumentId) {
    if (!store.documents.has(existingDocumentId)) {
      return res.status(404).json({ error: 'Documento nao encontrado.' });
    }
    documentId = existingDocumentId;
  } else {
    documentId = uuidv4();
    isNewDocument = true;
    store.documents.set(documentId, {
      document_id: documentId,
      created_at: new Date().toISOString(),
    });
    store.documentVersionIndex.set(documentId, []);
  }

  // Determine version number
  const existingVersionIds = store.documentVersionIndex.get(documentId);
  const versionNumber = existingVersionIds.length + 1;

  // Generate version_id and s3_key
  const versionId = uuidv4();
  const s3Key = simulateS3Upload(documentId, versionId, file.originalname);

  const isPdf =
    detectedMime === 'application/pdf';
  const isDocx =
    detectedMime ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  // For DOCX: extract text synchronously. For PDF: schedule OCR async.
  let ocrStatus;
  let ocrText = null;
  let ocrError = null;

  if (isDocx) {
    ocrStatus = 'completed';
    ocrText = extractDocxText(file.buffer, file.originalname);
  } else {
    // PDF
    ocrStatus = 'pending';
  }

  const now = new Date().toISOString();

  const version = {
    version_id: versionId,
    document_id: documentId,
    version_number: versionNumber,
    filename: file.originalname,
    mime_type: detectedMime,
    size_bytes: file.size,
    s3_key: s3Key,
    ocr_status: ocrStatus,
    ocr_text: ocrText,
    ocr_error: ocrError,
    created_at: now,
    updated_at: now,
  };

  store.documentVersions.set(versionId, version);
  existingVersionIds.push(versionId);

  // Audit: upload / version_created
  const action = isNewDocument ? 'upload' : 'version_created';
  const userId = req.headers['x-user-id'] || SYSTEM_USER_ID;
  addAuditEntry(documentId, versionId, userId, action, {
    filename: file.originalname,
    mime_type: detectedMime,
    size_bytes: file.size,
    version_number: versionNumber,
  });

  // Schedule OCR for PDFs (async, non-blocking)
  if (isPdf) {
    scheduleOcrJob(versionId, documentId, file.originalname);
  }

  return res.status(201).json({
    document_id: documentId,
    version_id: versionId,
    filename: file.originalname,
    mime_type: detectedMime,
    size_bytes: file.size,
    s3_key: s3Key,
    ocr_status: ocrStatus,
    created_at: now,
  });
}

/**
 * GET /api/documents/:id
 *
 * Returns metadata of the latest version of the document.
 */
function getDocument(req, res) {
  const { id } = req.params;

  if (!store.documents.has(id)) {
    return res.status(404).json({ error: 'Documento nao encontrado.' });
  }

  const latestVersionId = getLatestVersionId(id);
  if (!latestVersionId) {
    return res.status(404).json({ error: 'Documento nao encontrado.' });
  }

  const version = store.documentVersions.get(latestVersionId);

  // Audit: viewed
  const userId = req.headers['x-user-id'] || SYSTEM_USER_ID;
  addAuditEntry(id, latestVersionId, userId, 'viewed', {});

  return res.status(200).json({
    document_id: version.document_id,
    version_id: version.version_id,
    filename: version.filename,
    mime_type: version.mime_type,
    size_bytes: version.size_bytes,
    s3_key: version.s3_key,
    ocr_status: version.ocr_status,
    created_at: version.created_at,
    updated_at: version.updated_at,
  });
}

/**
 * GET /api/documents/:id/content
 *
 * Returns extracted text of the latest version.
 * Responds immediately regardless of OCR status.
 */
function getDocumentContent(req, res) {
  const { id } = req.params;

  if (!store.documents.has(id)) {
    return res.status(404).json({ error: 'Documento nao encontrado.' });
  }

  const latestVersionId = getLatestVersionId(id);
  if (!latestVersionId) {
    return res.status(404).json({ error: 'Documento nao encontrado.' });
  }

  const version = store.documentVersions.get(latestVersionId);

  const response = {
    document_id: version.document_id,
    version_id: version.version_id,
    ocr_status: version.ocr_status,
    text: version.ocr_status === 'completed' ? version.ocr_text : null,
  };

  if (version.ocr_status === 'failed') {
    response.ocr_error = version.ocr_error;
  }

  return res.status(200).json(response);
}

/**
 * GET /api/documents/:id/versions
 *
 * Lists all versions of a document, newest first.
 */
function getDocumentVersions(req, res) {
  const { id } = req.params;

  if (!store.documents.has(id)) {
    return res.status(404).json({ error: 'Documento nao encontrado.' });
  }

  const versionIds = store.documentVersionIndex.get(id) || [];

  // newest first
  const versions = [...versionIds]
    .reverse()
    .map((vId) => {
      const v = store.documentVersions.get(vId);
      return {
        version_id: v.version_id,
        version_number: v.version_number,
        filename: v.filename,
        mime_type: v.mime_type,
        size_bytes: v.size_bytes,
        s3_key: v.s3_key,
        ocr_status: v.ocr_status,
        created_at: v.created_at,
      };
    });

  return res.status(200).json({
    document_id: id,
    versions,
  });
}

/**
 * GET /api/documents/:id/versions/:versionId
 *
 * Returns metadata and extracted text of a specific version.
 */
function getDocumentVersion(req, res) {
  const { id, versionId } = req.params;

  if (!store.documents.has(id)) {
    return res.status(404).json({ error: 'Documento ou versao nao encontrado.' });
  }

  const version = store.documentVersions.get(versionId);

  if (!version || version.document_id !== id) {
    return res.status(404).json({ error: 'Documento ou versao nao encontrado.' });
  }

  const response = {
    document_id: version.document_id,
    version_id: version.version_id,
    version_number: version.version_number,
    filename: version.filename,
    mime_type: version.mime_type,
    size_bytes: version.size_bytes,
    s3_key: version.s3_key,
    ocr_status: version.ocr_status,
    text: version.ocr_status === 'completed' ? version.ocr_text : null,
    created_at: version.created_at,
  };

  if (version.ocr_status === 'failed') {
    response.ocr_error = version.ocr_error;
  }

  return res.status(200).json(response);
}

/**
 * GET /api/documents/:id/audit
 *
 * Lists audit history for a document in reverse chronological order.
 */
function getDocumentAudit(req, res) {
  const { id } = req.params;

  if (!store.documents.has(id)) {
    return res.status(404).json({ error: 'Documento nao encontrado.' });
  }

  const auditEntries = store.documentAudit.get(id) || [];

  // newest first
  const sorted = [...auditEntries].reverse();

  return res.status(200).json({
    document_id: id,
    audit: sorted,
  });
}

// ---------------------------------------------------------------------------
// Multer configuration for multipart/form-data uploads
// ---------------------------------------------------------------------------

const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_SIZE_BYTES,
  },
  fileFilter(_req, file, cb) {
    // Preliminary filter by declared MIME type (magic byte check is done in handler)
    const declared = file.mimetype;
    if (ALLOWED_MIME_TYPES.has(declared)) {
      cb(null, true);
    } else {
      // Reject with a typed error that the handler will catch
      const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
      err.message = 'Tipo de arquivo nao permitido. Aceitos: PDF, DOCX.';
      cb(err);
    }
  },
});

/**
 * Multer error-handling middleware wrapper.
 * Converts multer errors to proper JSON responses before they reach Express.
 */
function multerUploadMiddleware(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Arquivo excede o limite de 10MB.' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res
          .status(400)
          .json({ error: err.message || 'Tipo de arquivo nao permitido. Aceitos: PDF, DOCX.' });
      }
      return res.status(400).json({ error: err.message });
    }

    // Unknown error
    return next(err);
  });
}

module.exports = {
  multerUploadMiddleware,
  uploadDocument,
  getDocument,
  getDocumentContent,
  getDocumentVersions,
  getDocumentVersion,
  getDocumentAudit,
};
