import { Mastra } from '@mastra/core';
import { edgeControlAgent } from './agents/edgeControlAgent';
import { edgeControlWorkflow } from './workflows/edgeControlWorkflow';
import { inngest } from './inngest';
import { memory, testDatabaseConnection, initializeDatabase } from './storage';
import { logger } from '../utils/logger';

// Initialize Mastra
export const mastra = new Mastra({
  agents: {
    edgeControlAgent,
  },
  workflows: {
    edgeControlWorkflow,
  },
  integrations: [],
  memory,
});

// Initialize system
export async function initializeMastra() {
  try {
    logger.info('🚀 Initializing Edge Control Support System...');

    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Initialize database schema
    await initializeDatabase();

    logger.info('✅ Mastra initialized successfully');
    logger.info({ agents: Object.keys(mastra.agents || {}) }, 'Registered agents');
    logger.info({ workflows: Object.keys(mastra.workflows || {}) }, 'Registered workflows');

    return mastra;
  } catch (error) {
    logger.error({ error }, '❌ Failed to initialize Mastra');
    throw error;
  }
}

// Export for use in other modules
export { edgeControlAgent, edgeControlWorkflow, inngest };
