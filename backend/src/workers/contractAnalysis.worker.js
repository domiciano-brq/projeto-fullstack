/**
 * Worker de processamento assincrono de analise de contratos.
 *
 * Em producao: integraria com BullMQ consumindo da fila 'contract-analysis'.
 * Em desenvolvimento (dados em memoria): processa jobs diretamente via setTimeout
 * para simular comportamento assincrono sem dependencias externas.
 *
 * NAO loga conteudo do contrato — apenas jobId e contractHash.
 */

const { jobs, cache, embeddings } = require('../services/inMemoryStore');
const { analyzeContract, generateEmbedding } = require('../services/aiAnalysis');
const { v4: uuidv4 } = require('uuid');

/**
 * Dispara o processamento assincrono de um job de analise.
 * Simula a fila BullMQ com processamento em background via setImmediate.
 *
 * @param {string} jobId         - ID unico do job
 * @param {string} contractHash  - Hash SHA-256 do contrato
 * @param {string} contractText  - Conteudo textual do contrato
 * @param {string} fileName      - Nome original do arquivo
 */
function enqueueAnalysis(jobId, contractHash, contractText, fileName) {
  console.log(`[Worker] Job enfileirado. jobId=${jobId} hash=${contractHash}`);

  // Processa de forma assincrona sem bloquear a resposta HTTP
  setImmediate(() => processJob(jobId, contractHash, contractText, fileName));
}

/**
 * Processa um job de analise de contrato
 */
async function processJob(jobId, contractHash, contractText, fileName) {
  console.log(`[Worker] Iniciando processamento. jobId=${jobId}`);
  jobs.updateStatus(jobId, 'active');

  try {
    const result = await analyzeContract(contractText, jobId, contractHash);

    // Salva no cache Redis simulado para evitar reprocessamento
    cache.set(contractHash, result);

    // Gera e armazena embedding para busca semantica
    const embeddingText = `${result.summary} ${result.clauses.map((c) => c.text).join(' ')}`;
    const embeddingVector = await generateEmbedding(embeddingText);
    const contractId = uuidv4();
    embeddings.store(contractId, fileName, result.summary, embeddingVector);

    jobs.updateStatus(jobId, 'completed', result);
    console.log(`[Worker] Job concluido com sucesso. jobId=${jobId}`);
  } catch (err) {
    console.error(`[Worker] Falha no processamento. jobId=${jobId} erro=${err.message}`);
    jobs.updateStatus(jobId, 'failed', { error: err.message });
  }
}

module.exports = { enqueueAnalysis };
