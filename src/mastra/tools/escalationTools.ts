/**
 * Escalation Tools for Mastra Agent
 * Tools for detecting and handling escalations
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { escalationService, EscalationContext, ConversationMessage } from '../../services/escalationService';
import logger from '../../utils/logger';

/**
 * Tool: Check if conversation should be escalated
 */
export const checkEscalationTool = createTool({
  id: 'checkEscalation',
  name: 'Check Escalation',
  description: `
    Check if the current conversation should be escalated to a human agent.
    
    Use this tool when:
    - User explicitly asks for human help
    - Conversation is going in circles (15+ messages)
    - User expresses frustration or anger
    - Safety concerns are mentioned (fire, smoke, injury)
    - Technical issues persist after troubleshooting
    - Payment/billing issues arise
    
    The tool analyzes multiple factors:
    - Explicit escalation requests
    - Negative sentiment patterns
    - Conversation length and complexity
    - Safety keywords
    - Repeated issues
    - Workflow failures
    
    Returns:
    - shouldEscalate: boolean
    - triggers: array of reasons
    - urgencyLevel: low/medium/high/critical
    - recommendedAction: what to do next
  `,
  inputSchema: z.object({
    userId: z.string().describe('Discord user ID'),
    username: z.string().describe('Discord username'),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      timestamp: z.string().describe('ISO 8601 timestamp'),
      sentiment: z.string().optional(),
      sentimentScore: z.number().optional()
    })).describe('Full conversation history'),
    conversationDuration: z.number().describe('Conversation duration in seconds'),
    stationsInvolved: z.array(z.string()).default([]).describe('Station IDs mentioned'),
    errorsEncountered: z.array(z.string()).default([]).describe('Error codes encountered'),
    actionsTaken: z.array(z.string()).default([]).describe('Actions performed (reset, unlock, etc.)'),
    sentimentHistory: z.array(z.object({
      timestamp: z.string(),
      sentiment: z.string(),
      score: z.number()
    })).default([]).describe('Sentiment tracking over time'),
    diagnosticResults: z.record(z.any()).optional().describe('Results from diagnostic workflows')
  }),
  outputSchema: z.object({
    shouldEscalate: z.boolean(),
    triggers: z.array(z.object({
      type: z.string(),
      details: z.record(z.any()),
      confidence: z.number()
    })),
    urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']),
    priorityScore: z.number(),
    recommendedAction: z.string()
  }),
  execute: async ({ context, ...input }) => {
    try {
      logger.info(`Checking escalation for user ${input.userId}`);
      
      // Build escalation context
      const escalationContext: EscalationContext = {
        userId: input.userId,
        username: input.username,
        messages: input.messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          timestamp: new Date(m.timestamp),
          sentiment: m.sentiment,
          sentimentScore: m.sentimentScore
        })),
        conversationDuration: input.conversationDuration,
        stationsInvolved: input.stationsInvolved,
        errorsEncountered: input.errorsEncountered,
        actionsTaken: input.actionsTaken,
        sentimentHistory: input.sentimentHistory.map(s => ({
          timestamp: new Date(s.timestamp),
          sentiment: s.sentiment,
          score: s.score
        })),
        diagnosticResults: input.diagnosticResults
      };
      
      // Detect escalation triggers
      const triggers = await escalationService.detectEscalation(escalationContext);
      
      const shouldEscalate = triggers.length > 0;
      
      // Calculate urgency
      const urgency = escalationService.calculateUrgency(triggers);
      
      // Generate recommendation
      let recommendedAction = '';
      if (!shouldEscalate) {
        recommendedAction = 'Continue conversation. No escalation needed.';
      } else if (urgency.level === 'critical') {
        recommendedAction = 'IMMEDIATE ESCALATION REQUIRED. Create ticket and notify on-call team.';
      } else if (urgency.level === 'high') {
        recommendedAction = 'Escalate soon. Create ticket for human agent follow-up within 1 hour.';
      } else if (urgency.level === 'medium') {
        recommendedAction = 'Escalate if not resolved in next 2-3 messages. Ticket within 4 hours.';
      } else {
        recommendedAction = 'Monitor situation. Consider escalation if issue persists.';
      }
      
      return {
        shouldEscalate,
        triggers: triggers.map(t => ({
          type: t.type,
          details: t.details,
          confidence: t.confidence
        })),
        urgencyLevel: urgency.level,
        priorityScore: urgency.score,
        recommendedAction
      };
      
    } catch (error) {
      logger.error('Error in checkEscalation tool:', error);
      return {
        shouldEscalate: false,
        triggers: [],
        urgencyLevel: 'low' as const,
        priorityScore: 0,
        recommendedAction: 'Error checking escalation. Continue conversation.'
      };
    }
  }
});

/**
 * Tool: Create escalation ticket
 */
export const createEscalationTicketTool = createTool({
  id: 'createEscalationTicket',
  name: 'Create Escalation Ticket',
  description: `
    Create a support ticket for human agent follow-up.
    
    Use this tool when checkEscalation returns shouldEscalate = true.
    
    This tool:
    - Creates a ticket with full conversation context
    - Classifies the issue type (technical/billing/account/general)
    - Calculates urgency and priority
    - Generates a summary for human agents
    - Stores all technical details
    - Tracks escalation analytics
    
    Returns:
    - ticketId: unique ticket identifier
    - urgencyLevel: priority level
    - estimatedResponseTime: when human will respond
    - summary: brief description of the issue
  `,
  inputSchema: z.object({
    userId: z.string().describe('Discord user ID'),
    username: z.string().describe('Discord username'),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      timestamp: z.string()
    })),
    conversationDuration: z.number(),
    stationsInvolved: z.array(z.string()).default([]),
    errorsEncountered: z.array(z.string()).default([]),
    actionsTaken: z.array(z.string()).default([]),
    sentimentHistory: z.array(z.object({
      timestamp: z.string(),
      sentiment: z.string(),
      score: z.number()
    })).default([]),
    diagnosticResults: z.record(z.any()).optional(),
    triggers: z.array(z.object({
      type: z.string(),
      details: z.record(z.any()),
      confidence: z.number()
    })).describe('Escalation triggers from checkEscalation')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    ticketId: z.string(),
    urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']),
    priorityScore: z.number(),
    estimatedResponseTime: z.string(),
    summary: z.string(),
    issueType: z.string(),
    humanHandoffMessage: z.string()
  }),
  execute: async ({ context, ...input }) => {
    try {
      logger.info(`Creating escalation ticket for user ${input.userId}`);
      
      // Build context
      const escalationContext: EscalationContext = {
        userId: input.userId,
        username: input.username,
        messages: input.messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          timestamp: new Date(m.timestamp)
        })),
        conversationDuration: input.conversationDuration,
        stationsInvolved: input.stationsInvolved,
        errorsEncountered: input.errorsEncountered,
        actionsTaken: input.actionsTaken,
        sentimentHistory: input.sentimentHistory.map(s => ({
          timestamp: new Date(s.timestamp),
          sentiment: s.sentiment,
          score: s.score
        })),
        diagnosticResults: input.diagnosticResults
      };
      
      // Create ticket
      const ticket = await escalationService.createTicket(
        escalationContext,
        input.triggers.map(t => ({
          type: t.type as any,
          details: t.details,
          confidence: t.confidence
        }))
      );
      
      // Estimate response time based on urgency
      let estimatedResponseTime = '';
      switch (ticket.urgencyLevel) {
        case 'critical':
          estimatedResponseTime = 'Immediate (5-15 minutes)';
          break;
        case 'high':
          estimatedResponseTime = 'Within 1 hour';
          break;
        case 'medium':
          estimatedResponseTime = 'Within 4 hours';
          break;
        case 'low':
          estimatedResponseTime = 'Within 24 hours';
          break;
      }
      
      // Generate handoff message
      const handoffMessage = ticket.urgencyLevel === 'critical'
        ? `⚠️ **URGENT**: Your issue requires immediate attention. I've escalated this to our on-call team (Ticket: ${ticket.ticketId}). Someone will contact you within 5-15 minutes.`
        : `I've created a support ticket (${ticket.ticketId}) for our team. A human agent will reach out to you ${estimatedResponseTime.toLowerCase()}. In the meantime, is there anything else I can help with?`;
      
      return {
        success: true,
        ticketId: ticket.ticketId,
        urgencyLevel: ticket.urgencyLevel,
        priorityScore: ticket.priorityScore,
        estimatedResponseTime,
        summary: ticket.conversationSummary.split('\n')[0], // First line
        issueType: ticket.issueType,
        humanHandoffMessage: handoffMessage
      };
      
    } catch (error) {
      logger.error('Error creating escalation ticket:', error);
      return {
        success: false,
        ticketId: '',
        urgencyLevel: 'medium' as const,
        priorityScore: 50,
        estimatedResponseTime: 'Unknown',
        summary: 'Failed to create ticket',
        issueType: 'general',
        humanHandoffMessage: 'I apologize, but I\'m having trouble creating a support ticket right now. Please contact our support team directly.'
      };
    }
  }
});

/**
 * Tool: Get escalation analytics
 */
export const getEscalationAnalyticsTool = createTool({
  id: 'getEscalationAnalytics',
  name: 'Get Escalation Analytics',
  description: 'Get escalation statistics and trends for the last N days',
  inputSchema: z.object({
    days: z.number().default(7).describe('Number of days to look back')
  }),
  outputSchema: z.object({
    analytics: z.array(z.record(z.any())),
    summary: z.object({
      totalEscalations: z.number(),
      avgResolutionTime: z.number(),
      topIssueTypes: z.array(z.string()),
      escalationRate: z.number()
    })
  }),
  execute: async ({ context, days }) => {
    try {
      const analytics = await escalationService.getAnalytics(days);
      
      // Calculate summary
      const totalEscalations = analytics.reduce((sum, a) => sum + (a.total_escalations || 0), 0);
      const avgResolutionTime = analytics.reduce((sum, a) => sum + (a.avg_resolution_time_seconds || 0), 0) / analytics.length;
      
      return {
        analytics,
        summary: {
          totalEscalations,
          avgResolutionTime: Math.round(avgResolutionTime),
          topIssueTypes: ['technical', 'billing', 'general'], // TODO: extract from data
          escalationRate: 0.20 // 20% - TODO: calculate from conversation volume
        }
      };
    } catch (error) {
      logger.error('Error getting escalation analytics:', error);
      return {
        analytics: [],
        summary: {
          totalEscalations: 0,
          avgResolutionTime: 0,
          topIssueTypes: [],
          escalationRate: 0
        }
      };
    }
  }
});

/**
 * Tool: Get active escalations
 */
export const getActiveEscalationsTool = createTool({
  id: 'getActiveEscalations',
  name: 'Get Active Escalations',
  description: 'Get list of currently active escalation tickets',
  inputSchema: z.object({}),
  outputSchema: z.object({
    escalations: z.array(z.record(z.any())),
    count: z.number()
  }),
  execute: async ({ context }) => {
    try {
      const escalations = await escalationService.getActiveEscalations();
      return {
        escalations,
        count: escalations.length
      };
    } catch (error) {
      logger.error('Error getting active escalations:', error);
      return {
        escalations: [],
        count: 0
      };
    }
  }
});

/**
 * Tool: Resolve escalation ticket
 */
export const resolveEscalationTool = createTool({
  id: 'resolveEscalation',
  name: 'Resolve Escalation',
  description: 'Mark an escalation ticket as resolved',
  inputSchema: z.object({
    ticketId: z.string().describe('Escalation ticket ID'),
    resolutionNote: z.string().describe('Description of how issue was resolved'),
    satisfactionScore: z.number().min(1).max(5).optional().describe('Customer satisfaction score 1-5')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string()
  }),
  execute: async ({ context, ticketId, resolutionNote, satisfactionScore }) => {
    try {
      await escalationService.resolveTicket(ticketId, resolutionNote, satisfactionScore);
      return {
        success: true,
        message: `Ticket ${ticketId} marked as resolved`
      };
    } catch (error) {
      logger.error('Error resolving escalation:', error);
      return {
        success: false,
        message: `Failed to resolve ticket ${ticketId}`
      };
    }
  }
});
