# Architecture Decision Records

---

## ADR-001 — Express over NestJS for initial implementation (US-3)
**Date:** 2026-04-03
**Context:** US-3 requires authentication and multi-tenant structure. The issue specified NestJS, but the agent squad workflow mandates Express with controllers in `backend/src/controllers/` and routes in `backend/src/routes/index.js`. This aligns with the CLAUDE.md principle of avoiding over-engineering.
**Decision:** Use Express 4.x with a flat controller pattern. Guards and decorators from NestJS are replaced by Express middleware (`requireAuth`, `requireOrgContext`, `requireRole`).
**Consequences:** Simpler setup; no DI container; easier to test in isolation.

---

## ADR-002 — In-memory data store (US-3)
**Date:** 2026-04-03
**Context:** No database is configured for this phase of development.
**Decision:** All entities (User, Organization, OrganizationMember, Invite, RefreshToken) are stored in plain JavaScript arrays within a shared module (`backend/src/store/index.js`). Data is reset on server restart.
**Consequences:** Fast to implement; no migration needed. Must be replaced with a persistent store before production.

---

## ADR-003 — JWT access token (15min) + opaque refresh token (7 days) with rotation (US-3)
**Date:** 2026-04-03
**Context:** Security requirement from US-3 spec.
**Decision:** Access tokens are signed JWTs (HS256, 15-minute TTL). Refresh tokens are opaque UUIDs stored in memory with a 7-day TTL. On each refresh, the old token is revoked and a new pair is issued (token rotation).
**Consequences:** Limits the blast radius of a stolen access token. Rotation detects token reuse.

---

## ADR-004 — bcrypt with 10 salt rounds for password hashing (US-3)
**Date:** 2026-04-03
**Context:** Requirement from US-3 spec (`REGRAS TECNICAS`).
**Decision:** Use `bcrypt` npm package with `saltRounds = 10` for all password hashing. SSO-only users have `passwordHash = null`.
**Consequences:** Passwords are never stored in plaintext and never returned in API responses.

---

## ADR-005 — Google SSO via direct OAuth 2.0 code exchange (no Passport.js) (US-3)
**Date:** 2026-04-03
**Context:** The spec mentions `passport-google-oauth20` but the Express-only setup avoids unnecessary dependencies.
**Decision:** Implement Google OAuth 2.0 code exchange manually using the native `fetch` API (Node 18+). Redirects to `https://accounts.google.com/o/oauth2/v2/auth` and exchanges the code at `https://oauth2.googleapis.com/token`.
**Consequences:** Fewer dependencies; requires Node >= 18. If Passport is needed later, it can be added without breaking the current flow.

---

## ADR-006 — Multi-tenant isolation via middleware (US-3)
**Date:** 2026-04-03
**Context:** Each request to org-scoped routes must verify membership and inject org context.
**Decision:** `requireOrgContext` middleware reads `:id` from the route param, verifies org existence and active status, and checks that the authenticated user is a member. It attaches `req.organization` and `req.orgMember` for downstream handlers. `requireRole(...roles)` then enforces role-based access.
**Consequences:** Org isolation is enforced at the route level, preventing cross-tenant data leakage.

---

## ADR-007 — In-memory stores as production abstractions (US-5)
**Date:** 2026-04-03
**Context:** Necessity to implement an async pipeline for AI-based contract analysis (GPT-4o), with result caching, semantic search and queue processing.
**Decision:** Implement in-memory stores (`inMemoryStore.js`) that simulate Redis (cache), BullMQ (queue) and pgvector (embeddings) instead of depending on external services.
**Rationale:** Following the "Dados em memoria — sem banco" convention from CLAUDE.md and avoiding over-engineering. In production, store modules can be replaced with real clients (ioredis, bullmq, pgvector) without changing interface contracts.
**Trade-offs:** Data loss on server restart; acceptable for development and testing.

---

## ADR-008 — Simulated AI mode when OPENAI_API_KEY is absent (US-5)
**Date:** 2026-04-03
**Context:** US-5 AI analysis pipeline requires OpenAI API key.
**Decision:** The AI service (`aiAnalysis.js`) automatically detects the absence of the OpenAI key and activates a simulated mode with deterministic responses.
**Rationale:** Allows development and testing without API cost and without external connectivity dependency. Response structure is identical to real mode, ensuring compatibility.
**Trade-offs:** Simulated analysis does not reflect real AI quality; acceptable for development only.

---

## ADR-009 — Async processing via setImmediate (simulating BullMQ) (US-5)
**Date:** 2026-04-03
**Context:** US-5 requires async job processing.
**Decision:** Async job processing uses `setImmediate` instead of a real BullMQ worker.
**Rationale:** Eliminates Redis/BullMQ dependency in development while maintaining async behaviour. The endpoint returns 202 immediately while processing happens in background. In production, replace with BullMQ `Queue` and `Worker`.
**Trade-offs:** No job persistence between restarts; no real cross-process retry.

---

## ADR-010 — SHA-256 hash as cache key (US-5)
**Date:** 2026-04-03
**Context:** US-5 requires cache to avoid reprocessing identical contracts.
**Decision:** The Redis cache key is `contract:analysis:<sha256-hex>` where the hash is computed over the file binary buffer.
**Rationale:** Guarantees that identical contracts (same content, regardless of filename) are not reprocessed. Deterministic and efficient as a cache key.

---

## ADR-011 — Cosine similarity for semantic search (US-5)
**Date:** 2026-04-03
**Context:** US-5 requires semantic search over contract embeddings.
**Decision:** Semantic search uses cosine similarity between embedding vectors.
**Rationale:** Cosine distance is the standard method for text embeddings (including text-embedding-ada-002), capturing semantic similarity independently of vector magnitude. Aligned with the pgvector API contract specification.

---

## ADR-012 — Size validation before any processing (US-5)
**Date:** 2026-04-03
**Context:** US-5 specifies a 10 MB file size limit.
**Decision:** The 10 MB limit validation occurs in the controller before extracting or processing file content.
**Rationale:** Prevents unnecessary memory allocation and processing for invalid files. The limit is also configured in multer as an additional protection layer.

---

## ADR-013 — No logging of sensitive content (US-5)
**Date:** 2026-04-03
**Context:** Contracts may contain confidential legal and commercial information.
**Decision:** Logs never include the textual content of the contract; only `jobId` and `contractHash` are logged.
**Rationale:** Follows the US-5 technical rule: "Nao armazenar conteudo sensivel em logs".

---

## ADR-014 — In-memory storage for documents (US-6)
**Date:** 2026-04-03
**Context:** US-6 requires storing document metadata, version history, and audit logs. The squad backend convention mandates in-memory storage without a real database.
**Decision:** Use JavaScript `Map` objects to simulate the three database tables (`documents`, `document_versions`, `document_audit`). Data is lost on process restart; acceptable for this development phase.
**Rationale:** Keeps the implementation self-contained and dependency-free for the persistence layer. The controller abstracts storage behind a `store` module, making it straightforward to replace with Prisma/Knex + PostgreSQL in a later sprint.

---

## ADR-015 — Simulated S3 upload (US-6)
**Date:** 2026-04-03
**Context:** US-6 specifies AWS S3 as the file storage backend. S3 credentials and bucket provisioning are outside the scope of this sprint.
**Decision:** The `simulateS3Upload()` function generates the canonical S3 key (`documents/<document_id>/<version_id>/<filename>`) and returns it without performing a real upload. Files are stored in `multer`'s memory buffer during the request lifecycle.
**Rationale:** Decouples the API contract (which includes the `s3_key` field) from infrastructure provisioning. Replace with `@aws-sdk/client-s3` `PutObjectCommand` when S3 credentials are available.

---

## ADR-016 — Simulated BullMQ OCR pipeline (US-6)
**Date:** 2026-04-03
**Context:** US-6 requires asynchronous OCR via BullMQ + Redis for PDFs. BullMQ and Redis are infrastructure dependencies not available in the current environment.
**Decision:** OCR is simulated with `setTimeout` (2-5 second random delay) inside the controller. The simulation updates `ocr_status` to `completed` or `failed` and appends the corresponding audit entry. The endpoint returns immediately with `ocr_status: "pending"`, matching the production behaviour.
**Rationale:** Preserves the async contract without requiring Redis. Replace `scheduleOcrJob()` with a BullMQ `Queue.add()` call and implement a separate Worker process when the infrastructure is ready.

---

## ADR-017 — MIME type validation via magic bytes (US-6)
**Date:** 2026-04-03
**Context:** The spec requires validating the actual file content, not just the declared extension or Content-Type header.
**Decision:** Use the `file-type` library (v16 CJS-compatible) to detect MIME type from the first bytes of the buffer. Fall back to the declared MIME type from `multer` if `file-type` is unavailable. The `fileFilter` in multer provides a first pass; the async magic-byte check in the handler provides the definitive validation.
**Rationale:** Prevents MIME-spoofing attacks where a malicious file has a `.pdf` extension but is actually an executable.

---

## ADR-018 — DOCX text extraction is synchronous (US-6)
**Date:** 2026-04-03
**Context:** The spec states that DOCX files must have text extracted "natively without depending on OCR" and receive `ocr_status: completed` immediately on upload.
**Decision:** A placeholder `extractDocxText()` function is called synchronously during the upload request. In production, replace with `mammoth.extractRawText({ buffer })` or an equivalent library.
**Rationale:** DOCX is an XML-based format; extraction is fast enough to be done in-request without impacting the response time SLA (< 500 ms).

---

## ADR-019 — Service abstraction layer for digital signature (US-7)
**Date:** 2026-04-03
**Context:** The system needs to integrate digital signatures with legal validity using a third-party platform (D4Sign or Clicksign).
**Decision:** A `signatureService.js` module wraps all calls to the external signature platform. The controller never calls the platform directly. This makes it easy to swap between D4Sign and Clicksign without changing the controller.

---

## ADR-020 — Retry with exponential backoff for signature platform calls (US-7)
**Date:** 2026-04-03
**Context:** External signature platform calls may fail transiently.
**Decision:** All calls to the external platform go through a `withRetry` helper (3 attempts, delays 1s/2s/4s). This handles transient timeouts and temporary unavailability.

---

## ADR-021 — Status normalisation for signature platforms (US-7)
**Date:** 2026-04-03
**Context:** D4Sign and Clicksign use different status vocabularies.
**Decision:** The `normaliseStatus()` function maps platform-specific status values (`type_post` from D4Sign, `status` from Clicksign) into a single internal vocabulary: `pending_signature | signed | refused | expired | cancelled`.

---

## ADR-022 — In-memory store for signature records (US-7)
**Date:** 2026-04-03
**Context:** No database dependency at this stage, as specified in the contract.
**Decision:** Signature records are stored in a `Map` in the controller module.

---

## ADR-023 — Webhook token validation first (US-7)
**Date:** 2026-04-03
**Context:** Security requirement for the signature webhook endpoint.
**Decision:** The webhook handler validates `X-Webhook-Token` before touching any state. No data is written if the token is missing or invalid.

---

## ADR-024 — Asynchronous side effects via setImmediate (US-7)
**Date:** 2026-04-03
**Context:** Email dispatch and S3 upload should not block the HTTP response.
**Decision:** Email dispatch and S3 upload run via `setImmediate` (fire-and-forget). Failures are logged but do not affect the caller. Credentials (`SIGNATURE_API_KEY`, `SIGNATURE_API_URL`, `WEBHOOK_SECRET_TOKEN`, `AWS_S3_BUCKET`) are always read from `process.env`.

---

## ADR-025 — Merge conflict resolution for KAN-5, KAN-6, KAN-7 (US-20)
**Date:** 2026-04-03
**Context:** Three PRs (KAN-5, KAN-6, KAN-7) were merged into main using "accept both changes" for all conflicts, resulting in concatenated duplicate code in `backend/src/routes/index.js`, `backend/src/index.js`, `backend/src/app.js`, `backend/package.json`, `docs/DECISIONS.md`, and `docs/API.md`.
**Decision:** Each broken file was manually inspected and rewritten as a single clean version preserving all functionality from all merged branches. Duplicate ADRs were renumbered sequentially (ADR-001 through ADR-024) to avoid collisions. The `package.json` dependencies were unioned across all four versions.
**Rationale:** Restores a consistent, functional codebase state. All routes from all USs (auth/org/invites from US-3, contracts pipeline from US-5, documents from US-6, signatures from US-7) are registered in a single `routes/index.js`.
