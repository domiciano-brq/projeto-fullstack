# API Documentation

## Base URL
All endpoints are prefixed with `/api`.

---

## US-3: Autenticacao e Estrutura Multi-tenant

### Authentication

#### POST /api/auth/signup
Registers a new user with email and password.

- **Body:** `{ email: string, password: string, name: string }`
- **201:** `{ id: string, email: string, name: string }`
- **400:** `{ error: "Dados invalidos" }`
- **409:** `{ error: "Email ja cadastrado" }`

---

#### POST /api/auth/login
Authenticates a user and returns JWT access + refresh tokens.

- **Body:** `{ email: string, password: string }`
- **200:** `{ access_token: string, refresh_token: string, token_type: "Bearer" }`
- **401:** `{ error: "Credenciais invalidas" }`

---

#### POST /api/auth/refresh
Renews access token using a valid refresh token (token rotation applied).

- **Body:** `{ refresh_token: string }`
- **200:** `{ access_token: string, refresh_token: string, token_type: "Bearer" }`
- **401:** `{ error: "Refresh token invalido ou expirado" }`

---

#### GET /api/auth/google
Redirects to Google OAuth 2.0 consent screen.

- **302:** Redirect to Google OAuth URL
- **500:** `{ error: "Erro ao iniciar SSO" }`

---

#### GET /api/auth/google/callback
Handles Google OAuth callback. Creates or retrieves user and issues tokens.

- **Query params:** `code`, `state` (sent by Google)
- **200:** `{ access_token: string, refresh_token: string, token_type: "Bearer" }`
- **401:** `{ error: "Autenticacao Google falhou" }`

---

### User

#### GET /api/me
Returns authenticated user data with active organization context.

- **Headers:** `Authorization: Bearer <access_token>`
- **200:** `{ id: string, email: string, name: string, role: "Admin"|"Member"|"Viewer"|null, organization: { id: string, name: string, status: string }|null }`
- **401:** `{ error: "Nao autenticado" }`

---

### Organizations

#### POST /api/organizations
Creates a new organization. Authenticated user becomes Admin.

- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** `{ name: string }`
- **201:** `{ id: string, name: string, status: "active", createdAt: string }`
- **400:** `{ error: "Dados invalidos" }`
- **401:** `{ error: "Nao autenticado" }`

---

#### PATCH /api/organizations/:id
Edits an organization. Admin only.

- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** `{ name?: string }`
- **200:** `{ id: string, name: string, status: string, updatedAt: string }`
- **400:** `{ error: "Dados invalidos" }`
- **401:** `{ error: "Nao autenticado" }`
- **403:** `{ error: "Sem permissao" }`
- **404:** `{ error: "Organizacao nao encontrada" }`

---

#### DELETE /api/organizations/:id
Soft-deletes an organization (sets status to "inactive"). Admin only.

- **Headers:** `Authorization: Bearer <access_token>`
- **200:** `{ id: string, status: "inactive" }`
- **401:** `{ error: "Nao autenticado" }`
- **403:** `{ error: "Sem permissao" }`
- **404:** `{ error: "Organizacao nao encontrada" }`

---

#### GET /api/organizations/:id/members
Lists organization members. Data is isolated per org.

- **Headers:** `Authorization: Bearer <access_token>`
- **200:** `{ members: [{ id: string, name: string, email: string, role: "Admin"|"Member"|"Viewer" }] }`
- **401:** `{ error: "Nao autenticado" }`
- **403:** `{ error: "Sem permissao" }`
- **404:** `{ error: "Organizacao nao encontrada" }`

---

#### POST /api/organizations/:id/invites
Sends an invite to join the org (token valid for 7 days). Admin only.

- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** `{ email: string, role: "Member"|"Viewer" }`
- **201:** `{ inviteId: string, email: string, expiresAt: string }`
- **400:** `{ error: "Dados invalidos" }`
- **401:** `{ error: "Nao autenticado" }`
- **403:** `{ error: "Sem permissao" }`
- **404:** `{ error: "Organizacao nao encontrada" }`
- **409:** `{ error: "Usuario ja e membro da organizacao" }`

---

### Invites

#### POST /api/invites/:token/accept
Accepts an invite. Authenticated user is linked to the org with the defined role.

- **Headers:** `Authorization: Bearer <access_token>`
- **200:** `{ organizationId: string, organizationName: string, role: string }`
- **401:** `{ error: "Nao autenticado" }`
- **404:** `{ error: "Convite nao encontrado" }`
- **410:** `{ error: "Convite expirado" }` or `{ error: "Convite ja utilizado" }`
