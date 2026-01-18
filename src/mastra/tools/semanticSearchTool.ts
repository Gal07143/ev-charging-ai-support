import { createTool } from '@mastra/core';
import { z } from 'zod';
import { getVectorStore } from '../services/vectorStore';
import { logger } from '../utils/logger';

/**
 * Semantic Search Tool for RAG (Retrieval-Augmented Generation)
 * 
 * Searches the knowledge base using semantic similarity to find
 * relevant information for answering user questions.
 * 
 * This tool enables the agent to access a massive knowledge base
 * without hardcoding everything in the prompt.
 */

export const semanticSearchTool = createTool({
  id: 'semantic-search-knowledge-base',
  description: `
Search the Edge Control knowledge base using semantic similarity.
Use this tool to find relevant information about:
- EV charging procedures and troubleshooting
- Station and charger specifications
- App usage and account management
- Payment and billing questions
- Safety procedures and emergency protocols
- Specific charger models and error codes

Always search the knowledge base before answering technical questions.
The knowledge base contains 1500+ lines of information in Hebrew, English, Russian, and Arabic.

Examples of good queries:
- "איך להתחיל טעינה" (how to start charging)
- "ABB Terra 54 error E42"
- "payment declined troubleshooting"
- "RFID card not working"
- "slow charging diagnosis"
  `.trim(),
  
  inputSchema: z.object({
    query: z.string().describe('The search query - can be in any language (Hebrew, English, Russian, Arabic)'),
    maxResults: z.number().min(1).max(10).default(5).describe('Maximum number of results to return (default: 5)'),
  }),

  outputSchema: z.object({
    results: z.array(
      z.object({
        content: z.string(),
        score: z.number(),
        source: z.string(),
        category: z.string(),
        metadata: z.record(z.any()),
      })
    ),
    query: z.string(),
    resultsCount: z.number(),
  }),

  execute: async ({ context, runId, workflowId }, { query, maxResults = 5 }) => {
    try {
      logger.info('Semantic search requested', {
        query,
        maxResults,
        runId,
        workflowId,
      });

      const vectorStore = getVectorStore();

      // Perform semantic search
      const searchResults = await vectorStore.searchWithScores(query, maxResults);

      // Format results
      const results = searchResults.map(([doc, score]) => ({
        content: doc.pageContent,
        score: Math.round(score * 100) / 100, // Round to 2 decimals
        source: doc.metadata.source || 'unknown',
        category: doc.metadata.category || 'general',
        metadata: doc.metadata,
      }));

      logger.info('Semantic search completed', {
        query,
        resultsCount: results.length,
        topScore: results[0]?.score,
      });

      return {
        results,
        query,
        resultsCount: results.length,
      };
    } catch (error) {
      logger.error('Semantic search failed', {
        error,
        query,
        runId,
        workflowId,
      });

      // Return empty results on error (graceful degradation)
      return {
        results: [],
        query,
        resultsCount: 0,
      };
    }
  },
});

export default semanticSearchTool;
