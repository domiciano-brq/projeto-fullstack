# Frontend — US-5

## Paginas implementadas

Nenhuma. Esta historia e exclusivamente de backend — nao ha interface de usuario nesta sprint.

## Servicos criados/modificados

Nenhum.

## Arquivos criados/modificados

Nenhum.

## Observacoes

A API contract (tasks/5/US-5-api-contract.md) confirma explicitamente que o agente frontend nao e necessario para esta historia:

> "frontend: nao"
> "A historia e exclusivamente de backend; nao ha interface de usuario nesta sprint (fora do escopo)."

### Notas de integracao futura (para quando o frontend for implementado)

Quando uma interface de usuario for criada em uma sprint futura, o frontend devera:

1. **POST /api/contracts/analyze** — Enviar o arquivo via `multipart/form-data` com o campo `file`. Tratar respostas 202 (pendente ou cache hit), 400 (formato invalido) e 413 (arquivo maior que 10MB).

2. **GET /api/contracts/jobs/:jobId** — Fazer polling deste endpoint apos receber um `jobId` da etapa anterior. Verificar o campo `status` (`pending`, `active`, `failed`, `completed`). Quando `completed`, exibir o `result` com `summary` e a lista de `clauses` (cada uma com `text`, `riskLevel` e `reason`).

3. **GET /api/contracts/search?q=...&limit=...** — Implementar campo de busca semantica. Exibir resultados ordenados por `similarityScore` (decrescente), mostrando `fileName`, `summary` e pontuacao de similaridade.

4. **Tratamento de risco** — A interface deve diferenciar visualmente os niveis de risco `alto`, `medio` e `baixo` nas clausulas retornadas (ex.: cores distintas ou icones).

5. **Tamanho maximo do arquivo** — Validar no frontend que o arquivo nao excede 10MB antes de enviar, para evitar a resposta 413 desnecessariamente.
