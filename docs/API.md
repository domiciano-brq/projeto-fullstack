# API Reference

Base URL: `http://localhost:3000`

---

## Health Check

### GET /health
Verifica se o servidor esta em operacao.

**Resposta 200:**
```json
{ "status": "ok", "timestamp": "2026-04-03T00:00:00.000Z" }
```

---

## Contratos — Pipeline de Analise com IA

### POST /api/contracts/analyze

Envia um contrato para analise assincrona via IA. Valida o arquivo (max 10MB), calcula o hash SHA-256 do conteudo, verifica cache Redis e, se nao houver resultado cacheado, enfileira um job no BullMQ. Retorna um job ID para rastreamento.

**Content-Type:** `multipart/form-data`

**Campos do form:**
| Campo | Tipo   | Obrigatorio | Descricao                        |
|-------|--------|-------------|----------------------------------|
| file  | File   | Sim         | Arquivo PDF ou texto (max 10MB)  |

**Resposta 202 — Job criado (processamento pendente):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "contractHash": "a3f5c2d1e9b7...",
  "cachedResult": false
}
```

**Resposta 202 — Cache hit (resultado ja disponivel):**
```json
{
  "jobId": null,
  "status": "completed",
  "contractHash": "a3f5c2d1e9b7...",
  "cachedResult": true,
  "result": {
    "summary": "Resumo executivo do contrato...",
    "clauses": [
      {
        "text": "Texto da clausula identificada",
        "riskLevel": "alto",
        "reason": "Explicacao do nivel de risco"
      }
    ]
  }
}
```

**Resposta 400:** `{ "error": "Arquivo ausente ou formato invalido" }`
**Resposta 413:** `{ "error": "Arquivo excede o limite de 10MB" }`
**Resposta 500:** `{ "error": "Erro interno ao enfileirar analise" }`

---

### GET /api/contracts/jobs/:jobId

Consulta o status e o resultado de um job de analise previamente criado. Mecanismo de polling para verificar a conclusao do processamento assincrono.

**Parametros de rota:**
| Parametro | Tipo   | Descricao              |
|-----------|--------|------------------------|
| jobId     | string | UUID do job de analise |

**Resposta 200 — Job pendente ou em processamento:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}
```

Status possiveis: `pending`, `active`, `failed`

**Resposta 200 — Job concluido:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "result": {
    "summary": "Resumo executivo do contrato...",
    "clauses": [
      {
        "text": "Texto da clausula identificada",
        "riskLevel": "alto | medio | baixo",
        "reason": "Explicacao do nivel de risco"
      }
    ]
  }
}
```

**Resposta 404:** `{ "error": "Job nao encontrado" }`
**Resposta 500:** `{ "error": "Erro ao consultar status do job" }`

---

### GET /api/contracts/search

Busca contratos semanticamente similares a uma query de texto usando embeddings (text-embedding-ada-002 / pgvector). Retorna contratos ordenados por similaridade (maior para menor).

**Query Parameters:**
| Parametro | Tipo    | Obrigatorio | Default | Maximo | Descricao                        |
|-----------|---------|-------------|---------|--------|----------------------------------|
| q         | string  | Sim         | —       | —      | Texto de busca                   |
| limit     | integer | Nao         | 10      | 50     | Numero maximo de resultados      |

**Exemplo de request:**
```
GET /api/contracts/search?q=clausula+de+rescisao+unilateral&limit=5
```

**Resposta 200:**
```json
{
  "results": [
    {
      "contractId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "similarityScore": 0.9523,
      "summary": "Contrato de prestacao de servicos com clausulas de rescisao...",
      "fileName": "contrato-servicos-2024.pdf"
    }
  ]
}
```

**Resposta 400:** `{ "error": "Parametro 'q' e obrigatorio" }`
**Resposta 500:** `{ "error": "Erro ao realizar busca semantica" }`

---

## Fluxo de uso tipico

1. **Upload e analise:** `POST /api/contracts/analyze` → recebe `jobId`
2. **Polling de status:** `GET /api/contracts/jobs/:jobId` ate `status === "completed"`
3. **Busca semantica:** `GET /api/contracts/search?q=<termo>` para encontrar contratos similares

---

## Niveis de risco das clausulas

| Nivel | Descricao                                                              |
|-------|------------------------------------------------------------------------|
| alto  | Clausulas abusivas, desequilibrio contratual grave, violacao de direitos |
| medio | Clausulas que merecem atencao e possivel renegociacao                  |
| baixo | Clausulas comuns de mercado com pontos menores a observar              |
