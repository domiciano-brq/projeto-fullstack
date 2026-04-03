# Backend — US-5

## Endpoints implementados

### POST /api/contracts/analyze
- **Content-Type:** `multipart/form-data`
- **Body:** campo `file` (PDF ou texto, max 10MB)
- **Resposta 202 (job criado):** `{ "jobId": "uuid", "status": "pending", "contractHash": "sha256hex", "cachedResult": false }`
- **Resposta 202 (cache hit):** `{ "jobId": null, "status": "completed", "contractHash": "sha256hex", "cachedResult": true, "result": { "summary": "...", "clauses": [...] } }`
- **Resposta 400:** `{ "error": "Arquivo ausente ou formato invalido" }` — sem arquivo ou MIME type invalido
- **Resposta 413:** `{ "error": "Arquivo excede o limite de 10MB" }` — arquivo maior que 10MB
- **Resposta 500:** `{ "error": "Erro interno ao enfileirar analise" }`

### GET /api/contracts/jobs/:jobId
- **Body:** N/A
- **Resposta 200 (pendente/ativo):** `{ "jobId": "uuid", "status": "pending | active | failed" }`
- **Resposta 200 (concluido):** `{ "jobId": "uuid", "status": "completed", "result": { "summary": "...", "clauses": [{ "text": "...", "riskLevel": "alto|medio|baixo", "reason": "..." }] } }`
- **Resposta 404:** `{ "error": "Job nao encontrado" }`
- **Resposta 500:** `{ "error": "Erro ao consultar status do job" }`

### GET /api/contracts/search
- **Body:** N/A
- **Query params:** `q` (string, obrigatorio), `limit` (integer, opcional, default 10, max 50)
- **Resposta 200:** `{ "results": [{ "contractId": "uuid", "similarityScore": 0.95, "summary": "...", "fileName": "..." }] }`
- **Resposta 400:** `{ "error": "Parametro 'q' e obrigatorio" }`
- **Resposta 500:** `{ "error": "Erro ao realizar busca semantica" }`

## Arquivos criados/modificados

- `backend/package.json` — dependencias do projeto (express, multer, uuid, bullmq, ioredis, langchain, @langchain/openai, pg, pgvector, pdf-parse)
- `backend/.env.example` — variaveis de ambiente necessarias (PORT, OPENAI_API_KEY, REDIS_URL, DATABASE_URL)
- `backend/src/index.js` — entry point Express com middleware e handler de erros global
- `backend/src/routes/index.js` — registro de rotas com multer para upload de arquivos
- `backend/src/controllers/contracts.controller.js` — controller principal com os 3 endpoints
- `backend/src/services/inMemoryStore.js` — stores em memoria simulando Redis, BullMQ e pgvector
- `backend/src/services/aiAnalysis.js` — servico de analise via GPT-4o/LangChain com modo simulado
- `backend/src/workers/contractAnalysis.worker.js` — worker assincrono que processa jobs
- `docs/API.md` — documentacao completa dos endpoints
- `docs/DECISIONS.md` — decisoes arquiteturais com data e racional

## Observacoes

### Para QA

**Teste de fluxo completo:**
1. `POST /api/contracts/analyze` com arquivo de texto — retorna `jobId` e `status: "pending"`
2. `GET /api/contracts/jobs/<jobId>` — retorna `status: "active"` ou `status: "completed"` (processamento assincrono via setImmediate)
3. Apos status `completed`, `result` contem `summary` e array `clauses` com campos `text`, `riskLevel` e `reason`

**Teste de cache:**
- Enviar o mesmo arquivo duas vezes: segunda requisicao retorna `cachedResult: true` e `result` imediatamente sem criar novo job

**Teste de validacao:**
- Arquivo maior que 10MB retorna HTTP 413
- Request sem campo `file` retorna HTTP 400
- `GET /api/contracts/search` sem `q` retorna HTTP 400

**Teste de busca semantica:**
- Apos analisar ao menos um contrato (job concluido), `GET /api/contracts/search?q=<termo>` retorna resultados com `similarityScore`

### Modo de operacao

**Sem OPENAI_API_KEY:** Backend opera em modo simulado com respostas deterministicas — adequado para desenvolvimento e testes de integracao.

**Com OPENAI_API_KEY:** Backend usa GPT-4o via LangChain para analise real e text-embedding-ada-002 para embeddings.

### Dependencias externas (producao)
- **Redis:** Para cache real, configurar `REDIS_URL` e substituir `inMemoryStore.cache` por cliente ioredis
- **BullMQ:** Para fila real, substituir `setImmediate` no worker por `Queue` e `Worker` do BullMQ
- **PostgreSQL + pgvector:** Para embeddings persistentes, configurar `DATABASE_URL` e usar tabela `contract_embeddings` com coluna `vector(1536)`
