'use strict';

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redisClient.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

/**
 * Get a cached analysis result by file hash.
 * Key pattern: analysis:cache:<sha256>
 */
async function getCachedResult(fileHash) {
  const raw = await redisClient.get(`analysis:cache:${fileHash}`);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Store a completed analysis result in cache (no TTL — manual invalidation).
 */
async function setCachedResult(fileHash, result) {
  await redisClient.set(`analysis:cache:${fileHash}`, JSON.stringify(result));
}

/**
 * Get the current status record of an analysis by analysisId.
 * Key pattern: analysis:status:<analysisId>
 */
async function getAnalysisStatus(analysisId) {
  const raw = await redisClient.get(`analysis:status:${analysisId}`);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Set (or update) the status record for an analysis.
 */
async function setAnalysisStatus(analysisId, statusObj) {
  await redisClient.set(`analysis:status:${analysisId}`, JSON.stringify(statusObj));
}

module.exports = {
  redisClient,
  getCachedResult,
  setCachedResult,
  getAnalysisStatus,
  setAnalysisStatus,
};
