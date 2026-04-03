# API Contract — US-6

## Agentes necessarios
- backend: sim
- frontend: nao

---

## Endpoints

### POST /api/documents/upload
- **Descricao:** Recebe um arquivo PDF ou DOCX (multipart/form-data), valida tipo MIME e tamanho, persiste no S3 com nome unico, registra o documento no banco com status de OCR pendente e enfileira o job de OCR via BullMQ. Retorna imediatamente sem aguardar o processamento.
- **Headers:** `Content-Type: multipart/form-data`
- **Body:** `{ file: <arquivo binario>, document_id: string (opcional — presente apenas ao fazer upload de nova versao) }`
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
- **Descricao:** Retorna os metadados da versao mais recente de um documento.
- **Body:** N/A
- **Resposta 200:**
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
- **Resposta 404:** `{ "error": "Documento nao encontrado." }`

---

### GET /api/documents/:id/content
- **Descricao:** Retorna o texto extraido do documento. Se o OCR ainda nao terminou, retorna o status atual sem bloquear.
- **Body:** N/A
- **Resposta 200 (processamento concluido):**
```json
{
  "document_id": "uuid",
  "version_id": "uuid",
  "ocr_status": "completed",
  "text": "Texto extraido do documento..."
}
```
- **Resposta 200 (processamento pendente ou em andamento):**
```json
{
  "document_id": "uuid",
  "version_id": "uuid",
  "ocr_status": "pending | processing",
  "text": null
}
```
- **Resposta 200 (falha no processamento):**
```json
{
  "document_id": "uuid",
  "version_id": "uuid",
  "ocr_status": "failed",
  "text": null,
  "ocr_error": "Descricao do erro de processamento."
}
```
- **Resposta 404:** `{ "error": "Documento nao encontrado." }`

---

### GET /api/documents/:id/versions
- **Descricao:** Lista todas as versoes de um documento, da mais recente para a mais antiga.
- **Body:** N/A
- **Resposta 200:**
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
- **Resposta 404:** `{ "error": "Documento nao encontrado." }`

---

### GET /api/documents/:id/versions/:versionId
- **Descricao:** Retorna os metadados e o texto extraido de uma versao especifica de um documento.
- **Body:** N/A
- **Resposta 200:**
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
- **Resposta 404:** `{ "error": "Documento ou versao nao encontrado." }`

---

### GET /api/documents/:id/audit
- **Descricao:** Lista o historico de auditoria de todas as acoes realizadas sobre o documento, em ordem cronologica decrescente.
- **Body:** N/A
- **Resposta 200:**
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
- **Resposta 404:** `{ "error": "Documento nao encontrado." }`

---

## Dados em memoria

Nao aplicavel — todos os dados sao persistidos em banco de dados relacional e S3.

Estrutura logica das entidades principais:

**documents**
```
document_id     uuid  PK
created_at      timestamp UTC
```

**document_versions**
```
version_id      uuid  PK
document_id     uuid  FK -> documents
version_number  integer
filename        string
mime_type       string
size_bytes      integer
s3_key          string
ocr_status      enum: pending | processing | completed | failed
ocr_text        text  (nullable)
ocr_error       string (nullable)
created_at      timestamp UTC
```

**document_audit**
```
audit_id        uuid  PK
document_id     uuid  FK -> documents
version_id      uuid  FK -> document_versions (nullable)
user_id         uuid
action          string
metadata        jsonb (nullable)
timestamp       timestamp UTC
```

---

## Observacoes

- O campo `document_id` no body do upload e opcional: ausente significa novo documento, presente significa nova versao de documento existente.
- O `s3_key` segue o padrao `documents/<document_id>/<version_id>/<filename>` para facilitar rastreabilidade e isolamento por versao.
- OCR e aplicado apenas a PDFs. Arquivos DOCX tem o texto extraido diretamente na hora do upload (sincrono, rapido) e recebem `ocr_status: completed` imediatamente.
- O job BullMQ recebe `version_id` como parametro e atualiza `document_versions` ao finalizar (sucesso ou falha), registrando a acao na tabela de auditoria.
- Auditoria e gravada para: upload (nova versao), conclusao de OCR, falha de OCR.
- Todos os timestamps sao UTC.
- Validacao de MIME deve checar o conteudo binario do arquivo (magic bytes), nao apenas a extensao.
- Limite de tamanho (10MB) deve ser verificado antes de iniciar o upload para o S3.
