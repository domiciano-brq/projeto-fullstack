# Backend — US-20

## Resumo

Nenhum endpoint novo foi criado. Esta historia e exclusivamente corretiva. Todos os arquivos com codigo duplicado (resultado de merges com "accept both changes") foram inspecionados e reescritos como versoes unicas e funcionais.

## Arquivos criados/modificados

### backend/src/routes/index.js
- **Problema:** 4 implementacoes de registro de rotas concatenadas; o arquivo continha multiplas declaracoes `const router` e `module.exports` repetidas, tornando o modulo invalido.
- **Correcao:** Reescrito como um unico arquivo que registra TODAS as rotas de todos os PRs:
  - US-3: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/google`, `GET /api/auth/google/callback`, `GET /api/me`, `POST /api/organizations`, `PATCH /api/organizations/:id`, `DELETE /api/organizations/:id`, `GET /api/organizations/:id/members`, `POST /api/organizations/:id/invites`, `POST /api/invites/:token/accept`
  - US-5: `POST /api/contracts/analyze`, `GET /api/contracts/jobs/:jobId`, `GET /api/contracts/search`
  - US-6: `POST /api/documents/upload`, `GET /api/documents/:id`, `GET /api/documents/:id/content`, `GET /api/documents/:id/versions`, `GET /api/documents/:id/versions/:versionId`, `GET /api/documents/:id/audit`
  - US-7: `POST /api/contracts/:id/signature-request`, `GET /api/contracts/:id/signature-status`, `DELETE /api/contracts/:id/signature-request`, `POST /api/webhooks/signature`

### backend/src/index.js
- **Problema:** 2 entry points concatenados; segundo `app.use(express.json())` e segundo `app.listen()` causariam erros de runtime.
- **Correcao:** Versao unica combinando health check, body parsers (JSON + urlencoded), prefixo `/api`, handler 404, handler de erros global com tratamento de `LIMIT_FILE_SIZE`, e warning de `OPENAI_API_KEY`.

### backend/src/app.js
- **Problema:** 2 configuracoes de app Express concatenadas com `const PORT` e `app.use('/api', routes)` duplicados.
- **Correcao:** Versao unica com `require.main === module` guard para o `app.listen`, saude `/health`, handlers 404 e erro global, e `module.exports = app`.

### backend/package.json
- **Problema:** JSON invalido — 4 objetos JSON concatenados com campos `name`, `dependencies`, `devDependencies` repetidos.
- **Correcao:** Um unico JSON valido com a uniao de todas as dependencias:
  - `@langchain/openai`, `bcrypt`, `bullmq`, `express`, `file-type`, `ioredis`, `jsonwebtoken`, `langchain`, `multer`, `pdf-parse`, `pg`, `pgvector`, `uuid`
  - Scripts: `start`, `dev`, `worker`
  - `engines.node >= 18.0.0`

### docs/DECISIONS.md
- **Problema:** ADR-001 aparecia 3 vezes (versoes de US-7, US-6 e US-3) e os numeros de ADR colidiam entre PRs.
- **Correcao:** Todos os ADRs renumerados sequencialmente (ADR-001 a ADR-025) sem colisao. Adicionado ADR-025 documentando esta correcao de merge (2026-04-03).

### docs/API.md
- **Problema:** 4 secoes de documentacao concatenadas com headers de base URL repetidos e secoes duplicadas/sobrepostas.
- **Correcao:** Documento unico e limpo organizado por US (US-3, US-5, US-6, US-7) com health check no topo.

## Observacoes para frontend e QA

- Todos os endpoints existentes permanecem com os mesmos paths, metodos HTTP, request bodies e response shapes definidos nos contratos originais.
- O `multer` para `/api/contracts/analyze` e o `multerUploadMiddleware` para `/api/documents/upload` sao instancias separadas (correto — cada endpoint tem requisitos distintos de campo/validacao).
- A rota `/api/contracts/analyze` (US-5) usa `upload.single('file')` enquanto `/api/contracts/:id/signature-request` (US-7) usa o `id` do contrato como parametro de rota — nao ha conflito pois `analyze` e uma rota estatica e `:id/signature-request` e dinamica; o Express resolve corretamente na ordem de registro (rotas estaticas primeiro).
- O entry point canonico do servidor e `src/index.js` (referenciado no `package.json`).
