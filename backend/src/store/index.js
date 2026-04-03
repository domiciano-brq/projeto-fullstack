/**
 * In-memory data store simulating the database entities:
 *   - documents
 *   - document_versions
 *   - document_audit
 *
 * Note: OCR background jobs are also simulated in-memory using setTimeout.
 * In a production environment, BullMQ + Redis would be used.
 */

'use strict';

// Map<document_id, { document_id, created_at }>
const documents = new Map();

// Map<version_id, { version_id, document_id, version_number, filename, mime_type,
//                   size_bytes, s3_key, ocr_status, ocr_text, ocr_error, created_at }>
const documentVersions = new Map();

// Map<document_id, [version_id, ...]> — ordered list of version_ids per document
const documentVersionIndex = new Map();

// Map<document_id, [audit_entry, ...]>
const documentAudit = new Map();

module.exports = {
  documents,
  documentVersions,
  documentVersionIndex,
  documentAudit,
};
