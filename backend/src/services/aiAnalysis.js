/**
 * Servico de analise de contratos via IA (OpenAI GPT-4o via LangChain).
 * Tambem gera embeddings com text-embedding-ada-002 para busca semantica.
 *
 * NOTA DE SEGURANCA: conteudo sensivel do contrato NAO e logado — apenas hash e jobId.
 */

let openAIAvailable = false;
let ChatOpenAI = null;
let OpenAIEmbeddings = null;

// Tenta carregar dependencias LangChain/OpenAI; falha graciosamente se nao instaladas
try {
  const langchainOpenAI = require('@langchain/openai');
  ChatOpenAI = langchainOpenAI.ChatOpenAI;
  OpenAIEmbeddings = langchainOpenAI.OpenAIEmbeddings;
  openAIAvailable = !!process.env.OPENAI_API_KEY;
} catch (_) {
  // Dependencias nao instaladas — modo simulado ativo
}

/**
 * Analisa o texto de um contrato via GPT-4o e retorna clausulas com risco e resumo.
 * Faz ate 3 tentativas com backoff exponencial para lidar com timeouts.
 *
 * @param {string} contractText  - Texto extraido do contrato (NAO e logado)
 * @param {string} jobId         - ID do job (para logging seguro)
 * @param {string} contractHash  - Hash SHA-256 do contrato (para logging seguro)
 * @returns {Promise<{summary: string, clauses: Array}>}
 */
async function analyzeContract(contractText, jobId, contractHash) {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (openAIAvailable && ChatOpenAI) {
        return await analyzeWithOpenAI(contractText);
      } else {
        return simulateAnalysis(contractText);
      }
    } catch (err) {
      if (attempt === maxRetries) {
        // Log apenas dados nao sensiveis
        console.error(`[AI] Analise falhou apos ${maxRetries} tentativas. jobId=${jobId} hash=${contractHash}`);
        throw err;
      }
      // Backoff exponencial: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.warn(`[AI] Tentativa ${attempt} falhou. Retentando em ${delay}ms. jobId=${jobId}`);
      await sleep(delay);
    }
  }
}

/**
 * Analise real usando GPT-4o via LangChain
 */
async function analyzeWithOpenAI(contractText) {
  const model = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: 0,
    timeout: 30000,
    openAIApiKey: process.env.OPENAI_API_KEY
  });

  const prompt = buildAnalysisPrompt(contractText);
  const response = await model.invoke(prompt);
  return parseAIResponse(response.content);
}

/**
 * Simulacao de analise para ambiente sem chave OpenAI
 */
function simulateAnalysis(contractText) {
  const words = contractText.split(/\s+/).length;

  return {
    summary: `Contrato com aproximadamente ${words} palavras. Analise simulada: documento apresenta estrutura padrao com clausulas de prestacao de servicos, responsabilidades e penalidades. Recomenda-se revisao das clausulas de rescisao e limitacao de responsabilidade.`,
    clauses: [
      {
        text: 'O contratante podera rescindir o contrato a qualquer momento sem aviso previo e sem qualquer ônus.',
        riskLevel: 'alto',
        reason: 'Clausula permite rescisao unilateral imediata sem penalidade, criando desequilibrio contratual e inseguranca juridica para o contratado.'
      },
      {
        text: 'A responsabilidade total das partes e limitada ao valor pago no mes anterior ao evento danoso.',
        riskLevel: 'medio',
        reason: 'Limitacao de responsabilidade pode ser insuficiente para cobrir danos maiores; verifique compatibilidade com a natureza do servico prestado.'
      },
      {
        text: 'O contratado deve entregar os servicos conforme cronograma acordado, sob pena de multa diaria de 2% sobre o valor total.',
        riskLevel: 'baixo',
        reason: 'Multa por atraso dentro de parametros usuais de mercado (2% ao dia). Recomenda-se verificar se ha cap maximo para a multa.'
      }
    ]
  };
}

/**
 * Constroi o prompt para analise de clausulas pelo GPT-4o
 */
function buildAnalysisPrompt(contractText) {
  return [
    {
      role: 'system',
      content: `Voce e um especialista em analise juridica de contratos.
Analise o contrato fornecido e retorne um JSON valido com a seguinte estrutura:
{
  "summary": "Resumo executivo conciso do contrato em 2-3 paragrafos",
  "clauses": [
    {
      "text": "Texto da clausula identificada",
      "riskLevel": "alto | medio | baixo",
      "reason": "Explicacao do nivel de risco identificado"
    }
  ]
}

Criterios de classificacao de risco:
- alto: clausulas abusivas, desequilibrio contratual grave, violacao de direitos legais
- medio: clausulas que merecem atencao e possivel renegociacao
- baixo: clausulas comuns de mercado com pontos menores a observar

Retorne APENAS o JSON, sem texto adicional.`
    },
    {
      role: 'user',
      content: `Analise o seguinte contrato:\n\n${contractText}`
    }
  ];
}

/**
 * Faz parse da resposta do GPT-4o garantindo estrutura correta
 */
function parseAIResponse(content) {
  try {
    // Remove possivel markdown code block
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.summary || !Array.isArray(parsed.clauses)) {
      throw new Error('Estrutura de resposta invalida');
    }

    // Valida e normaliza cada clausula
    parsed.clauses = parsed.clauses.map((clause) => ({
      text: String(clause.text || ''),
      riskLevel: ['alto', 'medio', 'baixo'].includes(clause.riskLevel) ? clause.riskLevel : 'medio',
      reason: String(clause.reason || '')
    }));

    return { summary: String(parsed.summary), clauses: parsed.clauses };
  } catch (_) {
    throw new Error('Falha ao interpretar resposta da IA');
  }
}

/**
 * Gera embedding para um texto usando text-embedding-ada-002
 * Retorna vetor de 1536 dimensoes ou vetor simulado em modo sem OpenAI
 *
 * @param {string} text - Texto para gerar embedding
 * @returns {Promise<number[]>} - Vetor de embedding
 */
async function generateEmbedding(text) {
  if (openAIAvailable && OpenAIEmbeddings) {
    const embedder = new OpenAIEmbeddings({
      modelName: 'text-embedding-ada-002',
      openAIApiKey: process.env.OPENAI_API_KEY
    });
    const [vector] = await embedder.embedDocuments([text]);
    return vector;
  }

  // Vetor simulado deterministico baseado no texto (para testes)
  return simulateEmbedding(text);
}

/**
 * Gera um vetor de embedding simulado deterministico para testes
 * Vetores diferentes para textos diferentes, permitindo busca semantica basica
 */
function simulateEmbedding(text) {
  const vector = new Array(1536).fill(0);
  const chars = text.toLowerCase();

  for (let i = 0; i < chars.length && i < 1536; i++) {
    const charCode = chars.charCodeAt(i);
    vector[i % 1536] += (charCode / 127) * 0.1;
  }

  // Normaliza o vetor
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    return vector.map((v) => v / norm);
  }
  return vector;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { analyzeContract, generateEmbedding };
