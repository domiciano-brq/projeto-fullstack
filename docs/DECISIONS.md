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
