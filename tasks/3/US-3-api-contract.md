# API Contract — US-3

## Agentes necessarios
- backend: sim
- frontend: sim

---

## Endpoints

### POST /api/auth/signup
- **Descricao:** Registra um novo usuario com email e senha. Cria o usuario sem vinculo de organizacao inicial.
- **Body:** `{ email: string, password: string, name: string }`
- **Resposta 201:** `{ id: string, email: string, name: string }`
- **Resposta 400:** `{ error: "Dados invalidos" }`
- **Resposta 409:** `{ error: "Email ja cadastrado" }`

---

### POST /api/auth/login
- **Descricao:** Autentica usuario com email e senha. Retorna access token (JWT, 15min) e refresh token (7 dias).
- **Body:** `{ email: string, password: string }`
- **Resposta 200:** `{ access_token: string, refresh_token: string, token_type: "Bearer" }`
- **Resposta 401:** `{ error: "Credenciais invalidas" }`

---

### POST /api/auth/refresh
- **Descricao:** Renova o access token usando um refresh token valido.
- **Body:** `{ refresh_token: string }`
- **Resposta 200:** `{ access_token: string, refresh_token: string, token_type: "Bearer" }`
- **Resposta 401:** `{ error: "Refresh token invalido ou expirado" }`

---

### GET /api/auth/google
- **Descricao:** Redireciona o usuario para a tela de consentimento OAuth 2.0 do Google.
- **Body:** N/A
- **Resposta 302:** Redirect para URL do Google OAuth
- **Resposta 500:** `{ error: "Erro ao iniciar SSO" }`

---

### GET /api/auth/google/callback
- **Descricao:** Callback do OAuth Google. Cria ou recupera usuario e retorna tokens. Chamado pelo Google apos consentimento.
- **Body:** N/A (query params `code` e `state` enviados pelo Google)
- **Resposta 200:** `{ access_token: string, refresh_token: string, token_type: "Bearer" }`
- **Resposta 401:** `{ error: "Autenticacao Google falhou" }`

---

### GET /api/me
- **Descricao:** Retorna dados do usuario autenticado com o contexto da organizacao ativa injetado pelo guard.
- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** N/A
- **Resposta 200:** `{ id: string, email: string, name: string, role: "Admin" | "Member" | "Viewer", organization: { id: string, name: string, status: "active" | "inactive" } }`
- **Resposta 401:** `{ error: "Nao autenticado" }`

---

### POST /api/organizations
- **Descricao:** Cria uma nova organizacao. Requer autenticacao. O usuario criador torna-se Admin da organizacao.
- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** `{ name: string }`
- **Resposta 201:** `{ id: string, name: string, status: "active", createdAt: string }`
- **Resposta 400:** `{ error: "Dados invalidos" }`
- **Resposta 401:** `{ error: "Nao autenticado" }`

---

### PATCH /api/organizations/:id
- **Descricao:** Edita dados de uma organizacao existente. Restrito a Admin da organizacao.
- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** `{ name?: string }`
- **Resposta 200:** `{ id: string, name: string, status: string, updatedAt: string }`
- **Resposta 400:** `{ error: "Dados invalidos" }`
- **Resposta 401:** `{ error: "Nao autenticado" }`
- **Resposta 403:** `{ error: "Sem permissao" }`
- **Resposta 404:** `{ error: "Organizacao nao encontrada" }`

---

### DELETE /api/organizations/:id
- **Descricao:** Desativa uma organizacao (soft delete — altera status para "inactive"). Restrito a Admin.
- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** N/A
- **Resposta 200:** `{ id: string, status: "inactive" }`
- **Resposta 401:** `{ error: "Nao autenticado" }`
- **Resposta 403:** `{ error: "Sem permissao" }`
- **Resposta 404:** `{ error: "Organizacao nao encontrada" }`

---

### GET /api/organizations/:id/members
- **Descricao:** Lista membros da organizacao. Dados isolados por org — usuario so ve membros da propria org.
- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** N/A
- **Resposta 200:** `{ members: [{ id: string, name: string, email: string, role: "Admin" | "Member" | "Viewer" }] }`
- **Resposta 401:** `{ error: "Nao autenticado" }`
- **Resposta 403:** `{ error: "Sem permissao" }`
- **Resposta 404:** `{ error: "Organizacao nao encontrada" }`

---

### POST /api/organizations/:id/invites
- **Descricao:** Envia convite por e-mail para um novo membro. Gera token com expiracao de 7 dias. Restrito a Admin.
- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** `{ email: string, role: "Member" | "Viewer" }`
- **Resposta 201:** `{ inviteId: string, email: string, expiresAt: string }`
- **Resposta 400:** `{ error: "Dados invalidos" }`
- **Resposta 401:** `{ error: "Nao autenticado" }`
- **Resposta 403:** `{ error: "Sem permissao" }`
- **Resposta 404:** `{ error: "Organizacao nao encontrada" }`
- **Resposta 409:** `{ error: "Usuario ja e membro da organizacao" }`

---

### POST /api/invites/:token/accept
- **Descricao:** Aceita o convite usando o token recebido por e-mail. Vincula o usuario autenticado a organizacao com o role definido no convite.
- **Headers:** `Authorization: Bearer <access_token>`
- **Body:** N/A
- **Resposta 200:** `{ organizationId: string, organizationName: string, role: string }`
- **Resposta 401:** `{ error: "Nao autenticado" }`
- **Resposta 404:** `{ error: "Convite nao encontrado" }`
- **Resposta 410:** `{ error: "Convite expirado" }`

---

## Dados em memoria

Enquanto nao houver banco de dados configurado, as entidades podem ser mantidas em estruturas em memoria para desenvolvimento inicial.

```
User {
  id: uuid
  email: string (unique)
  passwordHash: string | null   // null para usuarios SSO-only
  name: string
  googleId: string | null
  createdAt: datetime
}

Organization {
  id: uuid
  name: string
  status: "active" | "inactive"
  createdAt: datetime
  updatedAt: datetime
}

OrganizationMember {
  userId: uuid
  organizationId: uuid
  role: "Admin" | "Member" | "Viewer"
  joinedAt: datetime
}

Invite {
  id: uuid
  token: uuid (unico, gerado aleatoriamente)
  organizationId: uuid
  email: string
  role: "Member" | "Viewer"
  createdBy: uuid  // userId do Admin
  expiresAt: datetime  // createdAt + 7 dias
  acceptedAt: datetime | null
}

RefreshToken {
  id: uuid
  userId: uuid
  token: string (hash)
  expiresAt: datetime  // createdAt + 7 dias
  revokedAt: datetime | null
}
```

---

## Observacoes

1. **Isolamento multi-tenant:** O guard de autenticacao deve injetar `organizationId` no contexto de cada request. Operacoes de leitura e escrita devem filtrar por `organizationId` antes de retornar dados.

2. **Roles:** `Admin` tem acesso total a propria org. `Member` tem acesso de leitura e escrita a recursos. `Viewer` tem acesso somente leitura. Guards NestJS devem aplicar essa logica via decorator `@Roles(...)`.

3. **JWT:** Access token expira em 15 minutos. Refresh token expira em 7 dias. Ao usar o refresh token, o token antigo deve ser revogado (rotacao de tokens).

4. **Senhas:** Armazenadas com bcrypt, minimo 10 salt rounds. Nunca retornadas em responses.

5. **SSO Google:** Ao fazer login com Google, se o email ja existir no sistema, o `googleId` e associado ao usuario existente. Se nao existir, um novo usuario e criado sem `passwordHash`.

6. **Convites:** O token do convite e um UUID gerado aleatoriamente. O e-mail deve conter um link no formato `/invite/<token>/accept`. O endpoint `/api/invites/:token/accept` requer que o usuario ja esteja autenticado antes de aceitar.

7. **Desativacao de org:** A operacao DELETE e um soft delete — altera `status` para "inactive". Usuarios da org desativada perdem acesso aos recursos da org.

8. **Variaveis de ambiente necessarias:** `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.
