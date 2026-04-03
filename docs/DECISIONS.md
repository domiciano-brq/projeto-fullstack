# Architecture Decision Records

---

## ADR-001 — Digital Signature Integration (US-7)

**Date:** 2026-04-03

**Context:**
The system needs to integrate digital signatures with legal validity using a third-party platform (D4Sign or Clicksign) to allow electronic contract signing with ICP-Brasil certification.

**Decisions:**

1. **Service abstraction layer** — A `signatureService.js` module wraps all calls to the external signature platform. The controller never calls the platform directly. This makes it easy to swap between D4Sign and Clicksign without changing the controller.

2. **Retry with exponential backoff** — All calls to the external platform go through a `withRetry` helper (3 attempts, delays 1s/2s/4s). This handles transient timeouts and temporary unavailability.

3. **Status normalisation** — The `normaliseStatus()` function maps platform-specific status values (`type_post` from D4Sign, `status` from Clicksign) into a single internal vocabulary: `pending_signature | signed | refused | expired | cancelled`.

4. **In-memory store** — Signature records are stored in a `Map` in the controller module. No database dependency at this stage, as specified in the contract.

5. **Webhook validation first** — The webhook handler validates `X-Webhook-Token` before touching any state. No data is written if the token is missing or invalid.

6. **Asynchronous side effects** — Email dispatch and S3 upload run via `setImmediate` (fire-and-forget) so they do not block the HTTP response. Failures are logged but do not affect the caller.

7. **Credentials in environment variables** — `SIGNATURE_API_KEY`, `SIGNATURE_API_URL`, `WEBHOOK_SECRET_TOKEN`, and `AWS_S3_BUCKET` are always read from `process.env`. No credentials are hard-coded.

**Rationale:**
Keeps the implementation simple and direct (no over-engineering), respects the defined API contract, and provides clear extension points for production integrations.
