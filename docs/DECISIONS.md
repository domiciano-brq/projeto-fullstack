# Architectural Decisions

---

## 2026-04-03 — US-5: Contract Analysis Pipeline with AI

### Context
The platform needs to analyse legal contracts automatically, identifying risky clauses and generating executive summaries. Requirements include: asynchronous processing, deduplication via caching, semantic search across analysed contracts, and a response time goal of under 10 seconds end-to-end.

### Decisions

#### 1. Asynchronous processing with BullMQ
**Decision:** Use BullMQ (built on Redis) to enqueue analysis jobs. The POST endpoint returns immediately (< 1 s) with an `analysisId`; the client polls the GET endpoint until status is `completed` or `failed`.
**Rationale:** Decouples the HTTP request from the potentially slow GPT-4o call. Satisfies the < 1 s POST response requirement and enables retry logic on failure. BullMQ is battle-tested, Redis-based, and integrates well with Node.js.

#### 2. Redis for status tracking and caching
**Decision:** Two key namespaces in Redis:
- `analysis:cache:<sha256>` — stores the complete result keyed by file hash (no TTL, manual invalidation).
- `analysis:status:<analysisId>` — stores the current processing state and progress.
**Rationale:** SHA-256 of the binary file content is a reliable deduplication key. Redis provides sub-millisecond reads for both cache hits and status polls.

#### 3. PostgreSQL + pgvector for semantic search
**Decision:** Store 1536-dimensional embeddings (OpenAI `text-embedding-3-small`) in a `contract_embeddings` table using the pgvector extension. Use IVFFlat index for approximate nearest-neighbour search.
**Rationale:** pgvector integrates directly with existing PostgreSQL infrastructure. IVFFlat with 100 lists supports < 2 s query time at 10 000+ records. The 1536-dim `text-embedding-3-small` model provides good accuracy at lower cost than `text-embedding-ada-002`.

#### 4. OpenAI GPT-4o via LangChain for clause analysis
**Decision:** Use GPT-4o through `@langchain/openai` with a structured system prompt that forces JSON output containing `summary` and `clauses[]` with `riskLevel` and `explanation`.
**Rationale:** GPT-4o has strong legal text comprehension in PT-BR and EN. LangChain provides a clean abstraction and simplifies future model swaps. Forcing JSON in the system prompt avoids additional parsing complexity.

#### 5. Multer for file upload with early validation
**Decision:** Validate MIME type and file size at the multer layer before any processing occurs. Accepted types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`.
**Rationale:** Failing fast at the boundary minimises wasted compute. Multer's `fileFilter` and `limits` hooks provide clean, early rejection with appropriate HTTP status codes (400, 422).

#### 6. Worker co-located with the API process (development default)
**Decision:** The BullMQ worker is started within the same Node.js process as the Express app by default.
**Rationale:** Keeps the setup simple for the current sprint. The worker can be extracted to a separate process or container in a future iteration without API changes (the queue interface stays the same).
