/**
 * Auth middleware — verifies JWT access token and injects user + org context.
 */

const jwt = require('jsonwebtoken');
const { findUserById, findMember, findOrgById } = require('../store');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

/**
 * requireAuth — validates the Bearer token and attaches req.user.
 * Does NOT enforce org context on its own; use requireOrgContext for that.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nao autenticado' });
  }

  const token = authHeader.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Nao autenticado' });
  }

  const user = findUserById(payload.sub);
  if (!user) {
    return res.status(401).json({ error: 'Nao autenticado' });
  }

  req.user = user;
  next();
}

/**
 * requireOrgContext — must be used after requireAuth.
 * Reads organizationId from route param (:id) or from the JWT payload (orgId).
 * Injects req.orgMember and req.organization.
 */
function requireOrgContext(req, res, next) {
  const orgId = req.params.id || req.orgId;
  if (!orgId) return next(); // no org context needed for this route

  const org = findOrgById(orgId);
  if (!org) {
    return res.status(404).json({ error: 'Organizacao nao encontrada' });
  }
  if (org.status === 'inactive') {
    return res.status(403).json({ error: 'Organizacao inativa' });
  }

  const member = findMember(req.user.id, orgId);
  if (!member) {
    return res.status(403).json({ error: 'Sem permissao' });
  }

  req.organization = org;
  req.orgMember = member;
  next();
}

/**
 * requireRole — factory that restricts a route to given roles.
 * Must be used after requireOrgContext.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.orgMember) {
      return res.status(403).json({ error: 'Sem permissao' });
    }
    if (!roles.includes(req.orgMember.role)) {
      return res.status(403).json({ error: 'Sem permissao' });
    }
    next();
  };
}

module.exports = { requireAuth, requireOrgContext, requireRole };
