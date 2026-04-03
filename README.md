# ContractIQ

Monorepo for the ContractIQ platform.

## Structure

```
apps/
  api/        # Backend Node/TypeScript API (Express)
  web/        # Frontend application
packages/
  shared/     # Shared types and utilities
docker-compose.yml
.env.example
turbo.json
```

## Prerequisites

- Node.js >= 20
- npm >= 10
- Docker and Docker Compose

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd contractiq
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your local values if needed.

### 3. Start infrastructure services

```bash
docker compose up -d
```

This starts PostgreSQL (port 5432) and Redis (port 6379).

### 4. Install dependencies

```bash
npm install
```

### 5. Run the API in development mode

```bash
npm run dev --workspace=apps/api
```

Or run all apps:

```bash
npm run dev
```

### 6. Build all packages

```bash
npm run build
```

## Scripts

| Command            | Description                          |
|--------------------|--------------------------------------|
| `npm run dev`      | Start all apps in development mode   |
| `npm run build`    | Build all packages                   |
| `npm run lint`     | Lint all packages                    |
| `npm run type-check` | Type-check all packages            |
| `npm run format`   | Format code with Prettier            |

## Environment Variables

See `.env.example` for all required environment variables:

| Variable       | Description                          | Example                                              |
|----------------|--------------------------------------|------------------------------------------------------|
| `NODE_ENV`     | Runtime environment                  | `development`                                        |
| `PORT`         | API server port                      | `3000`                                               |
| `DATABASE_URL` | PostgreSQL connection string         | `postgresql://contractiq:contractiq@localhost:5432/contractiq` |
| `REDIS_URL`    | Redis connection string              | `redis://localhost:6379`                             |

## Services

| Service    | Port | Description       |
|------------|------|-------------------|
| API        | 3000 | Express REST API  |
| PostgreSQL | 5432 | Primary database  |
| Redis      | 6379 | Cache / queues    |
