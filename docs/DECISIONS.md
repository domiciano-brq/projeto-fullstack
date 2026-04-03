# Architecture Decision Records

---

## ADR-001 — Digital Signature Integration (US-7)

**Date:** 2026-04-03

**Context:**
The system needs to integrate digital signatures with legal validity using a third-party platform (D4Sign or Clicksign) to allow electronic contract signing with ICP-Brasil certification.

**Decisions:**

1. **Service abstraction layer** — A `signatureService.js` module wraps all calls to the external signature platform. The controller never calls the platform directly. This makes it easy to swap between D4Sign and Clicksign without changing the controller.

2. **Retry with exponential backoff** — All calls to the external platform go through a `withRetry` helper (3 attempts, delays 1s/2s/4s). This handles transient timeouts and temporary unavailability.

3. **Status normalisation** — The `normaliseStatus()` function maps platform-specific status values (`type_post` from D4Sign, `status` from Clicksign) into a single internal vocabulary: `pending_signature | signed | refused | expired | cancelled`.

4. **In-memory store** — Signature records are stored in a `Map` in the controller module. No database dependency at this stage, as specified in the contract.

5. **Webhook validation first** — The webhook handler validates `X-Webhook-Token` before touching any state. No data is written if the token is missing or invalid.

6. **Asynchronous side effects** — Email dispatch and S3 upload run via `setImmediate` (fire-and-forget) so they do not block the HTTP response. Failures are logged but do not affect the caller.

7. **Credentials in environment variables** — `SIGNATURE_API_KEY`, `SIGNATURE_API_URL`, `WEBHOOK_SECRET_TOKEN`, and `AWS_S3_BUCKET` are always read from `process.env`. No credentials are hard-coded.

**Rationale:**
Keeps the implementation simple and direct (no over-engineering), respects the defined API contract, and provides clear extension points for production integrations.
## ADR-001 — In-memory storage instead of relational database (2026-04-03)

**Context:** US-6 requires storing document metadata, version history, and audit logs. The squad backend convention mandates in-memory storage without a real database.

**Decision:** Use JavaScript `Map` objects to simulate the three database tables (`documents`, `document_versions`, `document_audit`). Data is lost on process restart; acceptable for this development phase.

**Rationale:** Keeps the implementation self-contained and dependency-free for the persistence layer. The controller abstracts storage behind a `store` module, making it straightforward to replace with Prisma/Knex + PostgreSQL in a later sprint.

---

## ADR-002 — Simulated S3 upload (2026-04-03)

**Context:** US-6 specifies AWS S3 as the file storage backend. S3 credentials and bucket provisioning are outside the scope of this sprint.

**Decision:** The `simulateS3Upload()` function generates the canonical S3 key (`documents/<document_id>/<version_id>/<filename>`) and returns it without performing a real upload. Files are stored in `multer`'s memory buffer during the request lifecycle.

**Rationale:** Decouples the API contract (which includes the `s3_key` field) from infrastructure provisioning. Replace with `@aws-sdk/client-s3` `PutObjectCommand` when S3 credentials are available.

---

## ADR-003 — Simulated BullMQ OCR pipeline (2026-04-03)

**Context:** US-6 requires asynchronous OCR via BullMQ + Redis for PDFs. BullMQ and Redis are infrastructure dependencies not available in the current environment.

**Decision:** OCR is simulated with `setTimeout` (2-5 second random delay) inside the controller. The simulation updates `ocr_status` to `completed` or `failed` and appends the corresponding audit entry. The endpoint returns immediately with `ocr_status: "pending"`, matching the production behaviour.

**Rationale:** Preserves the async contract without requiring Redis. Replace `scheduleOcrJob()` with a BullMQ `Queue.add()` call and implement a separate Worker process when the infrastructure is ready.

---

## ADR-004 — MIME type validation via magic bytes (2026-04-03)

**Context:** The spec requires validating the actual file content, not just the declared extension or Content-Type header.

**Decision:** Use the `file-type` library (v16 CJS-compatible) to detect MIME type from the first bytes of the buffer. Fall back to the declared MIME type from `multer` if `file-type` is unavailable. The `fileFilter` in multer provides a first pass; the async magic-byte check in the handler provides the definitive validation.

**Rationale:** Prevents MIME-spoofing attacks where a malicious file has a `.pdf` extension but is actually an executable.

---

## ADR-005 — DOCX text extraction is synchronous (2026-04-03)

**Context:** The spec states that DOCX files must have text extracted "natively without depending on OCR" and receive `ocr_status: completed` immediately on upload.

**Decision:** A placeholder `extractDocxText()` function is called synchronously during the upload request. In production, replace with `mammoth.extractRawText({ buffer })` or an equivalent library.

**Rationale:** DOCX is an XML-based format; extraction is fast enough to be done in-request without impacting the response time SLA (< 500 ms).
# Decisoes Arquiteturais

---

## 2026-04-03 — US-5: Pipeline de analise de contratos com IA

### Contexto
Necessidade de implementar pipeline assincrono para analise de contratos via IA (GPT-4o), com cache de resultados, busca semantica e processamento via fila.

### Decisoes

#### 1. Dados em memoria como abstracao de producao
**Decisao:** Implementar stores em memoria (`inMemoryStore.js`) que simulam Redis (cache), BullMQ (fila) e pgvector (embeddings), em vez de depender de servicos externos.

**Racional:** Seguindo a convencao "Dados em memoria — sem banco" do CLAUDE.md e evitando over-engineering. Em producao, os modulos de store podem ser substituidos por clientes reais (ioredis, bullmq, pgvector) sem alterar o contrato das interfaces.

**Trade-offs:** Perda de persistencia entre reinicializacoes do servidor; adequado para desenvolvimento e testes.

---

#### 2. Modo simulado para IA quando OPENAI_API_KEY ausente
**Decisao:** O servico de IA (`aiAnalysis.js`) detecta automaticamente a ausencia da chave OpenAI e ativa um modo simulado com respostas deterministicas.

**Racional:** Permite desenvolvimento e testes sem custo de API e sem dependencia de conectividade externa. A estrutura de resposta e identica ao modo real, garantindo compatibilidade.

**Trade-offs:** Analise simulada nao reflete qualidade da IA real; adequado apenas para desenvolvimento.

---

#### 3. Processamento assincrono via setImmediate (simulando BullMQ)
**Decisao:** O processamento assincrono dos jobs usa `setImmediate` em vez de um worker BullMQ real.

**Racional:** Elimina dependencia de Redis/BullMQ em desenvolvimento, mantendo o comportamento assincrono. O endpoint retorna 202 imediatamente enquanto o processamento ocorre em background. Em producao, substituir por `Queue` e `Worker` do BullMQ.

**Trade-offs:** Sem persistencia de jobs entre reinicializacoes; sem retry real entre processos separados.

---

#### 4. Hash SHA-256 como chave de cache
**Decisao:** A chave de cache no Redis e `contract:analysis:<sha256-hex>` onde o hash e calculado sobre o buffer binario do arquivo.

**Racional:** Garante que contratos identicos (mesmo conteudo, independente do nome do arquivo) nao sejam reprocessados. Hash deterministico e eficiente como chave de cache.

---

#### 5. Similaridade de cosseno para busca semantica
**Decisao:** A busca semantica usa similaridade de cosseno entre vetores de embedding.

**Racional:** Distancia por cosseno e o metodo padrao para embeddings de texto (incluindo text-embedding-ada-002), capturando similaridade semantica independentemente da magnitude dos vetores. Alinhado com a especificacao pgvector do contrato de API.

---

#### 6. Validacao de tamanho antes de qualquer processamento
**Decisao:** A validacao do limite de 10MB ocorre no controller antes de extrair ou processar o conteudo do arquivo.

**Racional:** Previne alocacao de memoria e processamento desnecessarios para arquivos invalidos. O limite tambem e configurado no multer como camada adicional de protecao.

---

#### 7. Nao logging de conteudo sensivel
**Decisao:** Logs nunca incluem o conteudo textual do contrato; apenas `jobId` e `contractHash` sao registrados.

**Racional:** Contratos podem conter informacoes juridicas e comerciais confidenciais. Seguindo a regra tecnica da US-5: "Nao armazenar conteudo sensivel em logs".
# Architecture Decision Records

## ADR-001 — Express over NestJS for initial implementation
**Date:** 2026-04-03
**Context:** US-3 requires authentication and multi-tenant structure. The issue specified NestJS, but the agent squad workflow mandates Express with controllers in `backend/src/controllers/` and routes in `backend/src/routes/index.js`. This aligns with the CLAUDE.md principle of avoiding over-engineering.
**Decision:** Use Express 4.x with a flat controller pattern. Guards and decorators from NestJS are replaced by Express middleware (`requireAuth`, `requireOrgContext`, `requireRole`).
**Consequences:** Simpler setup; no DI container; easier to test in isolation.

---

## ADR-002 — In-memory data store
**Date:** 2026-04-03
**Context:** No database is configured for this phase of development.
**Decision:** All entities (User, Organization, OrganizationMember, Invite, RefreshToken) are stored in plain JavaScript arrays within a shared module (`backend/src/store/index.js`). Data is reset on server restart.
**Consequences:** Fast to implement; no migration needed. Must be replaced with a persistent store before production.

---

## ADR-003 — JWT access token (15min) + opaque refresh token (7 days) with rotation
**Date:** 2026-04-03
**Context:** Security requirement from US-3 spec.
**Decision:** Access tokens are signed JWTs (HS256, 15-minute TTL). Refresh tokens are opaque UUIDs stored in memory with a 7-day TTL. On each refresh, the old token is revoked and a new pair is issued (token rotation).
**Consequences:** Limits the blast radius of a stolen access token. Rotation detects token reuse.

---

## ADR-004 — bcrypt with 10 salt rounds for password hashing
**Date:** 2026-04-03
**Context:** Requirement from US-3 spec (`REGRAS TECNICAS`).
**Decision:** Use `bcrypt` npm package with `saltRounds = 10` for all password hashing. SSO-only users have `passwordHash = null`.
**Consequences:** Passwords are never stored in plaintext and never returned in API responses.

---

## ADR-005 — Google SSO via direct OAuth 2.0 code exchange (no Passport.js)
**Date:** 2026-04-03
**Context:** The spec mentions `passport-google-oauth20` but the Express-only setup avoids unnecessary dependencies.
**Decision:** Implement Google OAuth 2.0 code exchange manually using the native `fetch` API (Node 18+). Redirects to `https://accounts.google.com/o/oauth2/v2/auth` and exchanges the code at `https://oauth2.googleapis.com/token`.
**Consequences:** Fewer dependencies; requires Node >= 18. If Passport is needed later, it can be added without breaking the current flow.

---

## ADR-006 — Multi-tenant isolation via middleware
**Date:** 2026-04-03
**Context:** Each request to org-scoped routes must verify membership and inject org context.
**Decision:** `requireOrgContext` middleware reads `:id` from the route param, verifies org existence and active status, and checks that the authenticated user is a member. It attaches `req.organization` and `req.orgMember` for downstream handlers. `requireRole(...roles)` then enforces role-based access.
**Consequences:** Org isolation is enforced at the route level, preventing cross-tenant data leakage.
