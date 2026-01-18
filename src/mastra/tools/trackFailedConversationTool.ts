import { createTool } from '@mastra/core';
import { z } from 'zod';
import { pgPool } from '../storage';

export const trackFailedConversationTool = createTool({
  id: 'track-failed-conversation',
  description: 'Log a conversation that requires human agent intervention. Use when customer is frustrated, problem cannot be solved, or escalation is needed.',
  inputSchema: z.object({
    threadId: z.string().describe('Conversation thread ID'),
    userId: z.string().describe('User/customer ID'),
    issueDescription: z.string().describe('Brief description of the issue'),
    conversationContext: z.object({
      stationNumber: z.string().optional(),
      problemType: z.string().optional(),
      frustrationLevel: z.enum(['low', 'medium', 'high']).optional(),
      attemptsCount: z.number().optional(),
    }).optional().describe('Additional context about the conversation'),
  }),
  execute: async ({ context }) => {
    try {
      const { threadId, userId, issueDescription, conversationContext } = context;

      const client = await pgPool.connect();
      
      await client.query(
        `INSERT INTO failed_conversations 
         (thread_id, user_id, issue_description, conversation_context) 
         VALUES ($1, $2, $3, $4)`,
        [threadId, userId, issueDescription, JSON.stringify(conversationContext || {})]
      );

      client.release();

      return {
        success: true,
        message: 'Issue logged for human agent follow-up',
        ticketId: `EC-${Date.now()}`,
      };
    } catch (error) {
      console.error('Track failed conversation tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to log issue',
      };
    }
  },
});
