# API Documentation

## Base URL

```
http://localhost:3001/api
```

---

## Contract Analysis

### POST /api/contracts/analyze

Upload a contract file for asynchronous AI analysis.

**Content-Type:** `multipart/form-data`

**Form field:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file  | File | Yes      | Contract file. Accepted types: PDF, DOCX, TXT. Max size: 50 MB. |

**Response 202 — queued (new analysis):**
```json
{
  "analysisId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "cached": false
}
```

**Response 202 — cached (same file previously analysed):**
```json
{
  "analysisId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "cached": true,
  "result": {
    "summary": "Resumo executivo do contrato.",
    "clauses": [
      {
        "clauseIndex": 1,
        "text": "Trecho da clausula.",
        "riskLevel": "alto",
        "explanation": "Explicacao do risco."
      }
    ],
    "embeddingsSaved": true,
    "processedAt": "2026-04-03T10:00:00Z"
  }
}
```

**Response 400 — invalid type:**
```json
{ "error": "Tipo de arquivo invalido. Envie PDF, DOCX ou TXT." }
```

**Response 400 — file too large:**
```json
{ "error": "Arquivo excede o limite de 50 MB." }
```

**Response 422 — no file:**
```json
{ "error": "Nenhum arquivo enviado." }
```

---

### GET /api/contracts/analyze/:analysisId

Poll the status and result of a previously submitted analysis.

**Path parameter:**
| Parameter  | Type   | Description             |
|------------|--------|-------------------------|
| analysisId | string | UUID returned by POST   |

**Response 200 — in progress (queued or processing):**
```json
{
  "analysisId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "progress": 0
}
```

```json
{
  "analysisId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": 70
}
```

**Response 200 — completed:**
```json
{
  "analysisId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "cached": false,
  "result": {
    "summary": "Resumo executivo em linguagem clara.",
    "clauses": [
      {
        "clauseIndex": 1,
        "text": "Trecho da clausula extraido do contrato.",
        "riskLevel": "alto",
        "explanation": "Explicacao clara e acionavel do risco identificado."
      }
    ],
    "embeddingsSaved": true,
    "processedAt": "2026-04-03T10:00:00Z"
  }
}
```

**Response 200 — failed:**
```json
{
  "analysisId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "error": "Descricao do erro ocorrido durante a analise."
}
```

**Response 404:**
```json
{ "error": "Analise nao encontrada." }
```

---

### GET /api/contracts/search

Semantic search across previously analysed contracts using vector cosine similarity.

**Query parameters:**
| Parameter | Type   | Required | Default | Max | Description |
|-----------|--------|----------|---------|-----|-------------|
| q         | string | Yes      | —       | —   | Free-text query for semantic search |
| limit     | number | No       | 10      | 50  | Maximum number of results to return |

**Example request:**
```
GET /api/contracts/search?q=clausula+de+confidencialidade&limit=5
```

**Response 200:**
```json
{
  "query": "clausula de confidencialidade",
  "results": [
    {
      "analysisId": "550e8400-e29b-41d4-a716-446655440000",
      "fileName": "contrato-empresa-xpto.pdf",
      "similarity": 0.9217,
      "summary": "Resumo executivo do contrato.",
      "analyzedAt": "2026-04-03T10:00:00Z"
    }
  ],
  "total": 1
}
```

**Response 400:**
```json
{ "error": "Parametro 'q' e obrigatorio." }
```

---

## Health Check

### GET /health

```json
{ "status": "ok" }
```
