# API Reference

Base URL: `http://localhost:3000/api`

---

## Documents — US-6

### POST /api/documents/upload

Upload a PDF or DOCX file (max 10 MB). Creates a new document or a new version of an existing one. Returns immediately; OCR for PDFs runs asynchronously in the background.

**Headers:** `Content-Type: multipart/form-data`

**Form fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | binary | yes | PDF or DOCX file |
| `document_id` | string (UUID) | no | Omit for a new document; provide to create a new version of an existing document |

**Responses:**

`201 Created`
```json
{
  "document_id": "uuid",
  "version_id": "uuid",
  "filename": "contrato-xyz.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 204800,
  "s3_key": "documents/<document_id>/<version_id>/contrato-xyz.pdf",
  "ocr_status": "pending",
  "created_at": "2026-04-03T00:00:00Z"
}
```

`400 Bad Request` — invalid MIME type or empty file
```json
{ "error": "Tipo de arquivo nao permitido. Aceitos: PDF, DOCX." }
{ "error": "Arquivo vazio nao e permitido." }
```

`413 Payload Too Large` — file exceeds 10 MB
```json
{ "error": "Arquivo excede o limite de 10MB." }
```

---

### GET /api/documents/:id

Returns metadata of the latest version of a document. Records a `viewed` audit entry.

**Responses:**

`200 OK`
```json
{
  "document_id": "uuid",
  "version_id": "uuid",
  "filename": "contrato-xyz.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 204800,
  "s3_key": "documents/<document_id>/<version_id>/contrato-xyz.pdf",
  "ocr_status": "pending | processing | completed | failed",
  "created_at": "2026-04-03T00:00:00Z",
  "updated_at": "2026-04-03T00:00:00Z"
}
```

`404 Not Found`
```json
{ "error": "Documento nao encontrado." }
```

---

### GET /api/documents/:id/content

Returns the extracted text of the latest version. Never blocks on OCR; responds immediately with the current status.

**Responses:**

`200 OK` — completed
```json
{
  "document_id": "uuid",
  "version_id": "uuid",
  "ocr_status": "completed",
  "text": "Texto extraido do documento..."
}
```

`200 OK` — pending / processing
```json
{
  "document_id": "uuid",
  "version_id": "uuid",
  "ocr_status": "pending | processing",
  "text": null
}
```

`200 OK` — failed
```json
{
  "document_id": "uuid",
  "version_id": "uuid",
  "ocr_status": "failed",
  "text": null,
  "ocr_error": "Descricao do erro de processamento."
}
```

`404 Not Found`
```json
{ "error": "Documento nao encontrado." }
```

---

### GET /api/documents/:id/versions

Lists all versions of a document, newest first.

**Responses:**

`200 OK`
```json
{
  "document_id": "uuid",
  "versions": [
    {
      "version_id": "uuid",
      "version_number": 2,
      "filename": "contrato-xyz-v2.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 210000,
      "s3_key": "documents/<document_id>/<version_id>/contrato-xyz-v2.pdf",
      "ocr_status": "completed",
      "created_at": "2026-04-03T01:00:00Z"
    },
    {
      "version_id": "uuid",
      "version_number": 1,
      "filename": "contrato-xyz.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 204800,
      "s3_key": "documents/<document_id>/<version_id>/contrato-xyz.pdf",
      "ocr_status": "completed",
      "created_at": "2026-04-03T00:00:00Z"
    }
  ]
}
```

`404 Not Found`
```json
{ "error": "Documento nao encontrado." }
```

---

### GET /api/documents/:id/versions/:versionId

Returns metadata and extracted text of a specific version.

**Responses:**

`200 OK`
```json
{
  "document_id": "uuid",
  "version_id": "uuid",
  "version_number": 1,
  "filename": "contrato-xyz.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 204800,
  "s3_key": "documents/<document_id>/<version_id>/contrato-xyz.pdf",
  "ocr_status": "completed",
  "text": "Texto extraido do documento...",
  "created_at": "2026-04-03T00:00:00Z"
}
```

`404 Not Found`
```json
{ "error": "Documento ou versao nao encontrado." }
```

---

### GET /api/documents/:id/audit

Lists the audit history for a document in reverse chronological order.

Recorded actions: `upload`, `version_created`, `ocr_completed`, `ocr_failed`, `viewed`.

**Responses:**

`200 OK`
```json
{
  "document_id": "uuid",
  "audit": [
    {
      "audit_id": "uuid",
      "user_id": "uuid",
      "action": "upload | ocr_completed | ocr_failed | version_created | viewed",
      "version_id": "uuid",
      "metadata": {},
      "timestamp": "2026-04-03T00:00:00Z"
    }
  ]
}
```

`404 Not Found`
```json
{ "error": "Documento nao encontrado." }
```

---

## Optional Header

`x-user-id: <uuid>` — identify the acting user for audit purposes. Defaults to the system user (`00000000-0000-0000-0000-000000000000`) when omitted.
