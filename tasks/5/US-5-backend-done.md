# Backend — US-5

## Endpoints implementados

### POST /api/contracts/analyze
- **Body:** `multipart/form-data` com campo `file` (PDF, DOCX ou TXT; maximo 50 MB)
- **Resposta 202 (novo):** `{ "analysisId": "uuid-v4", "status": "queued", "cached": false }`
- **Resposta 202 (cache):** `{ "analysisId": "uuid-v4", "status": "completed", "cached": true, "result": { ... } }`
- **Resposta 400:** tipo invalido ou arquivo muito grande
- **Resposta 422:** nenhum arquivo enviado

### GET /api/contracts/analyze/:analysisId
- **Resposta 200 (em andamento):** `{ "analysisId": "uuid-v4", "status": "queued" | "processing", "progress": 0-100 }`
- **Resposta 200 (concluido):** `{ "analysisId": "uuid-v4", "status": "completed", "cached": false, "result": { "summary": "...", "clauses": [...], "embeddingsSaved": true, "processedAt": "..." } }`
- **Resposta 200 (falha):** `{ "analysisId": "uuid-v4", "status": "failed", "error": "..." }`
- **Resposta 404:** `{ "error": "Analise nao encontrada." }`

### GET /api/contracts/search
- **Query params:** `q` (obrigatorio), `limit` (opcional, default 10, max 50)
- **Resposta 200:** `{ "query": "...", "results": [ { "analysisId": "uuid", "fileName": "...", "similarity": 0.92, "summary": "...", "analyzedAt": "..." } ], "total": N }`
- **Resposta 400:** `{ "error": "Parametro 'q' e obrigatorio." }`

## Arquivos criados/modificados

- `backend/package.json` — dependencias do projeto (express, multer, bullmq, ioredis, @langchain/openai, pg, uuid)
- `backend/.env.example` — variaveis de ambiente necessarias
- `backend/src/app.js` — entry point Express + inicializacao do worker BullMQ
- `backend/src/routes/index.js` — registro das 3 rotas sob prefixo `/api`
- `backend/src/controllers/contracts.controller.js` — logica dos 3 endpoints
- `backend/src/services/redis.js` — cliente Redis + helpers de cache e status
- `backend/src/services/queue.js` — fila BullMQ `contract-analysis`
- `backend/src/services/db.js` — pool PostgreSQL + pgvector (ensureSchema, saveEmbedding, semanticSearch)
- `backend/src/workers/analysisWorker.js` — worker BullMQ: extrai texto, chama GPT-4o, gera embedding, salva pgvector, atualiza Redis
- `docs/API.md` — documentacao completa dos endpoints com exemplos
- `docs/DECISIONS.md` — decisoes arquiteturais com data e racional

## Observacoes

### Para o Frontend
- O endpoint POST retorna 202 imediatamente. O frontend deve usar o `analysisId` retornado para fazer polling no GET até `status === "completed"` ou `"failed"`.
- O campo `progress` (0-100) no GET pode ser usado para exibir barra de progresso.
- Quando `cached: true` no POST, o resultado completo ja esta disponivel na resposta — nao e necessario fazer polling.

### Para QA
- Dependencias externas necessarias para testes de integracao: Redis (porta 6379), PostgreSQL com extensao pgvector (porta 5432), e variavel de ambiente `OPENAI_API_KEY` valida.
- Para testes unitarios dos endpoints sem IA: mockar `@langchain/openai` e verificar apenas a logica de validacao, cache e enfileiramento.
- Tipos MIME aceitos: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`.
- O hash SHA-256 do conteudo binario do arquivo e a chave de deduplicacao. Dois arquivos identicos (mesmo conteudo, nomes diferentes) serao tratados como duplicatas.
- Extracao de texto de PDF requer `pdf-parse` e de DOCX requer `mammoth` instalados como dependencias opcionais.

### Variaveis de Ambiente Necessarias
- `OPENAI_API_KEY` — chave da API OpenAI (obrigatoria para analise e busca semantica)
- `REDIS_URL` — URL do Redis (default: `redis://localhost:6379`)
- `DATABASE_URL` — connection string PostgreSQL com pgvector (default: `postgresql://postgres:postgres@localhost:5432/contracts`)
- `PORT` — porta do servidor Express (default: `3001`)
