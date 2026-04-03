# Architecture Decision Records

---

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
