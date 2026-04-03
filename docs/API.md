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
Base URL: `http://localhost:3000`

---

## Health Check

### GET /health
Verifica se o servidor esta em operacao.

**Resposta 200:**
```json
{ "status": "ok", "timestamp": "2026-04-03T00:00:00.000Z" }
```

---

## Contratos — Pipeline de Analise com IA

### POST /api/contracts/analyze

Envia um contrato para analise assincrona via IA. Valida o arquivo (max 10MB), calcula o hash SHA-256 do conteudo, verifica cache Redis e, se nao houver resultado cacheado, enfileira um job no BullMQ. Retorna um job ID para rastreamento.

**Content-Type:** `multipart/form-data`

**Campos do form:**
| Campo | Tipo   | Obrigatorio | Descricao                        |
|-------|--------|-------------|----------------------------------|
| file  | File   | Sim         | Arquivo PDF ou texto (max 10MB)  |

**Resposta 202 — Job criado (processamento pendente):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "contractHash": "a3f5c2d1e9b7...",
  "cachedResult": false
}
```

**Resposta 202 — Cache hit (resultado ja disponivel):**
```json
{
  "jobId": null,
  "status": "completed",
  "contractHash": "a3f5c2d1e9b7...",
  "cachedResult": true,
  "result": {
    "summary": "Resumo executivo do contrato...",
    "clauses": [
      {
        "text": "Texto da clausula identificada",
        "riskLevel": "alto",
        "reason": "Explicacao do nivel de risco"
      }
    ]
  }
}
```

**Resposta 400:** `{ "error": "Arquivo ausente ou formato invalido" }`
**Resposta 413:** `{ "error": "Arquivo excede o limite de 10MB" }`
**Resposta 500:** `{ "error": "Erro interno ao enfileirar analise" }`

---

### GET /api/contracts/jobs/:jobId

Consulta o status e o resultado de um job de analise previamente criado. Mecanismo de polling para verificar a conclusao do processamento assincrono.

**Parametros de rota:**
| Parametro | Tipo   | Descricao              |
|-----------|--------|------------------------|
| jobId     | string | UUID do job de analise |

**Resposta 200 — Job pendente ou em processamento:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}
```

Status possiveis: `pending`, `active`, `failed`

**Resposta 200 — Job concluido:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "result": {
    "summary": "Resumo executivo do contrato...",
    "clauses": [
      {
        "text": "Texto da clausula identificada",
        "riskLevel": "alto | medio | baixo",
        "reason": "Explicacao do nivel de risco"
      }
    ]
  }
}
```

**Resposta 404:** `{ "error": "Job nao encontrado" }`
**Resposta 500:** `{ "error": "Erro ao consultar status do job" }`

---

### GET /api/contracts/search

Busca contratos semanticamente similares a uma query de texto usando embeddings (text-embedding-ada-002 / pgvector). Retorna contratos ordenados por similaridade (maior para menor).

**Query Parameters:**
| Parametro | Tipo    | Obrigatorio | Default | Maximo | Descricao                        |
|-----------|---------|-------------|---------|--------|----------------------------------|
| q         | string  | Sim         | —       | —      | Texto de busca                   |
| limit     | integer | Nao         | 10      | 50     | Numero maximo de resultados      |

**Exemplo de request:**
```
GET /api/contracts/search?q=clausula+de+rescisao+unilateral&limit=5
```

**Resposta 200:**
```json
{
  "results": [
    {
      "contractId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "similarityScore": 0.9523,
      "summary": "Contrato de prestacao de servicos com clausulas de rescisao...",
      "fileName": "contrato-servicos-2024.pdf"
    }
  ]
}
```

**Resposta 400:** `{ "error": "Parametro 'q' e obrigatorio" }`
**Resposta 500:** `{ "error": "Erro ao realizar busca semantica" }`

---

## Fluxo de uso tipico

1. **Upload e analise:** `POST /api/contracts/analyze` → recebe `jobId`
2. **Polling de status:** `GET /api/contracts/jobs/:jobId` ate `status === "completed"`
3. **Busca semantica:** `GET /api/contracts/search?q=<termo>` para encontrar contratos similares

---

## Niveis de risco das clausulas

| Nivel | Descricao                                                              |
|-------|------------------------------------------------------------------------|
| alto  | Clausulas abusivas, desequilibrio contratual grave, violacao de direitos |
| medio | Clausulas que merecem atencao e possivel renegociacao                  |
| baixo | Clausulas comuns de mercado com pontos menores a observar              |
# API Documentation

## Base URL
All endpoints are prefixed with `/api`.

---

## US-3: Autenticacao e Estrutura Multi-tenant

### Authentication

#### POST /api/auth/signup
Registers a new user with email and password.

- **Body:** `{ email: string, password: string, name: string }`
- **201:** `{ id: string, email: string, name: string }`
- **400:** `{ error: "Dados invalidos" }`
- **409:** `{ error: "Email ja cadastrado" }`

---

#### POST /api/auth/login
Authenticates a user and returns JWT access + refresh tokens.

- **Body:** `{ email: string, password: string }`
- **200:** `{ access_token: string, refresh_token: string, token_type: "Bearer" }`
- **401:** `{ error: "Credenciais invalidas" }`

---

#### POST /api/auth/refresh
Renews access token using a valid refresh token (token rotation applied).

- **Body:** `{ refresh_token: string }`
- **200:** `{ access_token: string, refresh_token: string, token_type: "Bearer" }`
- **401:** `{ error: "Refresh token invalido ou expirado" }`

---

#### GET /api/auth/google
Redirects to Google OAuth 2.0 consent screen.

- **302:** Redirect to Google OAuth URL
- **500:** `{ error: "Erro ao iniciar SSO" }`

---

#### GET /api/auth/google/callback
Handles Google OAuth callback. Creates or retrieves user and issues tokens.

- **Query params:** `code`, `state` (sent by Google)
- **200:** `{ access_token: string, refresh_token: string, token_type: "Bearer" }`
- **401:** `{ error: "Autenticacao Google falhou" }`

---

### User

#### GET /api/me
Returns authenticated user data with active organization context.

- **Headers:** `Authorization: Bearer <access_token>`
- **200:** `{ id: string, email: string, name: string, role: "Admin"|"Member"|"Viewer"|null, organization: { id: string, name: string, status: string }|null }`
- **401:** `{ error: "Nao autenticado" }`

---

### Organizations

#### POST /api/organizations
Creates a new organization. Authenticated user becomes Admin.

- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** `{ name: string }`
- **201:** `{ id: string, name: string, status: "active", createdAt: string }`
- **400:** `{ error: "Dados invalidos" }`
- **401:** `{ error: "Nao autenticado" }`

---

#### PATCH /api/organizations/:id
Edits an organization. Admin only.

- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** `{ name?: string }`
- **200:** `{ id: string, name: string, status: string, updatedAt: string }`
- **400:** `{ error: "Dados invalidos" }`
- **401:** `{ error: "Nao autenticado" }`
- **403:** `{ error: "Sem permissao" }`
- **404:** `{ error: "Organizacao nao encontrada" }`

---

#### DELETE /api/organizations/:id
Soft-deletes an organization (sets status to "inactive"). Admin only.

- **Headers:** `Authorization: Bearer <access_token>`
- **200:** `{ id: string, status: "inactive" }`
- **401:** `{ error: "Nao autenticado" }`
- **403:** `{ error: "Sem permissao" }`
- **404:** `{ error: "Organizacao nao encontrada" }`

---

#### GET /api/organizations/:id/members
Lists organization members. Data is isolated per org.

- **Headers:** `Authorization: Bearer <access_token>`
- **200:** `{ members: [{ id: string, name: string, email: string, role: "Admin"|"Member"|"Viewer" }] }`
- **401:** `{ error: "Nao autenticado" }`
- **403:** `{ error: "Sem permissao" }`
- **404:** `{ error: "Organizacao nao encontrada" }`

---

#### POST /api/organizations/:id/invites
Sends an invite to join the org (token valid for 7 days). Admin only.

- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** `{ email: string, role: "Member"|"Viewer" }`
- **201:** `{ inviteId: string, email: string, expiresAt: string }`
- **400:** `{ error: "Dados invalidos" }`
- **401:** `{ error: "Nao autenticado" }`
- **403:** `{ error: "Sem permissao" }`
- **404:** `{ error: "Organizacao nao encontrada" }`
- **409:** `{ error: "Usuario ja e membro da organizacao" }`

---

### Invites

#### POST /api/invites/:token/accept
Accepts an invite. Authenticated user is linked to the org with the defined role.

- **Headers:** `Authorization: Bearer <access_token>`
- **200:** `{ organizationId: string, organizationName: string, role: string }`
- **401:** `{ error: "Nao autenticado" }`
- **404:** `{ error: "Convite nao encontrado" }`
- **410:** `{ error: "Convite expirado" }` or `{ error: "Convite ja utilizado" }`
