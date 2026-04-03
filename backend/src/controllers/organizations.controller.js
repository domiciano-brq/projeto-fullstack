/**
 * Organizations Controller — US-3
 * Endpoints: create org, edit org, deactivate org, list members, send invite
 */

const {
  findOrgById,
  createOrg,
  updateOrg,
  getMembersOfOrg,
  addMember,
  findUserById,
  findMember,
  createInvite,
} = require('../store');

// ---- POST /api/organizations ----
// Creates a new organization; authenticated user becomes Admin.

function createOrganization(req, res) {
  const { name } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Dados invalidos' });
  }

  const org = createOrg({ name: name.trim() });

  // The creator becomes Admin
  addMember({ userId: req.user.id, organizationId: org.id, role: 'Admin' });

  return res.status(201).json({
    id: org.id,
    name: org.name,
    status: org.status,
    createdAt: org.createdAt,
  });
}

// ---- PATCH /api/organizations/:id ----
// Edits org data; restricted to Admin.

function editOrganization(req, res) {
  // requireOrgContext already verified org exists and user is a member
  const { name } = req.body || {};

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return res.status(400).json({ error: 'Dados invalidos' });
  }

  const updates = {};
  if (name) updates.name = name.trim();

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Dados invalidos' });
  }

  const updated = updateOrg(req.organization.id, updates);
  if (!updated) {
    return res.status(404).json({ error: 'Organizacao nao encontrada' });
  }

  return res.status(200).json({
    id: updated.id,
    name: updated.name,
    status: updated.status,
    updatedAt: updated.updatedAt,
  });
}

// ---- DELETE /api/organizations/:id ----
// Soft-deletes org (sets status to "inactive"); restricted to Admin.

function deactivateOrganization(req, res) {
  const updated = updateOrg(req.organization.id, { status: 'inactive' });
  if (!updated) {
    return res.status(404).json({ error: 'Organizacao nao encontrada' });
  }

  return res.status(200).json({ id: updated.id, status: 'inactive' });
}

// ---- GET /api/organizations/:id/members ----
// Lists members of the org; data isolated — only members of this org returned.

function listMembers(req, res) {
  const members = getMembersOfOrg(req.organization.id);

  const enriched = members.map((m) => {
    const user = findUserById(m.userId);
    return {
      id: m.userId,
      name: user ? user.name : '',
      email: user ? user.email : '',
      role: m.role,
    };
  });

  return res.status(200).json({ members: enriched });
}

// ---- POST /api/organizations/:id/invites ----
// Sends an invite; Admin only.

function sendInvite(req, res) {
  const { email, role } = req.body || {};

  if (
    !email ||
    typeof email !== 'string' ||
    !email.includes('@') ||
    !['Member', 'Viewer'].includes(role)
  ) {
    return res.status(400).json({ error: 'Dados invalidos' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if user is already a member
  const members = getMembersOfOrg(req.organization.id);
  for (const m of members) {
    const user = findUserById(m.userId);
    if (user && user.email === normalizedEmail) {
      return res.status(409).json({ error: 'Usuario ja e membro da organizacao' });
    }
  }

  const invite = createInvite({
    organizationId: req.organization.id,
    email: normalizedEmail,
    role,
    createdBy: req.user.id,
  });

  return res.status(201).json({
    inviteId: invite.id,
    email: invite.email,
    expiresAt: invite.expiresAt,
  });
}

module.exports = {
  createOrganization,
  editOrganization,
  deactivateOrganization,
  listMembers,
  sendInvite,
};
