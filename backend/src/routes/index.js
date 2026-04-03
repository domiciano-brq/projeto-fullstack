const express = require('express');
const router = express.Router();

const signatureController = require('../controllers/signature.controller');

// ---------------------------------------------------------------------------
// Signature routes
// ---------------------------------------------------------------------------

// Send contract for digital signature
router.post('/contracts/:id/signature-request', signatureController.createSignatureRequest);

// Get current signature status
router.get('/contracts/:id/signature-status', signatureController.getSignatureStatus);

// Cancel a pending signature request
router.delete('/contracts/:id/signature-request', signatureController.cancelSignatureRequest);

// Receive webhook notifications from the signature platform
router.post('/webhooks/signature', signatureController.handleWebhook);

module.exports = router;
