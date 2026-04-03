'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/contracts',
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Ensure the contract_embeddings table exists (with pgvector extension).
 * Runs at worker startup.
 */
async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS contract_embeddings (
        analysis_id  UUID PRIMARY KEY,
        file_name    TEXT NOT NULL,
        summary      TEXT NOT NULL,
        embedding    vector(1536) NOT NULL,
        analyzed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS contract_embeddings_vector_idx
      ON contract_embeddings
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
  } finally {
    client.release();
  }
}

/**
 * Save embedding data for a completed analysis.
 */
async function saveEmbedding({ analysisId, fileName, summary, embedding, analyzedAt }) {
  const vectorStr = `[${embedding.join(',')}]`;
  await pool.query(
    `INSERT INTO contract_embeddings (analysis_id, file_name, summary, embedding, analyzed_at)
     VALUES ($1, $2, $3, $4::vector, $5)
     ON CONFLICT (analysis_id) DO UPDATE
       SET file_name   = EXCLUDED.file_name,
           summary     = EXCLUDED.summary,
           embedding   = EXCLUDED.embedding,
           analyzed_at = EXCLUDED.analyzed_at`,
    [analysisId, fileName, summary, vectorStr, analyzedAt]
  );
}

/**
 * Semantic search: returns up to `limit` contracts ordered by cosine similarity.
 * @param {number[]} queryEmbedding - 1536-dim vector
 * @param {number} limit
 */
async function semanticSearch(queryEmbedding, limit) {
  const vectorStr = `[${queryEmbedding.join(',')}]`;
  const { rows } = await pool.query(
    `SELECT
       analysis_id,
       file_name,
       summary,
       analyzed_at,
       1 - (embedding <=> $1::vector) AS similarity
     FROM contract_embeddings
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vectorStr, limit]
  );
  return rows;
}

module.exports = { pool, ensureSchema, saveEmbedding, semanticSearch };
