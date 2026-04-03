# API Documentation

## Digital Signature — US-7

Base prefix: `/api`

---

### POST /api/contracts/:id/signature-request

Sends an existing contract for digital signature via D4Sign or Clicksign. Dispatches e-mail to signatories asynchronously after the request is accepted.

**URL Params**
| Param | Type   | Description                     |
|-------|--------|---------------------------------|
| id    | string | Internal contract identifier    |

**Request Body**
```json
{
  "signatories": [
    {
      "name": "string",
      "email": "string",
      "cpf": "string"
    }
  ]
}
```

**Responses**

| Status | Body                                                                                                       |
|--------|------------------------------------------------------------------------------------------------------------|
| 201    | `{ "contractId": "string", "externalSignatureId": "string", "status": "pending_signature", "sentAt": "ISO8601" }` |
| 400    | `{ "error": "Dados de signatarios invalidos ou ausentes" }`                                               |
| 404    | `{ "error": "Contrato nao encontrado" }`                                                                   |
| 422    | `{ "error": "Contrato ja enviado para assinatura ou ja assinado" }`                                        |
| 502    | `{ "error": "Falha na comunicacao com o servico de assinatura digital" }`                                 |

---

### GET /api/contracts/:id/signature-status

Returns the current signature status of a contract.

**URL Params**
| Param | Type   | Description                  |
|-------|--------|------------------------------|
| id    | string | Internal contract identifier |

**Responses**

| Status | Body                                                                                                                                        |
|--------|---------------------------------------------------------------------------------------------------------------------------------------------|
| 200    | `{ "contractId": "string", "status": "pending_signature\|signed\|refused\|expired", "externalSignatureId": "string", "updatedAt": "ISO8601" }` |
| 404    | `{ "error": "Contrato nao encontrado" }`                                                                                                    |

---

### DELETE /api/contracts/:id/signature-request

Cancels a pending signature request on the signature platform.

**URL Params**
| Param | Type   | Description                  |
|-------|--------|------------------------------|
| id    | string | Internal contract identifier |

**Responses**

| Status | Body                                                                                                        |
|--------|-------------------------------------------------------------------------------------------------------------|
| 200    | `{ "contractId": "string", "status": "cancelled", "cancelledAt": "ISO8601" }`                              |
| 404    | `{ "error": "Contrato nao encontrado" }`                                                                    |
| 422    | `{ "error": "Solicitacao de assinatura nao esta pendente, nao pode ser cancelada" }`                        |
| 502    | `{ "error": "Falha na comunicacao com o servico de assinatura digital" }`                                   |

---

### POST /api/webhooks/signature

Receives status update notifications from the signature platform (D4Sign or Clicksign). Validates the webhook token before processing. Stores the signed document in S3 when `status = "signed"`.

**Headers**
| Header            | Type   | Description                            |
|-------------------|--------|----------------------------------------|
| X-Webhook-Token   | string | Validation token configured on platform |

**Request Body (D4Sign example)**
```json
{
  "uuid_document": "string",
  "type_post": "signed | refused | expired"
}
```

**Responses**

| Status | Body                                                                  |
|--------|-----------------------------------------------------------------------|
| 200    | `{ "received": true }`                                                |
| 400    | `{ "error": "Payload de webhook invalido ou token ausente" }`         |
| 401    | `{ "error": "Token de webhook invalido" }`                            |
