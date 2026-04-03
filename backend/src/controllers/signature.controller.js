/**
 * signature.controller.js
 * Handles all digital signature endpoints:
 *   POST   /api/contracts/:id/signature-request
 *   GET    /api/contracts/:id/signature-status
 *   DELETE /api/contracts/:id/signature-request
 *   POST   /api/webhooks/signature
 *
 * In-memory store keyed by contractId.
 */

const {
  sendContractToSignaturePlatform,
  cancelSignatureOnPlatform,
  validateWebhookToken,
  normaliseStatus,
  storeSignedDocumentInS3,
  sendSignatoryEmails,
} = require('../services/signatureService');

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
// Map<contractId, SignatureRecord>
const signatureStore = new Map();

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

function isValidSignatories(signatories) {
  if (!Array.isArray(signatories) || signatories.length === 0) return false;
  return signatories.every(
    (s) =>
      s &&
      typeof s.name === 'string' && s.name.trim() !== '' &&
      typeof s.email === 'string' && s.email.includes('@') &&
      typeof s.cpf === 'string' && s.cpf.trim() !== ''
  );
}

// ---------------------------------------------------------------------------
// POST /api/contracts/:id/signature-request
// ---------------------------------------------------------------------------
async function createSignatureRequest(req, res) {
  const contractId = req.params.id;
  const { signatories } = req.body || {};

  // Validate signatories
  if (!isValidSignatories(signatories)) {
    return res.status(400).json({ error: 'Dados de signatarios invalidos ou ausentes' });
  }

  // Check contract existence — stub: any ID is "found" unless record exists in a bad state.
  // A real implementation would look up the contracts store/DB here.

  // Check if already sent or signed
  const existing = signatureStore.get(contractId);
  if (existing && ['pending_signature', 'signed'].includes(existing.status)) {
    return res.status(422).json({ error: 'Contrato ja enviado para assinatura ou ja assinado' });
  }

  let externalSignatureId;
  try {
    const result = await sendContractToSignaturePlatform(contractId, signatories);
    externalSignatureId = result.externalSignatureId;
  } catch (err) {
    console.error('[SignatureController] Error calling signature platform:', err.message);
    return res.status(502).json({ error: 'Falha na comunicacao com o servico de assinatura digital' });
  }

  const now = new Date().toISOString();
  const record = {
    contractId,
    externalSignatureId,
    status: 'pending_signature',
    signatories,
    s3Key: null,
    sentAt: now,
    updatedAt: now,
  };
  signatureStore.set(contractId, record);

  // Dispatch emails asynchronously (fire-and-forget)
  sendSignatoryEmails(contractId, signatories);

  return res.status(201).json({
    contractId,
    externalSignatureId,
    status: 'pending_signature',
    sentAt: now,
  });
}

// ---------------------------------------------------------------------------
// GET /api/contracts/:id/signature-status
// ---------------------------------------------------------------------------
async function getSignatureStatus(req, res) {
  const contractId = req.params.id;
  const record = signatureStore.get(contractId);

  if (!record) {
    return res.status(404).json({ error: 'Contrato nao encontrado' });
  }

  return res.status(200).json({
    contractId: record.contractId,
    status: record.status,
    externalSignatureId: record.externalSignatureId,
    updatedAt: record.updatedAt,
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/contracts/:id/signature-request
// ---------------------------------------------------------------------------
async function cancelSignatureRequest(req, res) {
  const contractId = req.params.id;
  const record = signatureStore.get(contractId);

  if (!record) {
    return res.status(404).json({ error: 'Contrato nao encontrado' });
  }

  if (record.status !== 'pending_signature') {
    return res.status(422).json({
      error: 'Solicitacao de assinatura nao esta pendente, nao pode ser cancelada',
    });
  }

  try {
    await cancelSignatureOnPlatform(record.externalSignatureId);
  } catch (err) {
    console.error('[SignatureController] Error cancelling on platform:', err.message);
    return res.status(502).json({ error: 'Falha na comunicacao com o servico de assinatura digital' });
  }

  const now = new Date().toISOString();
  record.status = 'cancelled';
  record.updatedAt = now;
  signatureStore.set(contractId, record);

  return res.status(200).json({
    contractId,
    status: 'cancelled',
    cancelledAt: now,
  });
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/signature
// ---------------------------------------------------------------------------
async function handleWebhook(req, res) {
  const token = req.headers['x-webhook-token'];

  // Validate token before any processing
  if (!token) {
    return res.status(400).json({ error: 'Payload de webhook invalido ou token ausente' });
  }

  if (!validateWebhookToken(token)) {
    return res.status(401).json({ error: 'Token de webhook invalido' });
  }

  const payload = req.body;

  // Extract external ID — supports D4Sign (uuid_document) and Clicksign (document_key)
  const externalId = payload.uuid_document || payload.document_key;
  const rawStatus = payload.type_post || payload.status;

  if (!externalId || !rawStatus) {
    return res.status(400).json({ error: 'Payload de webhook invalido ou token ausente' });
  }

  const internalStatus = normaliseStatus(rawStatus);

  // Find the signature record by externalSignatureId
  let targetRecord = null;
  for (const record of signatureStore.values()) {
    if (record.externalSignatureId === externalId) {
      targetRecord = record;
      break;
    }
  }

  if (targetRecord) {
    targetRecord.status = internalStatus;
    targetRecord.updatedAt = new Date().toISOString();
    signatureStore.set(targetRecord.contractId, targetRecord);

    // Upload signed document to S3 asynchronously when status is "signed"
    if (internalStatus === 'signed') {
      setImmediate(async () => {
        try {
          const s3Key = await storeSignedDocumentInS3(targetRecord.contractId, externalId);
          targetRecord.s3Key = s3Key;
          targetRecord.updatedAt = new Date().toISOString();
          signatureStore.set(targetRecord.contractId, targetRecord);
        } catch (err) {
          console.error('[Webhook] Failed to store signed document in S3:', err.message);
        }
      });
    }
  } else {
    // Unknown external ID — acknowledge receipt but log warning
    console.warn(`[Webhook] Received notification for unknown externalSignatureId: ${externalId}`);
  }

  return res.status(200).json({ received: true });
}

// Expose store for testing purposes only
module.exports = {
  createSignatureRequest,
  getSignatureStatus,
  cancelSignatureRequest,
  handleWebhook,
  _signatureStore: signatureStore,
};
