'use strict';

const { Queue } = require('bullmq');
const { redisClient } = require('./redis');

const QUEUE_NAME = 'contract-analysis';

const analysisQueue = new Queue(QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

/**
 * Enqueue a contract analysis job.
 * @param {object} payload - { analysisId, filePath, fileHash, mimeType }
 */
async function enqueueAnalysis(payload) {
  const job = await analysisQueue.add('analyze', payload, {
    jobId: payload.analysisId,
  });
  return job;
}

module.exports = { analysisQueue, enqueueAnalysis };
