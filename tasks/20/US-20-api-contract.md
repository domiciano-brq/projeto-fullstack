# API Contract — US-20

## Agentes necessarios
- backend: sim
- frontend: sim

## Endpoints

Nenhum endpoint novo e criado nesta historia.

Esta historia e de manutencao: os agentes Backend e Frontend devem inspecionar o codigo existente que sofreu merge conflicts nos ultimos 3 PRs e corrigir duplicacoes, inconsistencias e quebras introduzidas. Nenhuma rota nova e adicionada.

### Acoes esperadas por agente

**Backend**
- Revisar arquivos de rotas, controllers, services e models afetados pelos merges
- Remover duplicacoes de handlers, middlewares ou logica de negocio
- Garantir que cada endpoint existente responde com o contrato correto (status codes, body shape)
- Validar que imports duplicados ou conflitantes foram removidos

**Frontend**
- Revisar componentes, hooks e chamadas de API afetados pelos merges
- Remover duplicacoes de componentes ou logica de estado
- Garantir que as chamadas aos endpoints existentes usam os parametros e paths corretos
- Validar que nao ha renders duplicados ou conflito de estilos introduzidos pelo merge

## Dados em memoria

Nenhuma estrutura nova e introduzida. Manter as estruturas de dados ja existentes sem duplicacao.

## Observacoes

- Esta historia nao adiciona nenhuma feature nova; o escopo e exclusivamente corretivo
- Ao encontrar um bloco duplicado (ex.: duas definicoes da mesma rota ou componente), manter apenas a versao mais recente e funcional
- Documentar no proprio codigo (comentario inline ou commit message) qual trecho foi removido e por que
- Criterio de conclusao: repositorio sem blocos duplicados, sem conflitos pendentes e com todos os fluxos principais operacionais
