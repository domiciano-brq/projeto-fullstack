# QA Report — US-3

## Code Review

| Critério | Arquivo | Status |
|----------|---------|--------|
| POST /auth/signup — registrar usuário com email/senha | `backend/src/controllers/auth.controller.js` | ✅ OK |
| POST /auth/login — retorna access_token e refresh_token | `backend/src/controllers/auth.controller.js` | ✅ OK |
| POST /auth/refresh — renova access_token com rotação de token | `backend/src/controllers/auth.controller.js` | ✅ OK |
| GET /auth/google — redireciona para Google OAuth | `backend/src/controllers/auth.controller.js` | ✅ OK |
| GET /auth/google/callback — cria/recupera usuário e retorna tokens | `backend/src/controllers/auth.controller.js` | ✅ OK |
| JWT access token (15min) + refresh token (7 dias) | `backend/src/controllers/auth.controller.js` | ✅ OK |
| Senhas armazenadas com bcrypt (SALT_ROUNDS = 10) | `backend/src/controllers/auth.controller.js` | ✅ OK |
| POST /organizations — cria org; criador torna-se Admin | `backend/src/controllers/organizations.controller.js` | ✅ OK |
| PATCH /organizations/:id — edita org; restrito a Admin | `backend/src/controllers/organizations.controller.js` | ✅ OK |
| DELETE /organizations/:id — soft delete (status "inactive"); restrito a Admin | `backend/src/controllers/organizations.controller.js` | ✅ OK |
| GET /organizations/:id/members — lista membros isolados por org | `backend/src/controllers/organizations.controller.js` | ✅ OK |
| POST /organizations/:id/invites — convite com token UUID e expiração 7 dias | `backend/src/controllers/organizations.controller.js` | ✅ OK |
| POST /invites/:token/accept — aceita convite e vincula usuário à org | `backend/src/controllers/invites.controller.js` | ✅ OK |
| Convite expirado retorna 410; convite já usado retorna 410 | `backend/src/controllers/invites.controller.js` | ✅ OK |
| GET /me — retorna usuário autenticado com contexto de organização | `backend/src/controllers/me.controller.js` | ✅ OK |
| requireAuth — valida Bearer JWT e injeta req.user | `backend/src/middleware/auth.js` | ✅ OK |
| requireOrgContext — injeta req.organization e req.orgMember | `backend/src/middleware/auth.js` | ✅ OK |
| requireRole — controle de acesso por role (Admin, Member, Viewer) | `backend/src/middleware/auth.js` | ✅ OK |
| Isolamento multi-tenant: getMembersOfOrg filtra por organizationId | `backend/src/store/index.js` | ✅ OK |
| Todas as rotas registradas em routes/index.js | `backend/src/routes/index.js` | ✅ OK |
| Todas as rotas registradas sob prefixo /api em app.js | `backend/src/app.js` | ✅ OK |
| Variáveis de ambiente para JWT_SECRET, JWT_REFRESH_SECRET, GOOGLE_* | `backend/src/controllers/auth.controller.js` | ✅ OK |
| SSO Google: associa googleId a usuário existente pelo email | `backend/src/controllers/auth.controller.js` | ✅ OK |
| Entidades em memória: User, Organization, OrganizationMember, Invite, RefreshToken | `backend/src/store/index.js` | ✅ OK |

## Observações

1. **Framework:** O user story menciona NestJS, mas a implementação utiliza Express.js com middleware equivalente aos Guards e Decorators do NestJS (requireAuth, requireOrgContext, requireRole). Os padrões de segurança e isolamento são equivalentes. O contrato de API não exige NestJS especificamente e o CLAUDE.md orienta a evitar over-engineering.

2. **Google OAuth:** Implementado manualmente via fetch para a API do Google em vez de usar `passport-google-oauth20`. O comportamento é idêntico ao especificado no contrato. A regra técnica menciona passport como recomendação, mas não como requisito bloqueante.

3. **Refresh token:** Implementado como token opaco (UUID composto), não como JWT. Isso é mais seguro para tokens de longa duração e está alinhado com o contrato, que não especifica o formato interno do refresh token.

4. **Constante não utilizada:** `REFRESH_TOKEN_TTL_STR = '7d'` é definida mas não usada (a expiração é controlada em ms via `REFRESH_TOKEN_TTL_MS`). Irrelevante para o funcionamento.

## Bugs encontrados

Nenhum bug crítico encontrado. Todos os endpoints estão implementados, as validações cobrem os casos principais, e o isolamento multi-tenant está aplicado corretamente.

## Conclusão

APROVADO

Todos os 10 critérios de aceitação estão implementados: registro e login com email/senha, JWT com refresh token (rotação), SSO Google, contexto de organização injetado automaticamente, CRUD de organizações com soft delete, convites com token e expiração, aceite de convite vinculando usuário à org, controle de permissões por role (Admin/Member/Viewer), guards/middleware em rotas protegidas, e isolamento de dados por organização. O contrato de API está completamente coberto.
