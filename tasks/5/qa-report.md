# QA Report — US-5

## Code Review

| Critério | Arquivo | Status |
|----------|---------|--------|
| POST /api/contracts/analyze implementado | `backend/src/controllers/contracts.controller.js` | ✅ OK |
| GET /api/contracts/jobs/:jobId implementado | `backend/src/controllers/contracts.controller.js` | ✅ OK |
| GET /api/contracts/search implementado | `backend/src/controllers/contracts.controller.js` | ✅ OK |
| Rotas registradas com prefixo /api | `backend/src/routes/index.js` + `backend/src/index.js` | ✅ OK |
| Upload via multipart/form-data (campo 'file') | `backend/src/routes/index.js` (multer) | ✅ OK |
| Validação de tamanho antes do processamento (max 10MB) | `backend/src/controllers/contracts.controller.js` linha 46 | ✅ OK |
| Validação de MIME type (PDF ou texto) | `backend/src/controllers/contracts.controller.js` linha 40-43 | ✅ OK |
| Resposta 202 com jobId e status pending | `backend/src/controllers/contracts.controller.js` linha 79-84 | ✅ OK |
| Resposta 202 com cachedResult: true no cache hit | `backend/src/controllers/contracts.controller.js` linha 63-69 | ✅ OK |
| Hash SHA-256 calculado do conteúdo do arquivo | `backend/src/controllers/contracts.controller.js` linha 54-57 | ✅ OK |
| Cache Redis com chave contract:analysis:<sha256> | `backend/src/services/inMemoryStore.js` linha 20+26 | ✅ OK |
| Processamento assíncrono via setImmediate (BullMQ simulado) | `backend/src/workers/contractAnalysis.worker.js` linha 28 | ✅ OK |
| Resultado contém lista de cláusulas com riskLevel (alto/médio/baixo) | `backend/src/services/aiAnalysis.js` linha 147-151 | ✅ OK |
| Cada cláusula tem text, riskLevel e reason | `backend/src/services/aiAnalysis.js` linha 147-151 | ✅ OK |
| Resumo executivo (summary) gerado automaticamente | `backend/src/services/aiAnalysis.js` linha 77-78 | ✅ OK |
| Retry automático com backoff exponencial (3 tentativas) | `backend/src/services/aiAnalysis.js` linha 34-52 | ✅ OK |
| Busca semântica com embeddings e similaridade de cosseno | `backend/src/services/inMemoryStore.js` linha 89-108 | ✅ OK |
| Resultados de busca ordenados por similaridade decrescente | `backend/src/services/inMemoryStore.js` linha 104-106 | ✅ OK |
| Parâmetro q obrigatório na busca semântica | `backend/src/controllers/contracts.controller.js` linha 144 | ✅ OK |
| Limite máximo de 50 resultados na busca | `backend/src/controllers/contracts.controller.js` linha 153-155 | ✅ OK |
| GET /jobs/:jobId retorna 404 quando job não encontrado | `backend/src/controllers/contracts.controller.js` linha 102-104 | ✅ OK |
| Conteúdo sensível não logado (apenas jobId e hash) | `backend/src/controllers/contracts.controller.js` + `backend/src/workers/contractAnalysis.worker.js` | ✅ OK |
| Suporte a GPT-4o via LangChain quando OPENAI_API_KEY disponível | `backend/src/services/aiAnalysis.js` linha 58-69 | ✅ OK |
| Embeddings com text-embedding-ada-002 (1536 dimensões) | `backend/src/services/aiAnalysis.js` linha 168-173 | ✅ OK |
| Embedding armazenado após conclusão do job | `backend/src/workers/contractAnalysis.worker.js` linha 44-48 | ✅ OK |
| Cache salvo após conclusão do processamento | `backend/src/workers/contractAnalysis.worker.js` linha 42 | ✅ OK |
| Handler global para erro LIMIT_FILE_SIZE do multer (413) | `backend/src/index.js` linha 32-34 | ✅ OK |
| Resposta da busca no formato {results: [...]} | `backend/src/controllers/contracts.controller.js` linha 163 | ✅ OK |

## Bugs encontrados

Nenhum bug crítico encontrado.

Observações não bloqueantes:
- A extração de texto de PDFs em modo simulado usa `buffer.toString('utf-8')` sem `pdf-parse`, o que pode resultar em texto ilegível para PDFs reais. O código documenta isso como limitação do modo de desenvolvimento — aceitável para esta sprint.
- Os stores em memória (Redis, BullMQ, pgvector) não persistem entre reinicializações do servidor, o que é esperado para o modo de desenvolvimento declarado no `US-5-backend-done.md`.
- O multer é configurado com limite de `10MB + 1 byte` para permitir que o controller trate o erro com a mensagem correta. O handler global no `index.js` também captura o erro `LIMIT_FILE_SIZE`, criando uma dupla proteção coerente com o contrato.

## Conclusão

APROVADO

Todos os três endpoints do contrato de API foram implementados corretamente:
- `POST /api/contracts/analyze` com validação de formato, hash SHA-256, cache Redis e enfileiramento assíncrono
- `GET /api/contracts/jobs/:jobId` com rastreamento de status e retorno do resultado estruturado
- `GET /api/contracts/search` com busca semântica por similaridade de cosseno e parâmetros q/limit

Todos os critérios de aceitação estão atendidos no código: processamento assíncrono rastreável, cláusulas com nível de risco (alto/médio/baixo), texto e motivo por cláusula, resumo executivo, cache Redis para evitar reprocessamento, retry com backoff exponencial e busca semântica ordenada por relevância. A implementação opera em modo simulado (sem dependências externas) e em modo real (com OPENAI_API_KEY), tornando-a adequada para desenvolvimento e produção.
