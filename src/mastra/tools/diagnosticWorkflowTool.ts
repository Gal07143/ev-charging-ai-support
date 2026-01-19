import { createTool } from '@mastra/core';
import { z } from 'zod';
import { workflowEngine } from '../../services/workflowEngine.js';
import { DIAGNOSTIC_WORKFLOWS } from '../../workflows/diagnosticFlows.js';
import { logger } from '../../utils/logger.js';

/**
 * Tool: Start Diagnostic Workflow
 * Initiate a structured troubleshooting flow for common issues
 */
export const startDiagnosticWorkflowTool = createTool({
  id: 'startDiagnosticWorkflow',
  description: `Start a structured diagnostic workflow for common issues.
  Use this when a user has a problem that matches a known workflow:
  - "charging-wont-start": Charging won't begin (40% of tickets)
  - "slow-charging": Charging is slower than expected (25% of tickets)
  - "payment-issue": Payment or billing problems (15% of tickets)
  
  Workflows guide the user step-by-step through troubleshooting with automatic tool calls and escalation.`,
  inputSchema: z.object({
    userId: z.string().describe('Discord user ID'),
    workflowId: z.enum(['charging-wont-start', 'slow-charging', 'payment-issue']).describe('Which diagnostic workflow to start'),
    userMessage: z.string().describe('The user\'s original message describing the issue'),
  }),
  execute: async ({ context }) => {
    try {
      const { userId, workflowId, userMessage } = context;
      
      // Find the workflow
      const workflow = DIAGNOSTIC_WORKFLOWS.find(w => w.id === workflowId);
      if (!workflow) {
        return {
          success: false,
          error: 'Workflow not found',
        };
      }

      // Check if user already has an active workflow
      const existingSession = workflowEngine.getActiveSession(userId);
      if (existingSession) {
        return {
          success: false,
          error: 'User already has an active workflow',
          sessionId: existingSession.id,
        };
      }

      // Start the workflow
      const session = await workflowEngine.startWorkflow(userId, workflow, {
        userId,
        initialMessage: userMessage,
      });

      const firstStep = workflowEngine.getCurrentStep(session, workflow);
      
      logger.info('Diagnostic workflow started', {
        userId,
        workflowId,
        sessionId: session.id,
      });

      return {
        success: true,
        sessionId: session.id,
        workflowName: workflow.name,
        estimatedTime: workflow.estimatedTime,
        firstStepMessage: firstStep?.content || {},
        firstStepType: firstStep?.type,
      };
    } catch (error: any) {
      logger.error('Failed to start diagnostic workflow', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Tool: Continue Diagnostic Workflow
 * Process user's response and move to next step
 */
export const continueDiagnosticWorkflowTool = createTool({
  id: 'continueDiagnosticWorkflow',
  description: `Continue an active diagnostic workflow with user's response.
  Call this after each user message when a workflow is active.
  The tool will determine the next step based on the user's answer.`,
  inputSchema: z.object({
    userId: z.string().describe('Discord user ID'),
    userResponse: z.string().describe('User\'s answer to the current step'),
    toolResults: z.record(z.any()).optional().describe('Results from any tool calls made (e.g., station status, session data)'),
  }),
  execute: async ({ context }) => {
    try {
      const { userId, userResponse, toolResults } = context;
      
      // Get active session
      const session = workflowEngine.getActiveSession(userId);
      if (!session) {
        return {
          success: false,
          error: 'No active workflow found for user',
        };
      }

      // Find the workflow
      const workflow = DIAGNOSTIC_WORKFLOWS.find(w => w.id === session.workflowId);
      if (!workflow) {
        return {
          success: false,
          error: 'Workflow not found',
        };
      }

      // Process the input
      const result = await workflowEngine.processUserInput(
        session.id,
        workflow,
        userResponse,
        toolResults
      );

      const response: any = {
        success: true,
        sessionId: session.id,
        currentStepMessage: result.currentStep?.content || {},
        currentStepType: result.currentStep?.type,
        workflowStatus: result.session.status,
      };

      // If there's a tool call needed, include it
      if (result.currentStep?.toolCall) {
        response.toolCallNeeded = result.currentStep.toolCall;
      }

      // If escalation is needed
      if (result.shouldEscalate) {
        response.shouldEscalate = true;
        response.escalationReason = result.escalationReason;
        response.escalationUrgency = result.currentStep?.escalationTrigger?.urgency;
      }

      // If workflow completed
      if (result.session.status === 'completed') {
        response.workflowCompleted = true;
        response.resolution = result.session.resolution;
      }

      logger.info('Diagnostic workflow continued', {
        userId,
        sessionId: session.id,
        stepType: result.currentStep?.type,
        status: result.session.status,
      });

      return response;
    } catch (error: any) {
      logger.error('Failed to continue diagnostic workflow', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Tool: Find Matching Workflow
 * Analyze user's issue and recommend the best workflow
 */
export const findMatchingWorkflowTool = createTool({
  id: 'findMatchingWorkflow',
  description: `Analyze user's message and find the best matching diagnostic workflow.
  Use this when a user describes a problem to see if there's a structured workflow available.
  Returns the recommended workflow or null if no good match.`,
  inputSchema: z.object({
    userMessage: z.string().describe('User\'s message describing their issue'),
  }),
  execute: async ({ context }) => {
    try {
      const { userMessage } = context;
      
      const matchedWorkflow = workflowEngine.findMatchingWorkflow(
        userMessage,
        DIAGNOSTIC_WORKFLOWS
      );

      if (!matchedWorkflow) {
        return {
          success: true,
          matchFound: false,
          message: 'No matching workflow found. Handle as free-form conversation.',
        };
      }

      return {
        success: true,
        matchFound: true,
        workflowId: matchedWorkflow.id,
        workflowName: matchedWorkflow.name,
        workflowDescription: matchedWorkflow.description,
        estimatedTime: matchedWorkflow.estimatedTime,
        successRate: matchedWorkflow.successRate,
        category: matchedWorkflow.category,
      };
    } catch (error: any) {
      logger.error('Failed to find matching workflow', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Tool: Get Workflow Analytics
 * Retrieve success metrics for a workflow
 */
export const getWorkflowAnalyticsTool = createTool({
  id: 'getWorkflowAnalytics',
  description: 'Get analytics and success metrics for a diagnostic workflow',
  inputSchema: z.object({
    workflowId: z.enum(['charging-wont-start', 'slow-charging', 'payment-issue']).describe('Which workflow to get analytics for'),
  }),
  execute: async ({ context }) => {
    try {
      const { workflowId } = context;
      
      const analytics = await workflowEngine.getWorkflowAnalytics(workflowId);
      
      return {
        success: true,
        workflowId,
        ...analytics,
      };
    } catch (error: any) {
      logger.error('Failed to get workflow analytics', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});
