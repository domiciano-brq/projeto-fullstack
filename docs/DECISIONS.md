# Architecture Decision Records

## ADR-001 — Express over NestJS for initial implementation
**Date:** 2026-04-03
**Context:** US-3 requires authentication and multi-tenant structure. The issue specified NestJS, but the agent squad workflow mandates Express with controllers in `backend/src/controllers/` and routes in `backend/src/routes/index.js`. This aligns with the CLAUDE.md principle of avoiding over-engineering.
**Decision:** Use Express 4.x with a flat controller pattern. Guards and decorators from NestJS are replaced by Express middleware (`requireAuth`, `requireOrgContext`, `requireRole`).
**Consequences:** Simpler setup; no DI container; easier to test in isolation.

---

## ADR-002 — In-memory data store
**Date:** 2026-04-03
**Context:** No database is configured for this phase of development.
**Decision:** All entities (User, Organization, OrganizationMember, Invite, RefreshToken) are stored in plain JavaScript arrays within a shared module (`backend/src/store/index.js`). Data is reset on server restart.
**Consequences:** Fast to implement; no migration needed. Must be replaced with a persistent store before production.

---

## ADR-003 — JWT access token (15min) + opaque refresh token (7 days) with rotation
**Date:** 2026-04-03
**Context:** Security requirement from US-3 spec.
**Decision:** Access tokens are signed JWTs (HS256, 15-minute TTL). Refresh tokens are opaque UUIDs stored in memory with a 7-day TTL. On each refresh, the old token is revoked and a new pair is issued (token rotation).
**Consequences:** Limits the blast radius of a stolen access token. Rotation detects token reuse.

---

## ADR-004 — bcrypt with 10 salt rounds for password hashing
**Date:** 2026-04-03
**Context:** Requirement from US-3 spec (`REGRAS TECNICAS`).
**Decision:** Use `bcrypt` npm package with `saltRounds = 10` for all password hashing. SSO-only users have `passwordHash = null`.
**Consequences:** Passwords are never stored in plaintext and never returned in API responses.

---

## ADR-005 — Google SSO via direct OAuth 2.0 code exchange (no Passport.js)
**Date:** 2026-04-03
**Context:** The spec mentions `passport-google-oauth20` but the Express-only setup avoids unnecessary dependencies.
**Decision:** Implement Google OAuth 2.0 code exchange manually using the native `fetch` API (Node 18+). Redirects to `https://accounts.google.com/o/oauth2/v2/auth` and exchanges the code at `https://oauth2.googleapis.com/token`.
**Consequences:** Fewer dependencies; requires Node >= 18. If Passport is needed later, it can be added without breaking the current flow.

---

## ADR-006 — Multi-tenant isolation via middleware
**Date:** 2026-04-03
**Context:** Each request to org-scoped routes must verify membership and inject org context.
**Decision:** `requireOrgContext` middleware reads `:id` from the route param, verifies org existence and active status, and checks that the authenticated user is a member. It attaches `req.organization` and `req.orgMember` for downstream handlers. `requireRole(...roles)` then enforces role-based access.
**Consequences:** Org isolation is enforced at the route level, preventing cross-tenant data leakage.
