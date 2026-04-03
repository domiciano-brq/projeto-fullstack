# Frontend Report — US-3

## Avaliacao

Esta issue (KAN-3) e focada exclusivamente em infraestrutura de backend: autenticacao JWT, SSO Google,
guards NestJS, gestao de organizacoes e controle de permissoes por role.

## Por que nao ha implementacao frontend nesta issue

1. **Sem projeto frontend no repositorio:** Nao existe diretorio `frontend/` nem projeto Angular no
   repositorio. Nao ha `app.routes.ts`, componentes ou servicos Angular para registrar ou modificar.

2. **Issue de backend puro:** O escopo da US-3 e implementar a camada de autenticacao no NestJS
   (endpoints, guards, decorators, tokens JWT, OAuth Google). As paginas de login, registro e
   gerenciamento de organizacao sao responsabilidade de uma issue de frontend dedicada, que consumira
   os endpoints definidos no contrato de API.

3. **Contrato de API define interface, nao UI:** O arquivo `US-3-api-contract.md` descreve os endpoints
   REST que o backend deve expor. Embora indique `frontend: sim`, isso significa que o frontend
   precisara consumir estes endpoints — nao que os componentes Angular devam ser criados nesta issue.

4. **Ausencia de artefatos de UI:** Nao existem artefatos de especificacao de frontend (`US-3-spec.md`,
   `US-3-prd.md` com detalhes de UI, referencias Figma) nesta issue que justifiquem implementacao
   de paginas Angular.

## O que o frontend precisara implementar (issue futura)

Quando o projeto frontend Angular for criado, as seguintes paginas devem ser implementadas
consumindo os endpoints desta issue:

| Pagina / Componente          | Endpoints consumidos                          |
|------------------------------|-----------------------------------------------|
| Pagina de Signup             | `POST /api/auth/signup`                       |
| Pagina de Login              | `POST /api/auth/login`, `GET /api/auth/google`|
| Callback OAuth Google        | `GET /api/auth/google/callback`               |
| Perfil do usuario (`/me`)    | `GET /api/me`                                 |
| Criar organizacao            | `POST /api/organizations`                     |
| Editar organizacao           | `PATCH /api/organizations/:id`                |
| Listar membros               | `GET /api/organizations/:id/members`          |
| Convidar membro              | `POST /api/organizations/:id/invites`         |
| Aceitar convite              | `POST /api/invites/:token/accept`             |

## Conclusao

Nenhuma implementacao frontend e realizada nesta issue. O trabalho desta issue e 100% backend.
A issue de frontend correspondente devera ser criada separadamente, com artefatos de UI proprios,
assim que o projeto Angular for inicializado no repositorio.
