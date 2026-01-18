import { Mastra } from '@mastra/core';
import { edgeControlAgent } from './agents/edgeControlAgent';
import { edgeControlWorkflow } from './workflows/edgeControlWorkflow';
import { inngest } from './inngest';
import { memory, testDatabaseConnection, initializeDatabase } from './storage';

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
    console.log('🚀 Initializing Edge Control Support System...');

    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Initialize database schema
    await initializeDatabase();

    console.log('✅ Mastra initialized successfully');
    console.log('📋 Registered agents:', Object.keys(mastra.agents || {}).join(', '));
    console.log('🔄 Registered workflows:', Object.keys(mastra.workflows || {}).join(', '));

    return mastra;
  } catch (error) {
    console.error('❌ Failed to initialize Mastra:', error);
    throw error;
  }
}

// Export for use in other modules
export { edgeControlAgent, edgeControlWorkflow, inngest };
