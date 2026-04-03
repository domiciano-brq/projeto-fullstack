# API Contract — US-5

## Agentes necessarios
- backend: sim
- frontend: nao

## Endpoints

### POST /api/contracts/analyze
- **Descricao:** Envia um contrato para analise assíncrona via IA. Valida o arquivo (max 10MB), calcula o hash SHA-256 do conteudo, verifica cache Redis e, se nao houver resultado cacheado, enfileira um job no BullMQ. Retorna um job ID para rastreamento.
- **Body:** `multipart/form-data` com campo `file` (PDF ou texto, max 10MB)
- **Resposta 202:**
  ```json
  {
    "jobId": "string (uuid)",
    "status": "pending",
    "contractHash": "string (sha256 hex)",
    "cachedResult": false
  }
  ```
- **Resposta 202 (cache hit):**
  ```json
  {
    "jobId": null,
    "status": "completed",
    "contractHash": "string (sha256 hex)",
    "cachedResult": true,
    "result": {
      "summary": "string",
      "clauses": [
        {
          "text": "string",
          "riskLevel": "alto | medio | baixo",
          "reason": "string"
        }
      ]
    }
  }
  ```
- **Resposta 400:** `{ "error": "Arquivo ausente ou formato invalido" }`
- **Resposta 413:** `{ "error": "Arquivo excede o limite de 10MB" }`
- **Resposta 500:** `{ "error": "Erro interno ao enfileirar analise" }`

---

### GET /api/contracts/jobs/:jobId
- **Descricao:** Consulta o status e o resultado de um job de analise previamente criado. Quando o job esta concluido, retorna o resultado completo da analise com clausulas e resumo.
- **Body:** N/A
- **Resposta 200 (pendente/processando):**
  ```json
  {
    "jobId": "string",
    "status": "pending | active | failed"
  }
  ```
- **Resposta 200 (concluido):**
  ```json
  {
    "jobId": "string",
    "status": "completed",
    "result": {
      "summary": "string",
      "clauses": [
        {
          "text": "string",
          "riskLevel": "alto | medio | baixo",
          "reason": "string"
        }
      ]
    }
  }
  ```
- **Resposta 404:** `{ "error": "Job nao encontrado" }`
- **Resposta 500:** `{ "error": "Erro ao consultar status do job" }`

---

### GET /api/contracts/search
- **Descricao:** Busca contratos semanticamente similares a uma query de texto usando embeddings pgvector. Retorna contratos ordenados por similaridade (maior para menor).
- **Body:** N/A
- **Query params:**
  - `q` (string, obrigatorio): texto de busca
  - `limit` (integer, opcional, default 10, max 50): numero maximo de resultados
- **Resposta 200:**
  ```json
  {
    "results": [
      {
        "contractId": "string",
        "similarityScore": 0.95,
        "summary": "string",
        "fileName": "string"
      }
    ]
  }
  ```
- **Resposta 400:** `{ "error": "Parametro 'q' e obrigatorio" }`
- **Resposta 500:** `{ "error": "Erro ao realizar busca semantica" }`

---

## Dados em memoria

### Redis — Cache de resultados
- Chave: `contract:analysis:<sha256-hex>`
- Valor: JSON serializado do objeto `result` (summary + clauses)
- TTL: sem expiracao definida (resultados sao determinísticos para o mesmo contrato)

### BullMQ — Fila de analise
- Nome da fila: `contract-analysis`
- Payload do job:
  ```json
  {
    "jobId": "string (uuid)",
    "contractHash": "string",
    "contractText": "string (conteudo extraido do arquivo)"
  }
  ```
- Politica de retry: 3 tentativas com backoff exponencial para tratar timeouts do GPT-4o

### pgvector — Embeddings para busca semantica
Tabela `contract_embeddings`:
```
contractId   uuid        PK
fileName     text
summary      text
embedding    vector(1536)  -- dimensao do modelo text-embedding-ada-002
createdAt    timestamp
```

### Estrutura do resultado de analise
```json
{
  "summary": "string",
  "clauses": [
    {
      "text": "string",
      "riskLevel": "alto | medio | baixo",
      "reason": "string"
    }
  ]
}
```

## Observacoes
- A historia e exclusivamente de backend; nao ha interface de usuario nesta sprint (fora do escopo).
- O hash SHA-256 do conteudo do arquivo e a chave de cache no Redis, garantindo que contratos identicos nao sejam reprocessados.
- O endpoint POST retorna 202 (Accepted) e nao 201, pois o processamento e assíncrono e o resultado nao esta pronto no momento da requisicao.
- O endpoint GET /jobs/:jobId e o mecanismo de polling para o frontend (quando existir) ou integracao backend-to-backend verificar a conclusao.
- Embeddings sao gerados com `text-embedding-ada-002` da OpenAI (1536 dimensoes), armazenados via pgvector. Busca usa distancia por cosseno.
- Conteudo sensivel do contrato nao deve aparecer em logs — apenas o hash e o jobId podem ser logados.
- Validacao de tamanho (10MB) deve ocorrer antes de qualquer processamento ou leitura do conteudo.
