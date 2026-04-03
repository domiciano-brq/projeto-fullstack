/**
 * In-memory stores para substituir Redis, BullMQ e pgvector em ambiente de desenvolvimento.
 * Seguindo a convencao "Dados em memoria — sem banco" conforme CLAUDE.md e API contract.
 */

// Simula cache Redis: chave = contract:analysis:<sha256-hex>, valor = resultado da analise
const redisCache = new Map();

// Simula fila BullMQ: jobs indexados por jobId
const jobQueue = new Map();

// Simula tabela pgvector contract_embeddings para busca semantica
const contractEmbeddings = [];

/**
 * Cache Redis simulado
 */
const cache = {
  get(hash) {
    const key = `contract:analysis:${hash}`;
    return redisCache.get(key) || null;
  },

  set(hash, result) {
    const key = `contract:analysis:${hash}`;
    redisCache.set(key, result);
  }
};

/**
 * Fila de jobs simulada (BullMQ)
 */
const jobs = {
  /**
   * Cria um novo job e retorna seu ID
   */
  create(jobId, contractHash, contractText, fileName) {
    const job = {
      jobId,
      contractHash,
      contractText,
      fileName,
      status: 'pending',
      result: null,
      createdAt: new Date().toISOString()
    };
    jobQueue.set(jobId, job);
    return job;
  },

  get(jobId) {
    return jobQueue.get(jobId) || null;
  },

  updateStatus(jobId, status, result = null) {
    const job = jobQueue.get(jobId);
    if (job) {
      job.status = status;
      if (result !== null) {
        job.result = result;
      }
      jobQueue.set(jobId, job);
    }
  }
};

/**
 * Armazenamento de embeddings simulado (pgvector)
 * Embeddings reais requerem OpenAI; aqui usamos representacao simplificada para busca.
 */
const embeddings = {
  /**
   * Armazena embedding de um contrato apos analise
   */
  store(contractId, fileName, summary, embeddingVector) {
    contractEmbeddings.push({
      contractId,
      fileName,
      summary,
      embedding: embeddingVector,
      createdAt: new Date().toISOString()
    });
  },

  /**
   * Busca semantica por similaridade de cosseno
   * Retorna resultados ordenados do mais similar ao menos similar
   */
  search(queryEmbedding, limit = 10) {
    if (contractEmbeddings.length === 0) {
      return [];
    }

    const scored = contractEmbeddings.map((entry) => {
      const score = cosineSimilarity(queryEmbedding, entry.embedding);
      return {
        contractId: entry.contractId,
        similarityScore: parseFloat(score.toFixed(4)),
        summary: entry.summary,
        fileName: entry.fileName
      };
    });

    // Ordena por similaridade decrescente
    scored.sort((a, b) => b.similarityScore - a.similarityScore);

    return scored.slice(0, limit);
  }
};

/**
 * Calcula similaridade de cosseno entre dois vetores numericos
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

module.exports = { cache, jobs, embeddings };
