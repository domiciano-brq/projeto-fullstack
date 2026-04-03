/**
 * In-memory data store simulating the database entities:
 *   - documents
 *   - document_versions
 *   - document_audit
 *
 * Note: OCR background jobs are also simulated in-memory using setTimeout.
 * In a production environment, BullMQ + Redis would be used.
 */

'use strict';

// Map<document_id, { document_id, created_at }>
const documents = new Map();

// Map<version_id, { version_id, document_id, version_number, filename, mime_type,
//                   size_bytes, s3_key, ocr_status, ocr_text, ocr_error, created_at }>
const documentVersions = new Map();

// Map<document_id, [version_id, ...]> — ordered list of version_ids per document
const documentVersionIndex = new Map();

// Map<document_id, [audit_entry, ...]>
const documentAudit = new Map();

module.exports = {
  documents,
  documentVersions,
  documentVersionIndex,
  documentAudit,
 * In-memory data store for US-3: Autenticacao e Estrutura Multi-tenant
 * All data is reset on server restart — no persistence.
 */

const { v4: uuidv4 } = require('uuid');

const store = {
  users: [],           // User[]
  organizations: [],   // Organization[]
  members: [],         // OrganizationMember[]
  invites: [],         // Invite[]
  refreshTokens: [],   // RefreshToken[]
};

// ---- User helpers ----

function findUserById(id) {
  return store.users.find((u) => u.id === id) || null;
}

function findUserByEmail(email) {
  return store.users.find((u) => u.email === email) || null;
}

function findUserByGoogleId(googleId) {
  return store.users.find((u) => u.googleId === googleId) || null;
}

function createUser({ email, passwordHash = null, name, googleId = null }) {
  const user = {
    id: uuidv4(),
    email,
    passwordHash,
    name,
    googleId,
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  return user;
}

// ---- Organization helpers ----

function findOrgById(id) {
  return store.organizations.find((o) => o.id === id) || null;
}

function createOrg({ name }) {
  const now = new Date().toISOString();
  const org = {
    id: uuidv4(),
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  store.organizations.push(org);
  return org;
}

function updateOrg(id, fields) {
  const org = findOrgById(id);
  if (!org) return null;
  Object.assign(org, fields, { updatedAt: new Date().toISOString() });
  return org;
}

// ---- OrganizationMember helpers ----

function findMember(userId, organizationId) {
  return store.members.find(
    (m) => m.userId === userId && m.organizationId === organizationId
  ) || null;
}

function getMembersOfOrg(organizationId) {
  return store.members.filter((m) => m.organizationId === organizationId);
}

function addMember({ userId, organizationId, role }) {
  const existing = findMember(userId, organizationId);
  if (existing) return existing;
  const member = {
    userId,
    organizationId,
    role,
    joinedAt: new Date().toISOString(),
  };
  store.members.push(member);
  return member;
}

// ---- Invite helpers ----

function findInviteByToken(token) {
  return store.invites.find((i) => i.token === token) || null;
}

function createInvite({ organizationId, email, role, createdBy }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const invite = {
    id: uuidv4(),
    token: uuidv4(),
    organizationId,
    email,
    role,
    createdBy,
    expiresAt: expiresAt.toISOString(),
    acceptedAt: null,
  };
  store.invites.push(invite);
  return invite;
}

function acceptInvite(token) {
  const invite = findInviteByToken(token);
  if (invite) {
    invite.acceptedAt = new Date().toISOString();
  }
  return invite;
}

// ---- RefreshToken helpers ----

function storeRefreshToken({ userId, token, expiresAt }) {
  const rt = {
    id: uuidv4(),
    userId,
    token, // stored as plain string (hashed by caller if needed)
    expiresAt,
    revokedAt: null,
  };
  store.refreshTokens.push(rt);
  return rt;
}

function findRefreshToken(token) {
  return store.refreshTokens.find((rt) => rt.token === token) || null;
}

function revokeRefreshToken(token) {
  const rt = findRefreshToken(token);
  if (rt) {
    rt.revokedAt = new Date().toISOString();
  }
  return rt;
}

module.exports = {
  store,
  // users
  findUserById,
  findUserByEmail,
  findUserByGoogleId,
  createUser,
  // organizations
  findOrgById,
  createOrg,
  updateOrg,
  // members
  findMember,
  getMembersOfOrg,
  addMember,
  // invites
  findInviteByToken,
  createInvite,
  acceptInvite,
  // refresh tokens
  storeRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
};
