# Backend — US-7

## Endpoints implementados

### POST /api/contracts/:id/signature-request
- **Params:** `id` — internal contract identifier
- **Body:** `{ signatories: [{ name: string, email: string, cpf: string }] }`
- **Resposta 201:** `{ contractId: string, externalSignatureId: string, status: "pending_signature", sentAt: string (ISO 8601) }`
- **Resposta 400:** `{ error: "Dados de signatarios invalidos ou ausentes" }`
- **Resposta 422:** `{ error: "Contrato ja enviado para assinatura ou ja assinado" }`
- **Resposta 502:** `{ error: "Falha na comunicacao com o servico de assinatura digital" }`

### GET /api/contracts/:id/signature-status
- **Params:** `id` — internal contract identifier
- **Resposta 200:** `{ contractId: string, status: "pending_signature"|"signed"|"refused"|"expired", externalSignatureId: string, updatedAt: string (ISO 8601) }`
- **Resposta 404:** `{ error: "Contrato nao encontrado" }`

### DELETE /api/contracts/:id/signature-request
- **Params:** `id` — internal contract identifier
- **Resposta 200:** `{ contractId: string, status: "cancelled", cancelledAt: string (ISO 8601) }`
- **Resposta 404:** `{ error: "Contrato nao encontrado" }`
- **Resposta 422:** `{ error: "Solicitacao de assinatura nao esta pendente, nao pode ser cancelada" }`
- **Resposta 502:** `{ error: "Falha na comunicacao com o servico de assinatura digital" }`

### POST /api/webhooks/signature
- **Headers:** `X-Webhook-Token: string`
- **Body:** `{ uuid_document: string, type_post: "signed"|"refused"|"expired" }` (D4Sign format; also supports `document_key` + `status` for Clicksign)
- **Resposta 200:** `{ received: true }`
- **Resposta 400:** `{ error: "Payload de webhook invalido ou token ausente" }`
- **Resposta 401:** `{ error: "Token de webhook invalido" }`

## Arquivos criados/modificados

- `backend/package.json` — Node/Express project manifest
- `backend/src/index.js` — Express app entry point
- `backend/src/routes/index.js` — All API routes registered with `/api` prefix
- `backend/src/controllers/signature.controller.js` — Business logic + in-memory store for all four endpoints
- `backend/src/services/signatureService.js` — Abstraction layer for external platform calls (retry/backoff), webhook token validation, status normalisation, S3 simulation, and async email dispatch
- `docs/API.md` — Full API documentation for all US-7 endpoints
- `docs/DECISIONS.md` — Architecture Decision Records (ADR-001)

## Observacoes

- **In-memory store:** Signature records live in a `Map` inside the controller module. No database is used; data is reset on server restart.
- **External platform simulation:** `signatureService.js` simulates D4Sign/Clicksign calls. To integrate the real API, replace the stub `sendContractToSignaturePlatform` and `cancelSignatureOnPlatform` functions with actual HTTP calls using the values from `SIGNATURE_API_KEY` and `SIGNATURE_API_URL` environment variables.
- **Retry logic:** All external platform calls are wrapped in `withRetry` (3 attempts with 1s/2s/4s delays).
- **Webhook validation:** Token must match `WEBHOOK_SECRET_TOKEN` env var (defaults to `dev-webhook-token` in dev). Validation happens before any state mutation.
- **S3 upload:** Triggered asynchronously via `setImmediate` when webhook `status = "signed"`. Set `AWS_S3_BUCKET` env var to configure the bucket.
- **Email dispatch:** Sent asynchronously via `setImmediate` after `POST /signature-request` succeeds. Replace the `console.log` stub in `sendSignatoryEmails` with a real mail provider (SES, SendGrid, nodemailer).
- **Status normalisation:** Both D4Sign (`uuid_document` + `type_post`) and Clicksign (`document_key` + `status`) payload shapes are supported.
- **No 404 for unknown contracts on POST:** The current stub assumes any `id` is a valid contract. A real implementation should cross-check against a contracts store/DB and return 404 if the contract does not exist.
