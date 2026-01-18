import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { Document } from '@langchain/core/documents';
import { logger } from '../utils/logger';

/**
 * Vector Store Service using Pinecone
 * 
 * Provides semantic search capabilities for the knowledge base
 * using OpenAI embeddings and Pinecone vector database.
 */

export class VectorStoreService {
  private pinecone: Pinecone;
  private embeddings: OpenAIEmbeddings;
  private indexName: string;
  private namespace: string;

  constructor() {
    // Initialize Pinecone client
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || '',
    });

    // Initialize OpenAI embeddings
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      modelName: 'text-embedding-3-large', // 3072 dimensions, best quality
    });

    this.indexName = process.env.PINECONE_INDEX_NAME || 'edge-control-kb';
    this.namespace = process.env.PINECONE_NAMESPACE || 'default';

    logger.info('VectorStoreService initialized', {
      indexName: this.indexName,
      namespace: this.namespace,
    });
  }

  /**
   * Initialize Pinecone index (create if doesn't exist)
   */
  async initialize(): Promise<void> {
    try {
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(
        (index) => index.name === this.indexName
      );

      if (!indexExists) {
        logger.info('Creating Pinecone index...', { indexName: this.indexName });
        
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 3072, // text-embedding-3-large dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1',
            },
          },
        });

        logger.info('Pinecone index created', { indexName: this.indexName });
        
        // Wait for index to be ready
        await this.waitForIndexReady();
      } else {
        logger.info('Pinecone index already exists', { indexName: this.indexName });
      }
    } catch (error) {
      logger.error('Failed to initialize Pinecone index', { error });
      throw error;
    }
  }

  /**
   * Wait for Pinecone index to be ready
   */
  private async waitForIndexReady(): Promise<void> {
    logger.info('Waiting for index to be ready...');
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      try {
        const index = this.pinecone.Index(this.indexName);
        const stats = await index.describeIndexStats();
        
        if (stats) {
          logger.info('Index is ready', { stats });
          return;
        }
      } catch (error) {
        // Index not ready yet
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Timeout waiting for Pinecone index to be ready');
  }

  /**
   * Add documents to vector store
   */
  async addDocuments(documents: Document[]): Promise<void> {
    try {
      const index = this.pinecone.Index(this.indexName);

      const vectorStore = await PineconeStore.fromDocuments(
        documents,
        this.embeddings,
        {
          pineconeIndex: index,
          namespace: this.namespace,
        }
      );

      logger.info('Documents added to vector store', {
        count: documents.length,
        namespace: this.namespace,
      });

      return;
    } catch (error) {
      logger.error('Failed to add documents', { error });
      throw error;
    }
  }

  /**
   * Semantic search for relevant documents
   */
  async search(query: string, topK: number = 5): Promise<Document[]> {
    try {
      const index = this.pinecone.Index(this.indexName);

      const vectorStore = await PineconeStore.fromExistingIndex(
        this.embeddings,
        {
          pineconeIndex: index,
          namespace: this.namespace,
        }
      );

      // Perform similarity search
      const results = await vectorStore.similaritySearch(query, topK);

      logger.info('Semantic search completed', {
        query,
        resultsCount: results.length,
      });

      return results;
    } catch (error) {
      logger.error('Semantic search failed', { error, query });
      throw error;
    }
  }

  /**
   * Semantic search with scores
   */
  async searchWithScores(
    query: string,
    topK: number = 5
  ): Promise<[Document, number][]> {
    try {
      const index = this.pinecone.Index(this.indexName);

      const vectorStore = await PineconeStore.fromExistingIndex(
        this.embeddings,
        {
          pineconeIndex: index,
          namespace: this.namespace,
        }
      );

      // Perform similarity search with scores
      const results = await vectorStore.similaritySearchWithScore(query, topK);

      logger.info('Semantic search with scores completed', {
        query,
        resultsCount: results.length,
        scores: results.map(([_, score]) => score),
      });

      return results;
    } catch (error) {
      logger.error('Semantic search with scores failed', { error, query });
      throw error;
    }
  }

  /**
   * Delete all documents from namespace
   */
  async deleteNamespace(): Promise<void> {
    try {
      const index = this.pinecone.Index(this.indexName);
      await index.namespace(this.namespace).deleteAll();

      logger.info('Namespace cleared', { namespace: this.namespace });
    } catch (error) {
      logger.error('Failed to delete namespace', { error });
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getStats() {
    try {
      const index = this.pinecone.Index(this.indexName);
      const stats = await index.describeIndexStats();

      logger.info('Index stats retrieved', { stats });
      return stats;
    } catch (error) {
      logger.error('Failed to get index stats', { error });
      throw error;
    }
  }
}

// Singleton instance
let vectorStoreInstance: VectorStoreService | null = null;

export function getVectorStore(): VectorStoreService {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStoreService();
  }
  return vectorStoreInstance;
}
