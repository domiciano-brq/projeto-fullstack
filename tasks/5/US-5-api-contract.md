# API Contract — US-5

## Agentes necessarios
- backend: sim
- frontend: sim

## Endpoints

### POST /api/contracts/analyze
- **Descricao:** Recebe o arquivo do contrato, valida o input e enfileira o processamento assincrono via BullMQ. Retorna imediatamente um `analysisId` para consulta posterior de status. Antes de enfileirar, verifica cache Redis por hash do arquivo; se resultado ja existir, retorna `cached: true` junto com o resultado completo sem enfileirar novamente.
- **Body:** `multipart/form-data` com campo `file` (PDF, DOCX ou TXT; maximo 50 MB)
- **Resposta 202:**
  ```json
  {
    "analysisId": "uuid-v4",
    "status": "queued",
    "cached": false
  }
  ```
  Quando resultado em cache:
  ```json
  {
    "analysisId": "uuid-v4",
    "status": "completed",
    "cached": true,
    "result": { "<ver schema em GET /api/contracts/analyze/:analysisId>" }
  }
  ```
- **Resposta 400:**
  ```json
  { "error": "Tipo de arquivo invalido. Envie PDF, DOCX ou TXT." }
  ```
  ```json
  { "error": "Arquivo excede o limite de 50 MB." }
  ```
- **Resposta 422:**
  ```json
  { "error": "Nenhum arquivo enviado." }
  ```

---

### GET /api/contracts/analyze/:analysisId
- **Descricao:** Consulta o status e, quando disponivel, o resultado completo da analise (clausulas de risco, resumo executivo e confirmacao de que embeddings foram salvos).
- **Body:** N/A
- **Resposta 200 — em andamento:**
  ```json
  {
    "analysisId": "uuid-v4",
    "status": "queued" | "processing",
    "progress": 0-100
  }
  ```
- **Resposta 200 — concluido:**
  ```json
  {
    "analysisId": "uuid-v4",
    "status": "completed",
    "cached": false,
    "result": {
      "summary": "Resumo executivo em linguagem clara.",
      "clauses": [
        {
          "clauseIndex": 1,
          "text": "Trecho da clausula extraido do contrato.",
          "riskLevel": "alto" | "medio" | "baixo",
          "explanation": "Explicacao clara e acionavel do risco identificado."
        }
      ],
      "embeddingsSaved": true,
      "processedAt": "2026-04-03T10:00:00Z"
    }
  }
  ```
- **Resposta 200 — erro de processamento:**
  ```json
  {
    "analysisId": "uuid-v4",
    "status": "failed",
    "error": "Descricao do erro ocorrido durante a analise."
  }
  ```
- **Resposta 404:**
  ```json
  { "error": "Analise nao encontrada." }
  ```

---

### GET /api/contracts/search
- **Descricao:** Realiza busca semantica por similaridade usando embeddings pgvector. Retorna contratos ordenados por similaridade decrescente. Deve responder em menos de 2 segundos mesmo com 10 000+ contratos indexados.
- **Body:** N/A
- **Query params:**
  - `q` (string, obrigatorio): texto livre para busca semantica (ex: "clausula de confidencialidade")
  - `limit` (number, opcional, default 10, max 50): quantidade maxima de resultados
- **Resposta 200:**
  ```json
  {
    "query": "clausula de confidencialidade",
    "results": [
      {
        "analysisId": "uuid-v4",
        "fileName": "contrato-empresa-xpto.pdf",
        "similarity": 0.92,
        "summary": "Resumo executivo do contrato.",
        "analyzedAt": "2026-04-03T10:00:00Z"
      }
    ],
    "total": 3
  }
  ```
- **Resposta 400:**
  ```json
  { "error": "Parametro 'q' e obrigatorio." }
  ```

---

## Dados em memoria

### Cache Redis
- **Chave:** `analysis:cache:<sha256-do-arquivo>`
- **Valor:** objeto JSON com o resultado completo da analise (mesmo schema de `result` acima)
- **TTL:** sem expiracao automatica (invalidado manualmente se o contrato for atualizado)

### Fila BullMQ (Redis)
- **Nome da fila:** `contract-analysis`
- **Payload do job:**
  ```json
  {
    "analysisId": "uuid-v4",
    "filePath": "/tmp/uploads/<uuid>.pdf",
    "fileHash": "sha256-hex",
    "mimeType": "application/pdf"
  }
  ```
- **Status possiveis do job:** `queued`, `processing`, `completed`, `failed`

### Armazenamento de status (Redis)
- **Chave:** `analysis:status:<analysisId>`
- **Valor:**
  ```json
  {
    "status": "queued" | "processing" | "completed" | "failed",
    "progress": 0-100,
    "result": null | { "<objeto result completo>" },
    "error": null | "mensagem de erro"
  }
  ```

### Embeddings (PostgreSQL + pgvector)
- Tabela `contract_embeddings`:
  - `analysis_id` (uuid, PK)
  - `file_name` (text)
  - `summary` (text)
  - `embedding` (vector — dimensao conforme modelo OpenAI text-embedding-3-small: 1536)
  - `analyzed_at` (timestamptz)

---

## Observacoes

1. **Validacao de input nas bordas:** tipos MIME aceitos — `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`. Limite de 50 MB aplicado antes de qualquer processamento.
2. **Deduplicacao por hash:** o hash SHA-256 do conteudo binario do arquivo e calculado na borda do endpoint POST antes de enfileirar. Se cache existir, retorna 202 com `cached: true` e o resultado imediatamente.
3. **Assincronia:** o endpoint POST retorna em menos de 1 segundo; o worker BullMQ e responsavel por chamar o LangChain/GPT-4o e salvar embeddings. A meta de 10 segundos fim-a-fim conta a partir do envio ate o status `completed` na consulta de status.
4. **Modelo de IA:** OpenAI GPT-4o via LangChain para analise de clausulas e geracao de resumo; `text-embedding-3-small` para geracao de embeddings.
5. **Busca semantica:** endpoint GET /api/contracts/search converte o parametro `q` em embedding via OpenAI e executa consulta de cosine similarity no pgvector.
6. **Sem interface de administracao de prompts** nesta versao (fora do escopo da sprint).
7. **Idiomas suportados:** PT-BR e EN apenas nesta versao.
8. **Logs:** log basico de cada analise (inicio, conclusao, erro) e suficiente — auditoria completa esta fora do escopo.
