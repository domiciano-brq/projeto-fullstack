# API Contract — US-7

## Agentes necessarios
- backend: sim
- frontend: nao

## Endpoints

### POST /api/contracts/:id/signature-request
- **Descricao:** Envia um contrato existente para assinatura digital via D4Sign ou Clicksign. Dispara e-mail aos signatarios apos o envio.
- **Params:** `id` — identificador unico do contrato no sistema
- **Body:** `{ signatories: [{ name: string, email: string, cpf: string }] }`
- **Resposta 201:** `{ contractId: string, externalSignatureId: string, status: "pending_signature", sentAt: string (ISO 8601) }`
- **Resposta 400:** `{ error: "Dados de signatarios invalidos ou ausentes" }`
- **Resposta 404:** `{ error: "Contrato nao encontrado" }`
- **Resposta 422:** `{ error: "Contrato ja enviado para assinatura ou ja assinado" }`
- **Resposta 502:** `{ error: "Falha na comunicacao com o servico de assinatura digital" }`

---

### GET /api/contracts/:id/signature-status
- **Descricao:** Retorna o status atual da assinatura de um contrato.
- **Params:** `id` — identificador unico do contrato no sistema
- **Body:** N/A
- **Resposta 200:** `{ contractId: string, status: "pending_signature" | "signed" | "refused" | "expired", externalSignatureId: string, updatedAt: string (ISO 8601) }`
- **Resposta 404:** `{ error: "Contrato nao encontrado" }`

---

### POST /api/webhooks/signature
- **Descricao:** Recebe notificacoes de atualizacao de status da plataforma de assinatura (D4Sign ou Clicksign). Valida autenticidade do payload antes de persistir. Armazena documento assinado com certificado ICP-Brasil no S3 quando status for "signed".
- **Headers:** `X-Webhook-Token: string` (token de validacao configurado na plataforma)
- **Body (D4Sign example):** `{ uuid_document: string, type_post: "signed" | "refused" | "expired", ... }`
- **Resposta 200:** `{ received: true }`
- **Resposta 400:** `{ error: "Payload de webhook invalido ou token ausente" }`
- **Resposta 401:** `{ error: "Token de webhook invalido" }`

---

### DELETE /api/contracts/:id/signature-request
- **Descricao:** Cancela uma solicitacao de assinatura pendente junto a plataforma de assinatura digital.
- **Params:** `id` — identificador unico do contrato no sistema
- **Body:** N/A
- **Resposta 200:** `{ contractId: string, status: "cancelled", cancelledAt: string (ISO 8601) }`
- **Resposta 404:** `{ error: "Contrato nao encontrado" }`
- **Resposta 422:** `{ error: "Solicitacao de assinatura nao esta pendente, nao pode ser cancelada" }`
- **Resposta 502:** `{ error: "Falha na comunicacao com o servico de assinatura digital" }`

---

## Dados em memoria

Estrutura do registro de assinatura associado a um contrato:

```
{
  contractId: string,          // ID interno do contrato
  externalSignatureId: string, // ID do documento na plataforma (D4Sign uuid ou Clicksign key)
  status: "pending_signature" | "signed" | "refused" | "expired" | "cancelled",
  signatories: [
    {
      name: string,
      email: string,
      cpf: string
    }
  ],
  s3Key: string | null,        // Caminho do documento assinado com certificado no S3 (preenchido apos assinatura)
  sentAt: string,              // ISO 8601
  updatedAt: string            // ISO 8601
}
```

## Observacoes

- As credenciais da plataforma de assinatura (API key, token de webhook) devem ser armazenadas exclusivamente em variaveis de ambiente, nunca no codigo.
- Chamadas HTTP para a plataforma de assinatura devem implementar retry com backoff exponencial (sugestao: 3 tentativas com intervalos 1s, 2s, 4s) para lidar com timeouts e indisponibilidades temporarias.
- O webhook deve ser validado antes de qualquer persistencia: verificar o token no header `X-Webhook-Token` e, se disponivel, a assinatura HMAC do payload fornecida pela plataforma.
- O documento assinado (PDF + certificado ICP-Brasil) deve ser armazenado no S3 assim que o status "signed" for recebido via webhook. A `s3Key` deve ser atualizada no registro de assinatura apos o upload bem-sucedido.
- O e-mail de notificacao aos signatarios deve ser disparado de forma assincrona apos o envio bem-sucedido para a plataforma (endpoint `POST /api/contracts/:id/signature-request`).
- Esta historia e exclusivamente backend; nenhuma interface de usuario e necessaria (frontend: nao).
- O campo `type_post` pode variar entre D4Sign e Clicksign — o backend deve abstrair isso em um status interno normalizado.
