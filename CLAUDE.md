# CLAUDE.md

## Stack e Tecnologias

Informacoes de stack nao puderam ser inferidas — apenas o diretorio `docs/` foi fornecido na arvore do repositorio.

## Estrutura de Pastas

docs/    # Documentacao do projeto
## Comandos

Nenhum `package.json` ou script detectado. Verifique se existe um arquivo de configuracao na raiz do repositorio.

## Convencoes

- Documentacao centralizada em `docs/`
- Mantenha arquivos de documentacao atualizados junto com o codigo
- Decisoes arquiteturais devem ser registradas em `docs/` com data e contexto

## Boas Praticas

- Adicione um `README.md` na raiz com instrucoes de instalacao, execucao e testes
- Documente decisoes arquiteturais em `docs/adr/` (Architecture Decision Records)
- Mantenha um `CHANGELOG.md` para rastrear mudancas entre versoes
- Nao commitar segredos, credenciais ou arquivos `.env` — use `.env.example` como referencia
- Prefira solucoes simples e diretas; evite over-engineering
- Valide inputs nas bordas do sistema (entrada do usuario, APIs externas)

## Squad Workflow

This workspace is being operated by a squad of AI agents.

Pipeline:
1. Product Owner
2. Tech Lead
3. Dev Backend + Dev Frontend (parallel)
4. QA
5. PR

Flow: Product Owner → Tech Lead → [Dev Backend | Dev Frontend] → QA → PR
