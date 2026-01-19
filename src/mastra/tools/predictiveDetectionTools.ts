/**
 * Predictive Detection Tools for Mastra Agent
 * Tools for predicting issues, detecting anomalies, and sending proactive notifications
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { predictiveDetectionService, SessionData } from '../../services/predictiveDetectionService';
import logger from '../../utils/logger';

/**
 * Tool: Predict session outcome
 */
export const predictSessionOutcomeTool = createTool({
  id: 'predictSessionOutcome',
  name: 'Predict Session Outcome',
  description: `
    Predict potential issues in the current conversation using ML-based analysis.
    
    Use this tool EARLY in conversations (after 5-7 messages) to:
    - Predict escalation likelihood
    - Identify failure patterns
    - Detect fraud indicators
    - Get proactive recommendations
    
    The tool analyzes:
    - User behavior patterns (historical data)
    - Message count and sentiment
    - Error frequency
    - Tool usage patterns
    - Session duration
    
    Returns probabilities (0.0-1.0) and actionable recommendations.
    
    Use predictions to:
    - Proactively escalate before user gets frustrated
    - Start appropriate workflows early
    - Flag potential fraud
    - Improve conversation efficiency
  `,
  inputSchema: z.object({
    sessionId: z.string().describe('Unique session identifier'),
    userId: z.string().describe('Discord user ID'),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      timestamp: z.string(),
      sentiment: z.string().optional()
    })).describe('Conversation history'),
    toolsUsed: z.array(z.string()).default([]).describe('Tools used so far'),
    errorsEncountered: z.array(z.string()).default([]).describe('Error codes encountered'),
    stationsAccessed: z.array(z.string()).default([]).describe('Stations mentioned'),
    actionsPerformed: z.array(z.string()).default([]).describe('Actions taken (reset, unlock, etc.)'),
    sessionStart: z.string().describe('ISO timestamp when session started')
  }),
  outputSchema: z.object({
    sessionId: z.string(),
    escalationProbability: z.number(),
    failureProbability: z.number(),
    fraudProbability: z.number(),
    predictedEscalation: z.boolean(),
    predictedFailure: z.boolean(),
    predictedFraud: z.boolean(),
    riskFactors: z.array(z.string()),
    confidenceScore: z.number(),
    recommendedActions: z.array(z.string()),
    summary: z.string()
  }),
  execute: async ({ context, ...input }) => {
    try {
      logger.info(`Predicting outcome for session ${input.sessionId}`);
      
      // Build session data
      const sessionData: SessionData = {
        sessionId: input.sessionId,
        userId: input.userId,
        messages: input.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp),
          sentiment: m.sentiment
        })),
        toolsUsed: input.toolsUsed,
        errorsEncountered: input.errorsEncountered,
        stationsAccessed: input.stationsAccessed,
        actionsPerformed: input.actionsPerformed,
        sessionStart: new Date(input.sessionStart),
        currentTime: new Date()
      };
      
      // Get prediction
      const prediction = await predictiveDetectionService.predictSessionOutcome(sessionData);
      
      // Generate summary
      let summary = '';
      
      if (prediction.predictedFraud && prediction.fraudProbability >= 0.8) {
        summary = `⚠️ HIGH FRAUD RISK (${Math.round(prediction.fraudProbability * 100)}%). Immediate verification required.`;
      } else if (prediction.predictedEscalation && prediction.escalationProbability >= 0.7) {
        summary = `⚠️ High escalation risk (${Math.round(prediction.escalationProbability * 100)}%). Consider proactive escalation.`;
      } else if (prediction.predictedFailure && prediction.failureProbability >= 0.6) {
        summary = `⚠️ Resolution may fail (${Math.round(prediction.failureProbability * 100)}%). ${prediction.recommendedActions[0] || 'Use diagnostic workflows'}.`;
      } else {
        summary = `✓ Conversation on track. Escalation risk: ${Math.round(prediction.escalationProbability * 100)}%.`;
      }
      
      return {
        ...prediction,
        summary
      };
      
    } catch (error) {
      logger.error('Error in predictSessionOutcome tool:', error);
      return {
        sessionId: input.sessionId,
        escalationProbability: 0.3,
        failureProbability: 0.3,
        fraudProbability: 0.1,
        predictedEscalation: false,
        predictedFailure: false,
        predictedFraud: false,
        riskFactors: [],
        confidenceScore: 0.2,
        recommendedActions: ['Continue conversation'],
        summary: 'Prediction unavailable - continuing normally'
      };
    }
  }
});

/**
 * Tool: Detect anomalies
 */
export const detectAnomaliesTool = createTool({
  id: 'detectAnomalies',
  name: 'Detect Anomalies',
  description: 'Detect unusual patterns in user behavior that may indicate fraud or issues',
  inputSchema: z.object({
    sessionId: z.string(),
    userId: z.string(),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      timestamp: z.string()
    })),
    toolsUsed: z.array(z.string()).default([]),
    errorsEncountered: z.array(z.string()).default([]),
    stationsAccessed: z.array(z.string()).default([]),
    actionsPerformed: z.array(z.string()).default([]),
    sessionStart: z.string()
  }),
  outputSchema: z.object({
    anomaliesDetected: z.boolean(),
    anomalies: z.array(z.object({
      anomalyType: z.string(),
      severity: z.string(),
      description: z.string(),
      recommendedAction: z.string()
    })),
    summary: z.string()
  }),
  execute: async ({ context, ...input }) => {
    try {
      const sessionData: SessionData = {
        sessionId: input.sessionId,
        userId: input.userId,
        messages: input.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp)
        })),
        toolsUsed: input.toolsUsed,
        errorsEncountered: input.errorsEncountered,
        stationsAccessed: input.stationsAccessed,
        actionsPerformed: input.actionsPerformed,
        sessionStart: new Date(input.sessionStart),
        currentTime: new Date()
      };
      
      const anomalies = await predictiveDetectionService.detectAnomalies(sessionData);
      
      let summary = '';
      if (anomalies.length === 0) {
        summary = '✓ No anomalies detected. Normal behavior.';
      } else {
        const criticalCount = anomalies.filter(a => a.severity === 'critical' || a.severity === 'high').length;
        if (criticalCount > 0) {
          summary = `⚠️ ${criticalCount} high-severity anomal${criticalCount === 1 ? 'y' : 'ies'} detected. Immediate action required.`;
        } else {
          summary = `⚠️ ${anomalies.length} anomal${anomalies.length === 1 ? 'y' : 'ies'} detected. Monitor situation.`;
        }
      }
      
      return {
        anomaliesDetected: anomalies.length > 0,
        anomalies: anomalies.map(a => ({
          anomalyType: a.anomalyType,
          severity: a.severity,
          description: a.description,
          recommendedAction: a.recommendedAction
        })),
        summary
      };
      
    } catch (error) {
      logger.error('Error detecting anomalies:', error);
      return {
        anomaliesDetected: false,
        anomalies: [],
        summary: 'Anomaly detection unavailable'
      };
    }
  }
});

/**
 * Tool: Send proactive notification
 */
export const sendProactiveNotificationTool = createTool({
  id: 'sendProactiveNotification',
  name: 'Send Proactive Notification',
  description: 'Send proactive alert to user based on predictions (e.g., predicted issue, maintenance alert, usage tip)',
  inputSchema: z.object({
    userId: z.string().describe('Discord user ID'),
    notificationType: z.enum(['predicted_issue', 'maintenance_alert', 'usage_tip', 'fraud_warning']),
    title: z.string().describe('Notification title'),
    message: z.string().describe('Notification message'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    triggerData: z.record(z.any()).optional().describe('What triggered this notification')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    notificationId: z.string(),
    message: z.string()
  }),
  execute: async ({ context, ...input }) => {
    try {
      const notificationId = await predictiveDetectionService.sendProactiveNotification(
        input.userId,
        input.notificationType,
        input.title,
        input.message,
        input.priority,
        input.triggerData || {}
      );
      
      return {
        success: true,
        notificationId,
        message: `Proactive notification sent: ${input.title}`
      };
      
    } catch (error) {
      logger.error('Error sending proactive notification:', error);
      return {
        success: false,
        notificationId: '',
        message: 'Failed to send notification'
      };
    }
  }
});

/**
 * Tool: Get high-risk users
 */
export const getHighRiskUsersTool = createTool({
  id: 'getHighRiskUsers',
  name: 'Get High-Risk Users',
  description: 'Get list of users with high fraud/churn risk for monitoring',
  inputSchema: z.object({
    limit: z.number().default(20).describe('Maximum number of users to return')
  }),
  outputSchema: z.object({
    users: z.array(z.record(z.any())),
    count: z.number(),
    summary: z.string()
  }),
  execute: async ({ context, limit }) => {
    try {
      const users = await predictiveDetectionService.getHighRiskUsers(limit);
      
      const highFraud = users.filter(u => u.fraud_risk_score >= 80).length;
      const highChurn = users.filter(u => u.churn_risk_score >= 80).length;
      
      const summary = `Found ${users.length} high-risk users: ${highFraud} high fraud risk, ${highChurn} high churn risk.`;
      
      return {
        users,
        count: users.length,
        summary
      };
    } catch (error) {
      logger.error('Error getting high-risk users:', error);
      return {
        users: [],
        count: 0,
        summary: 'Failed to retrieve high-risk users'
      };
    }
  }
});

/**
 * Tool: Get active anomalies
 */
export const getActiveAnomaliesTool = createTool({
  id: 'getActiveAnomalies',
  name: 'Get Active Anomalies',
  description: 'Get list of currently active anomaly events requiring attention',
  inputSchema: z.object({
    limit: z.number().default(50).describe('Maximum number to return')
  }),
  outputSchema: z.object({
    anomalies: z.array(z.record(z.any())),
    count: z.number(),
    criticalCount: z.number()
  }),
  execute: async ({ context, limit }) => {
    try {
      const anomalies = await predictiveDetectionService.getActiveAnomalies(limit);
      const criticalCount = anomalies.filter(a => a.severity === 'critical' || a.severity === 'high').length;
      
      return {
        anomalies,
        count: anomalies.length,
        criticalCount
      };
    } catch (error) {
      logger.error('Error getting active anomalies:', error);
      return {
        anomalies: [],
        count: 0,
        criticalCount: 0
      };
    }
  }
});
