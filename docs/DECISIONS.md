# Decisoes Arquiteturais

---

## 2026-04-03 — US-5: Pipeline de analise de contratos com IA

### Contexto
Necessidade de implementar pipeline assincrono para analise de contratos via IA (GPT-4o), com cache de resultados, busca semantica e processamento via fila.

### Decisoes

#### 1. Dados em memoria como abstracao de producao
**Decisao:** Implementar stores em memoria (`inMemoryStore.js`) que simulam Redis (cache), BullMQ (fila) e pgvector (embeddings), em vez de depender de servicos externos.

**Racional:** Seguindo a convencao "Dados em memoria — sem banco" do CLAUDE.md e evitando over-engineering. Em producao, os modulos de store podem ser substituidos por clientes reais (ioredis, bullmq, pgvector) sem alterar o contrato das interfaces.

**Trade-offs:** Perda de persistencia entre reinicializacoes do servidor; adequado para desenvolvimento e testes.

---

#### 2. Modo simulado para IA quando OPENAI_API_KEY ausente
**Decisao:** O servico de IA (`aiAnalysis.js`) detecta automaticamente a ausencia da chave OpenAI e ativa um modo simulado com respostas deterministicas.

**Racional:** Permite desenvolvimento e testes sem custo de API e sem dependencia de conectividade externa. A estrutura de resposta e identica ao modo real, garantindo compatibilidade.

**Trade-offs:** Analise simulada nao reflete qualidade da IA real; adequado apenas para desenvolvimento.

---

#### 3. Processamento assincrono via setImmediate (simulando BullMQ)
**Decisao:** O processamento assincrono dos jobs usa `setImmediate` em vez de um worker BullMQ real.

**Racional:** Elimina dependencia de Redis/BullMQ em desenvolvimento, mantendo o comportamento assincrono. O endpoint retorna 202 imediatamente enquanto o processamento ocorre em background. Em producao, substituir por `Queue` e `Worker` do BullMQ.

**Trade-offs:** Sem persistencia de jobs entre reinicializacoes; sem retry real entre processos separados.

---

#### 4. Hash SHA-256 como chave de cache
**Decisao:** A chave de cache no Redis e `contract:analysis:<sha256-hex>` onde o hash e calculado sobre o buffer binario do arquivo.

**Racional:** Garante que contratos identicos (mesmo conteudo, independente do nome do arquivo) nao sejam reprocessados. Hash deterministico e eficiente como chave de cache.

---

#### 5. Similaridade de cosseno para busca semantica
**Decisao:** A busca semantica usa similaridade de cosseno entre vetores de embedding.

**Racional:** Distancia por cosseno e o metodo padrao para embeddings de texto (incluindo text-embedding-ada-002), capturando similaridade semantica independentemente da magnitude dos vetores. Alinhado com a especificacao pgvector do contrato de API.

---

#### 6. Validacao de tamanho antes de qualquer processamento
**Decisao:** A validacao do limite de 10MB ocorre no controller antes de extrair ou processar o conteudo do arquivo.

**Racional:** Previne alocacao de memoria e processamento desnecessarios para arquivos invalidos. O limite tambem e configurado no multer como camada adicional de protecao.

---

#### 7. Nao logging de conteudo sensivel
**Decisao:** Logs nunca incluem o conteudo textual do contrato; apenas `jobId` e `contractHash` sao registrados.

**Racional:** Contratos podem conter informacoes juridicas e comerciais confidenciais. Seguindo a regra tecnica da US-5: "Nao armazenar conteudo sensivel em logs".
