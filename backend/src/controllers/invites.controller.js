/**
 * Invites Controller — US-3
 * Endpoint: POST /api/invites/:token/accept
 */

const {
  findInviteByToken,
  findOrgById,
  findMember,
  addMember,
  acceptInvite,
} = require('../store');

// ---- POST /api/invites/:token/accept ----
// Accepts an invite; authenticated user is linked to the org with the role defined in the invite.

function acceptInviteHandler(req, res) {
  const { token } = req.params;

  const invite = findInviteByToken(token);
  if (!invite) {
    return res.status(404).json({ error: 'Convite nao encontrado' });
  }

  if (new Date(invite.expiresAt) < new Date()) {
    return res.status(410).json({ error: 'Convite expirado' });
  }

  if (invite.acceptedAt) {
    return res.status(410).json({ error: 'Convite ja utilizado' });
  }

  const org = findOrgById(invite.organizationId);
  if (!org || org.status === 'inactive') {
    return res.status(404).json({ error: 'Organizacao nao encontrada' });
  }

  // Add user to org (addMember is idempotent — won't duplicate)
  addMember({
    userId: req.user.id,
    organizationId: invite.organizationId,
    role: invite.role,
  });

  // Mark invite as used
  acceptInvite(token);

  return res.status(200).json({
    organizationId: org.id,
    organizationName: org.name,
    role: invite.role,
  });
}

module.exports = { acceptInviteHandler };
