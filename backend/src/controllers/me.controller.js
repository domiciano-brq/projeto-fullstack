/**
 * Me Controller — US-3
 * Endpoint: GET /api/me
 * Returns authenticated user data with active organization context.
 */

const { store, findMember, findOrgById } = require('../store');

// ---- GET /api/me ----

function getMe(req, res) {
  const user = req.user;

  // Find the user's first active org membership (primary org context)
  const membership = store.members.find(
    (m) => m.userId === user.id
  );

  let organization = null;
  let role = null;

  if (membership) {
    const org = findOrgById(membership.organizationId);
    if (org) {
      organization = { id: org.id, name: org.name, status: org.status };
      role = membership.role;
    }
  }

  return res.status(200).json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: role || null,
    organization: organization || null,
  });
}

module.exports = { getMe };
