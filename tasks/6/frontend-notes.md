# Frontend Notes — US-6

## Status: Backend-only — No frontend work required

The Tech Lead has determined this issue is backend-only. This is confirmed by:

1. **API contract** (`US-6-api-contract.md`): The `Agentes necessarios` section explicitly states `frontend: nao`.

2. **User story** (`US-6-backend-upload-ocr-gestao-documentos.txt`): The `FORA DO ESCOPO` section explicitly lists "UI/Frontend de upload (apenas backend)".

## Endpoints defined (for future frontend reference)

If a frontend interface is needed in a future issue, the following backend endpoints are available:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/documents/upload` | Upload PDF or DOCX (multipart/form-data, max 10MB) |
| GET | `/api/documents/:id` | Get latest version metadata |
| GET | `/api/documents/:id/content` | Get extracted OCR text (or status if pending) |
| GET | `/api/documents/:id/versions` | List all versions of a document |
| GET | `/api/documents/:id/versions/:versionId` | Get metadata and text for a specific version |
| GET | `/api/documents/:id/audit` | Get audit history for a document |

## Frontend-facing considerations (for future reference)

- File upload must use `multipart/form-data` with a `file` field and optional `document_id` field for re-versioning.
- The upload response is immediate (non-blocking); OCR happens asynchronously. A polling or status-check pattern will be needed to show OCR completion to users.
- Accepted MIME types: `application/pdf` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX).
- Maximum file size: 10MB.
- `ocr_status` can be `pending`, `processing`, `completed`, or `failed` — the UI should handle all four states.
- DOCX files receive `ocr_status: completed` immediately after upload (synchronous text extraction).
