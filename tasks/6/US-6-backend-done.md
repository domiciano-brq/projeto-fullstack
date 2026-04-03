# Backend — US-6

## Endpoints implementados

### POST /api/documents/upload
- **Headers:** `Content-Type: multipart/form-data`
- **Body (form-data):** `{ file: <binary>, document_id: string (opcional) }`
- **Resposta 201:**
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
- **Resposta 400:** `{ "error": "Tipo de arquivo nao permitido. Aceitos: PDF, DOCX." }`
- **Resposta 400:** `{ "error": "Arquivo vazio nao e permitido." }`
- **Resposta 413:** `{ "error": "Arquivo excede o limite de 10MB." }`

---

### GET /api/documents/:id
- **Resposta 200:** metadados da versao mais recente (document_id, version_id, filename, mime_type, size_bytes, s3_key, ocr_status, created_at, updated_at)
- **Resposta 404:** `{ "error": "Documento nao encontrado." }`

---

### GET /api/documents/:id/content
- **Resposta 200 (completed):** `{ document_id, version_id, ocr_status: "completed", text: "..." }`
- **Resposta 200 (pending/processing):** `{ document_id, version_id, ocr_status, text: null }`
- **Resposta 200 (failed):** `{ document_id, version_id, ocr_status: "failed", text: null, ocr_error: "..." }`
- **Resposta 404:** `{ "error": "Documento nao encontrado." }`

---

### GET /api/documents/:id/versions
- **Resposta 200:** `{ document_id, versions: [ { version_id, version_number, filename, mime_type, size_bytes, s3_key, ocr_status, created_at } ] }` — ordenado do mais recente ao mais antigo
- **Resposta 404:** `{ "error": "Documento nao encontrado." }`

---

### GET /api/documents/:id/versions/:versionId
- **Resposta 200:** `{ document_id, version_id, version_number, filename, mime_type, size_bytes, s3_key, ocr_status, text, created_at }`
- **Resposta 404:** `{ "error": "Documento ou versao nao encontrado." }`

---

### GET /api/documents/:id/audit
- **Resposta 200:** `{ document_id, audit: [ { audit_id, user_id, action, version_id, metadata, timestamp } ] }` — ordem cronologica decrescente
- **Resposta 404:** `{ "error": "Documento nao encontrado." }`

---

## Arquivos criados/modificados

- `backend/package.json` — dependencias: express, multer, uuid, file-type
- `backend/src/app.js` — entrada Express, prefixo /api, health check
- `backend/src/routes/index.js` — registro de todas as rotas
- `backend/src/controllers/documents.controller.js` — toda a logica de negocio
- `backend/src/store/index.js` — Maps em memoria (documents, document_versions, document_audit, documentVersionIndex)
- `docs/API.md` — documentacao completa dos endpoints
- `docs/DECISIONS.md` — ADRs 001-005

## Observacoes

### Para QA
- O servidor sobe na porta 3000 (ou $PORT). Iniciar com `node backend/src/app.js` apos instalar dependencias (`npm install` dentro de `backend/`).
- Upload valida MIME por magic bytes (via `file-type`). Instale as dependencias antes de testar.
- OCR para PDF e simulado: apos 2-5 segundos o status muda para `completed` ou `failed` (90%/10%). Faca poll em `GET /api/documents/:id/content` para verificar o resultado.
- DOCX recebe `ocr_status: completed` imediatamente apos o upload.
- Para simular nova versao de documento existente, inclua `document_id` no form-data do upload.
- O header opcional `x-user-id: <uuid>` identifica o usuario nas entradas de auditoria. Se omitido, usa `00000000-0000-0000-0000-000000000000`.
- Dados sao perdidos ao reiniciar o servidor (armazenamento em memoria).

### Para producao (fora do escopo desta sprint)
- Substituir `simulateS3Upload()` por `@aws-sdk/client-s3` `PutObjectCommand`.
- Substituir `scheduleOcrJob()` por `bullmq.Queue.add()` e implementar Worker separado com Tesseract/AWS Textract.
- Substituir `extractDocxText()` por `mammoth.extractRawText({ buffer })`.
- Substituir Maps em memoria por ORM (Prisma/Knex) + PostgreSQL.
