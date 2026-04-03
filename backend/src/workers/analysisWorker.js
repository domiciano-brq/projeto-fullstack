'use strict';

/**
 * BullMQ Worker — contract-analysis queue
 *
 * Responsibilities:
 *  1. Read the uploaded file
 *  2. Call OpenAI GPT-4o (via LangChain) to analyse clauses and generate summary
 *  3. Generate an embedding with text-embedding-3-small
 *  4. Save embedding to PostgreSQL (pgvector)
 *  5. Cache the result in Redis
 *  6. Update the analysis status record in Redis
 */

const fs = require('fs');
const path = require('path');
const { Worker } = require('bullmq');
const { ChatOpenAI, OpenAIEmbeddings } = require('@langchain/openai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

const { redisClient, setCachedResult, setAnalysisStatus, getAnalysisStatus } = require('../services/redis');
const { saveEmbedding, ensureSchema } = require('../services/db');

const QUEUE_NAME = 'contract-analysis';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const chatModel = new ChatOpenAI({
  modelName: 'gpt-4o',
  temperature: 0,
  openAIApiKey: OPENAI_API_KEY,
});

const embeddingsModel = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small',
  openAIApiKey: OPENAI_API_KEY,
});

/**
 * Extract plain text from a file depending on its MIME type.
 * Currently handles TXT natively; PDF/DOCX extraction requires optional deps.
 */
async function extractText(filePath, mimeType) {
  if (mimeType === 'text/plain') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  if (mimeType === 'application/pdf') {
    try {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    } catch {
      throw new Error('Falha ao extrair texto do PDF. Certifique-se de que pdf-parse esta instalado.');
    }
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch {
      throw new Error('Falha ao extrair texto do DOCX. Certifique-se de que mammoth esta instalado.');
    }
  }

  throw new Error(`Tipo MIME nao suportado para extracao de texto: ${mimeType}`);
}

/**
 * Call GPT-4o to analyse the contract text.
 * Returns { summary, clauses[] }
 */
async function analyseWithGPT4o(contractText) {
  const systemPrompt = `Voce e um especialista juridico analisando contratos em PT-BR ou EN.
Sua tarefa e:
1. Gerar um resumo executivo claro e acessivel do contrato.
2. Identificar clausulas com risco juridico ou financeiro ao usuario.

Responda EXCLUSIVAMENTE em JSON valido com o seguinte schema:
{
  "summary": "<resumo executivo em linguagem clara>",
  "clauses": [
    {
      "clauseIndex": <numero inteiro sequencial>,
      "text": "<trecho exato da clausula>",
      "riskLevel": "alto" | "medio" | "baixo",
      "explanation": "<explicacao clara e acionavel do risco>"
    }
  ]
}

Inclua apenas clausulas que representam risco real. Se nao houver clausulas de risco, retorne array vazio.`;

  const userPrompt = `Contrato para analise:\n\n${contractText.slice(0, 40000)}`;

  const response = await chatModel.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  const content = response.content.trim();

  // Strip markdown code fences if present
  const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error('Resposta da IA nao e JSON valido: ' + content.slice(0, 200));
  }
}

async function processJob(job) {
  const { analysisId, filePath, fileHash, mimeType, fileName } = job.data;

  const updateStatus = async (statusObj) => {
    await setAnalysisStatus(analysisId, statusObj);
    await job.updateProgress(statusObj.progress || 0);
  };

  try {
    await updateStatus({ status: 'processing', progress: 10, result: null, error: null });

    // 1. Extract text
    const contractText = await extractText(filePath, mimeType);
    await updateStatus({ status: 'processing', progress: 30, result: null, error: null });

    // 2. GPT-4o analysis
    const { summary, clauses } = await analyseWithGPT4o(contractText);
    await updateStatus({ status: 'processing', progress: 70, result: null, error: null });

    // 3. Generate embedding
    const [embedding] = await embeddingsModel.embedDocuments([summary]);
    await updateStatus({ status: 'processing', progress: 85, result: null, error: null });

    // 4. Save embedding to pgvector
    const processedAt = new Date().toISOString();
    await saveEmbedding({
      analysisId,
      fileName: fileName || path.basename(filePath),
      summary,
      embedding,
      analyzedAt: processedAt,
    });

    // 5. Build result object
    const result = {
      summary,
      clauses,
      embeddingsSaved: true,
      processedAt,
    };

    // 6. Cache result
    await setCachedResult(fileHash, result);

    // 7. Mark completed
    await updateStatus({ status: 'completed', progress: 100, result, error: null });

    console.log(`[Worker] Analysis ${analysisId} completed.`);

    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  } catch (err) {
    console.error(`[Worker] Analysis ${analysisId} failed:`, err.message);
    await setAnalysisStatus(analysisId, {
      status: 'failed',
      progress: 0,
      result: null,
      error: err.message,
    });
    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    throw err; // Re-throw so BullMQ marks the job as failed
  }
}

function startWorker() {
  ensureSchema()
    .then(() => console.log('[Worker] DB schema ensured.'))
    .catch((err) => console.warn('[Worker] Could not ensure DB schema:', err.message));

  const worker = new Worker(QUEUE_NAME, processJob, {
    connection: redisClient,
    concurrency: 2,
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

module.exports = { startWorker };
