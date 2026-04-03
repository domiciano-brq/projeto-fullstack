/**
 * Routes — US-3: Autenticacao e Estrutura Multi-tenant
 * All routes are prefixed with /api via the Express app.
 */

const { Router } = require('express');
const { requireAuth, requireOrgContext, requireRole } = require('../middleware/auth');

const { signup, login, refresh, googleAuth, googleCallback } = require('../controllers/auth.controller');
const { createOrganization, editOrganization, deactivateOrganization, listMembers, sendInvite } = require('../controllers/organizations.controller');
const { acceptInviteHandler } = require('../controllers/invites.controller');
const { getMe } = require('../controllers/me.controller');

const router = Router();

// ---- Auth ----
router.post('/auth/signup', signup);
router.post('/auth/login', login);
router.post('/auth/refresh', refresh);
router.get('/auth/google', googleAuth);
router.get('/auth/google/callback', googleCallback);

// ---- Me ----
router.get('/me', requireAuth, getMe);

// ---- Organizations ----
// Create org — any authenticated user
router.post('/organizations', requireAuth, createOrganization);

// Edit org — Admin only
router.patch(
  '/organizations/:id',
  requireAuth,
  requireOrgContext,
  requireRole('Admin'),
  editOrganization
);

// Deactivate org (soft delete) — Admin only
router.delete(
  '/organizations/:id',
  requireAuth,
  requireOrgContext,
  requireRole('Admin'),
  deactivateOrganization
);

// List members — any org member (Admin, Member, Viewer)
router.get(
  '/organizations/:id/members',
  requireAuth,
  requireOrgContext,
  listMembers
);

// Send invite — Admin only
router.post(
  '/organizations/:id/invites',
  requireAuth,
  requireOrgContext,
  requireRole('Admin'),
  sendInvite
);

// ---- Invites ----
// Accept invite — authenticated user
router.post('/invites/:token/accept', requireAuth, acceptInviteHandler);

module.exports = router;
