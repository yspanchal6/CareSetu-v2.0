// ai-rag.service.js
// Lexical TF-IDF Vector Search & Retrieval-Augmented Generation (RAG) Service with Cosine Similarity & Relevance Score Filtering.

const fs = require('fs');
const path = require('path');
const { SYNONYM_MAP } = require('./ai-nlp.service');

const KNOWLEDGE_PATH = path.join(__dirname, '../data/medical-knowledge.json');
let knowledgeDocs = [];

try {
  const rawData = fs.readFileSync(KNOWLEDGE_PATH, 'utf8');
  knowledgeDocs = JSON.parse(rawData);
} catch (err) {
  console.error('[AI-RAG] Failed to load medical knowledge base:', err.message);
  knowledgeDocs = [];
}

/**
 * Tokenize and normalize text into a frequency map of terms with synonym expansion.
 */
function tokenize(text) {
  if (!text) return {};

  let lower = text.toLowerCase();
  for (const [syn, target] of Object.entries(SYNONYM_MAP || {})) {
    if (lower.includes(syn)) {
      lower = lower.replace(new RegExp(syn, 'g'), target);
    }
  }

  const words = lower
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const freq = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }
  return freq;
}

/**
 * Compute Cosine Similarity between two term frequency vectors.
 */
function cosineSimilarity(vecA, vecB) {
  const termsA = Object.keys(vecA);
  const termsB = Object.keys(vecB);
  if (termsA.length === 0 || termsB.length === 0) return 0;

  let dotProduct = 0;
  for (const term of termsA) {
    if (vecB[term]) {
      dotProduct += vecA[term] * vecB[term];
    }
  }

  let magA = 0;
  for (const val of Object.values(vecA)) magA += val * val;
  magA = Math.sqrt(magA);

  let magB = 0;
  for (const val of Object.values(vecB)) magB += val * val;
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (magA * magB);
}

/**
 * Retrieve the most relevant medical knowledge chunk using Lexical TF-IDF Cosine Similarity.
 * Enforces relevance threshold filtering (default score >= 0.25).
 * Sanitizes retrieved context against prompt injection inside reference text.
 */
function retrieveRAGContext(query, minScoreThreshold = 0.25, docsOverride = null) {
  const activeDocs = docsOverride || knowledgeDocs;

  if (!query || typeof query !== 'string' || !activeDocs || activeDocs.length === 0) {
    return { context: null, ragUsed: false, score: 0, docId: null, engineType: 'Lexical TF-IDF Vector Search' };
  }

  const queryVec = tokenize(query);
  let bestDoc = null;
  let bestScore = 0;

  for (const doc of activeDocs) {
    const docText = `${doc.title} ${doc.content} ${(doc.keywords || []).join(' ')}`;
    const docVec = tokenize(docText);
    const score = cosineSimilarity(queryVec, docVec);

    if (score > bestScore) {
      bestScore = score;
      bestDoc = doc;
    }
  }

  // Relevance filtering: reject if score is below the threshold
  if (!bestDoc || bestScore < minScoreThreshold) {
    return {
      context: null,
      ragUsed: false,
      score: parseFloat(bestScore.toFixed(4)),
      docId: null,
      engineType: 'Lexical TF-IDF Vector Search',
    };
  }

  // Prompt Injection Sanitization on retrieved content
  let sanitizedContent = bestDoc.content.replace(/ignore\s+previous\s+instructions/gi, '[sanitized]');
  sanitizedContent = sanitizedContent.replace(/system\s+override/gi, '[sanitized]');

  return {
    context: `[Reference Document: ${bestDoc.title} (${bestDoc.source})]\n${sanitizedContent}`,
    ragUsed: true,
    score: parseFloat(bestScore.toFixed(4)),
    docId: bestDoc.id,
    title: bestDoc.title,
    engineType: 'Lexical TF-IDF Vector Search',
  };
}

module.exports = {
  retrieveRAGContext,
  cosineSimilarity,
  tokenize,
};
