/**
 * signatureService.js
 * Abstracts calls to D4Sign/Clicksign with retry + backoff logic.
 * Simulates S3 storage and email dispatch (no real HTTP calls in dev/test).
 *
 * Environment variables used:
 *   SIGNATURE_API_KEY      — API key for D4Sign/Clicksign
 *   SIGNATURE_API_URL      — Base URL of the signing platform
 *   WEBHOOK_SECRET_TOKEN   — Token validated on incoming webhook calls
 *   AWS_S3_BUCKET          — S3 bucket name for signed documents
 */

const WEBHOOK_SECRET_TOKEN = process.env.WEBHOOK_SECRET_TOKEN || 'dev-webhook-token';

// ---------------------------------------------------------------------------
// Retry helper — exponential backoff (1s, 2s, 4s)
// ---------------------------------------------------------------------------
async function withRetry(fn, retries = 3) {
  let delay = 1000;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

// ---------------------------------------------------------------------------
// External signature platform (D4Sign / Clicksign) — simulated
// ---------------------------------------------------------------------------

/**
 * Sends a contract to the signature platform.
 * Returns an object with { externalSignatureId }.
 * In production this would call the real API endpoint.
 */
async function sendContractToSignaturePlatform(contractId, signatories) {
  return withRetry(async () => {
    // Simulate external API call
    // In production: await axios.post(`${SIGNATURE_API_URL}/documents`, { ... })
    const externalSignatureId = `ext-sig-${contractId}-${Date.now()}`;
    return { externalSignatureId };
  });
}

/**
 * Cancels a pending signature request on the platform.
 * Throws if the external call fails.
 */
async function cancelSignatureOnPlatform(externalSignatureId) {
  return withRetry(async () => {
    // Simulate external API call
    // In production: await axios.delete(`${SIGNATURE_API_URL}/documents/${externalSignatureId}`)
    return { cancelled: true };
  });
}

// ---------------------------------------------------------------------------
// Webhook token validation
// ---------------------------------------------------------------------------
function validateWebhookToken(token) {
  return token === WEBHOOK_SECRET_TOKEN;
}

/**
 * Normalises the `type_post` (D4Sign) or equivalent field from different
 * platforms into an internal status string.
 */
function normaliseStatus(rawStatus) {
  const map = {
    signed: 'signed',
    refused: 'refused',
    expired: 'expired',
    cancelled: 'cancelled',
    pending_signature: 'pending_signature',
  };
  return map[rawStatus] || 'pending_signature';
}

// ---------------------------------------------------------------------------
// S3 storage (simulated)
// ---------------------------------------------------------------------------

/**
 * Stores the signed document in S3.
 * Returns the s3Key used.
 */
async function storeSignedDocumentInS3(contractId, externalSignatureId) {
  // In production: download the PDF from the signing platform then
  // upload to S3 via AWS SDK:
  //   await s3.putObject({ Bucket: AWS_S3_BUCKET, Key: s3Key, Body: pdfBuffer })
  const bucket = process.env.AWS_S3_BUCKET || 'signed-documents';
  const s3Key = `contracts/${contractId}/${externalSignatureId}-signed.pdf`;
  console.log(`[S3] Stored signed document at s3://${bucket}/${s3Key}`);
  return s3Key;
}

// ---------------------------------------------------------------------------
// Email notification (simulated / async fire-and-forget)
// ---------------------------------------------------------------------------

/**
 * Sends notification emails to signatories asynchronously.
 * Does not block the request response.
 */
function sendSignatoryEmails(contractId, signatories) {
  setImmediate(() => {
    signatories.forEach(({ name, email }) => {
      // In production: use nodemailer / SES / SendGrid
      console.log(`[Email] Sent signature request to ${name} <${email}> for contract ${contractId}`);
    });
  });
}

module.exports = {
  sendContractToSignaturePlatform,
  cancelSignatureOnPlatform,
  validateWebhookToken,
  normaliseStatus,
  storeSignedDocumentInS3,
  sendSignatoryEmails,
};
