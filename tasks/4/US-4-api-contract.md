# API Contract — US-4

## Agentes necessarios
- backend: nao
- frontend: nao

## Endpoints

Nenhum endpoint novo e introduzido nesta historia. US-4 trata exclusivamente da configuracao de infraestrutura (monorepo, Docker Compose, ferramentas de qualidade de codigo e ambiente de desenvolvimento local).

## Dados em memoria

Nao aplicavel. Nenhuma estrutura de dados de runtime e definida nesta historia.

## Observacoes

- Esta historia e de setup de infraestrutura, sem logica de negocio ou API.
- A estrutura de pastas esperada apos a conclusao sera:
  ```
  apps/
    api/        # Backend Node/TypeScript (futuras APIs serao definidas aqui)
    web/        # Frontend (React ou similar)
  packages/
    shared/     # Tipos e utilitarios compartilhados entre apps
  docker-compose.yml
  .env.example
  turbo.json (ou nx.json)
  ```
- Os servicos Docker Compose esperados sao: PostgreSQL e Redis.
- Variaveis de ambiente a documentar no `.env.example` (sem valores reais):
  - `DATABASE_URL` — connection string do PostgreSQL
  - `REDIS_URL` — connection string do Redis
  - `NODE_ENV` — ambiente de execucao (`development` | `production` | `test`)
  - `PORT` — porta da API (ex: `3000`)
- Nenhum agente de backend ou frontend precisa ser acionado para esta historia; apenas o agente de infraestrutura/DevOps e necessario.
- Decisoes arquiteturais devem ser registradas em `docs/adr/` conforme convencao do CLAUDE.md.
