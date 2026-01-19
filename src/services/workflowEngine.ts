import { DiagnosticWorkflow, WorkflowStep } from '../workflows/diagnosticFlows.js';
import { logger } from '../utils/logger.js';
import { db } from '../db/index.js';

export interface WorkflowSession {
  id: string;
  userId: string;
  workflowId: string;
  currentStepId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'active' | 'completed' | 'escalated' | 'abandoned';
  context: Record<string, any>; // Store user inputs, tool results, etc.
  stepHistory: {
    stepId: string;
    timestamp: Date;
    userInput?: string;
    toolResult?: any;
    nextStepId?: string;
  }[];
  escalationReason?: string;
  resolution?: string;
}

/**
 * Workflow Engine
 * Manages execution of diagnostic workflows with context tracking and analytics
 */
export class WorkflowEngine {
  private activeSessions: Map<string, WorkflowSession> = new Map();

  /**
   * Start a new diagnostic workflow session
   */
  async startWorkflow(
    userId: string,
    workflow: DiagnosticWorkflow,
    initialContext: Record<string, any> = {}
  ): Promise<WorkflowSession> {
    const sessionId = `wf_${userId}_${workflow.id}_${Date.now()}`;
    
    const session: WorkflowSession = {
      id: sessionId,
      userId,
      workflowId: workflow.id,
      currentStepId: workflow.steps[0].id,
      startedAt: new Date(),
      status: 'active',
      context: initialContext,
      stepHistory: [],
    };

    this.activeSessions.set(sessionId, session);

    // Save to database
    await this.saveSessionToDb(session);

    logger.info('Workflow started', {
      sessionId,
      userId,
      workflowId: workflow.id,
    });

    return session;
  }

  /**
   * Get the current step in a workflow
   */
  getCurrentStep(session: WorkflowSession, workflow: DiagnosticWorkflow): WorkflowStep | null {
    return workflow.steps.find(step => step.id === session.currentStepId) || null;
  }

  /**
   * Process user input and move to next step
   */
  async processUserInput(
    sessionId: string,
    workflow: DiagnosticWorkflow,
    userInput: string,
    toolResults?: Record<string, any>
  ): Promise<{
    session: WorkflowSession;
    currentStep: WorkflowStep | null;
    shouldEscalate: boolean;
    escalationReason?: string;
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Workflow session not found: ${sessionId}`);
    }

    const currentStep = this.getCurrentStep(session, workflow);
    if (!currentStep) {
      throw new Error(`Current step not found: ${session.currentStepId}`);
    }

    // Store user input in context
    session.context.lastUserInput = userInput;
    
    // Update context with tool results if provided
    if (toolResults) {
      session.context = { ...session.context, ...toolResults };
    }

    // Record step in history
    session.stepHistory.push({
      stepId: currentStep.id,
      timestamp: new Date(),
      userInput,
      toolResult: toolResults,
    });

    // Determine next step based on conditions
    const nextStepId = await this.determineNextStep(
      currentStep,
      session.context,
      userInput
    );

    if (nextStepId) {
      session.currentStepId = nextStepId;
      
      // Check if next step is escalation
      const nextStep = workflow.steps.find(s => s.id === nextStepId);
      if (nextStep?.type === 'escalation') {
        session.status = 'escalated';
        session.completedAt = new Date();
        session.escalationReason = nextStep.escalationTrigger?.reason;
        
        await this.saveSessionToDb(session);
        
        return {
          session,
          currentStep: nextStep,
          shouldEscalate: true,
          escalationReason: nextStep.escalationTrigger?.reason,
        };
      }

      // Check if next step is resolution
      if (nextStep?.type === 'resolution') {
        session.status = 'completed';
        session.completedAt = new Date();
        session.resolution = nextStep.content.en; // Store resolution
        
        await this.saveSessionToDb(session);
        await this.trackWorkflowSuccess(workflow, session);
      }
    } else {
      // No next step found - workflow stuck
      logger.warn('Workflow stuck - no next step determined', {
        sessionId,
        currentStepId: currentStep.id,
        userInput,
      });
    }

    // Update session in database
    await this.saveSessionToDb(session);

    return {
      session,
      currentStep: workflow.steps.find(s => s.id === session.currentStepId) || null,
      shouldEscalate: false,
    };
  }

  /**
   * Determine next step based on conditions
   */
  private async determineNextStep(
    currentStep: WorkflowStep,
    context: Record<string, any>,
    userInput: string
  ): Promise<string | null> {
    if (!currentStep.nextSteps || currentStep.nextSteps.length === 0) {
      return null;
    }

    // If only one next step and no condition, return it
    if (currentStep.nextSteps.length === 1 && !currentStep.nextSteps[0].condition) {
      return currentStep.nextSteps[0].nextStepId;
    }

    // Evaluate conditions
    for (const nextStep of currentStep.nextSteps) {
      if (!nextStep.condition) {
        continue;
      }

      try {
        // Simple condition evaluation
        // In production, use a proper expression evaluator or decision engine
        const condition = nextStep.condition
          .replace(/answer/g, `"${userInput.toLowerCase()}"`)
          .replace(/status/g, `"${context.status || ''}"`)
          .replace(/power/g, context.power || 0)
          .replace(/userId/g, `"${context.userId || ''}"`)
          .replace(/session\.userId/g, `"${context.session?.userId || ''}"`);

        // Very basic evaluation - in production use a safe evaluator
        if (this.evaluateCondition(condition, context, userInput)) {
          return nextStep.nextStepId;
        }
      } catch (error) {
        logger.error('Error evaluating condition', {
          condition: nextStep.condition,
          error,
        });
      }
    }

    // If no condition matched, return first next step
    return currentStep.nextSteps[0]?.nextStepId || null;
  }

  /**
   * Simple condition evaluator
   * In production, use a proper expression evaluator library
   */
  private evaluateCondition(
    condition: string,
    context: Record<string, any>,
    userInput: string
  ): boolean {
    const answer = userInput.toLowerCase();
    
    // Handle common patterns
    if (condition.includes('answer === "yes"')) {
      return answer.includes('yes') || answer.includes('כן') || answer.includes('да') || answer.includes('نعم');
    }
    if (condition.includes('answer === "no"')) {
      return answer.includes('no') || answer.includes('לא') || answer.includes('нет') || answer.includes('لا');
    }
    if (condition.includes('answer.includes("green")')) {
      return answer.includes('green') || answer.includes('ירוק') || answer.includes('зелен') || answer.includes('أخضر');
    }
    if (condition.includes('answer.includes("red")')) {
      return answer.includes('red') || answer.includes('אדום') || answer.includes('красн') || answer.includes('أحمر');
    }
    if (condition.includes('status === "offline"')) {
      return context.status === 'offline' || context.status === 'unavailable';
    }
    if (condition.includes('status === "available"')) {
      return context.status === 'available' || context.status === 'online';
    }
    if (condition.includes('status === "occupied"')) {
      return context.status === 'occupied' || context.status === 'charging';
    }
    if (condition.includes('power < 10')) {
      return (context.power || 0) < 10;
    }
    if (condition.includes('power >= 10 && power < 20')) {
      const power = context.power || 0;
      return power >= 10 && power < 20;
    }
    if (condition.includes('power >= 20')) {
      return (context.power || 0) >= 20;
    }

    return false;
  }

  /**
   * Get active workflow session for a user
   */
  getActiveSession(userId: string): WorkflowSession | null {
    for (const [, session] of this.activeSessions) {
      if (session.userId === userId && session.status === 'active') {
        return session;
      }
    }
    return null;
  }

  /**
   * Abandon a workflow session
   */
  async abandonWorkflow(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'abandoned';
      session.completedAt = new Date();
      await this.saveSessionToDb(session);
      this.activeSessions.delete(sessionId);
      
      logger.info('Workflow abandoned', { sessionId });
    }
  }

  /**
   * Save session to database
   */
  private async saveSessionToDb(session: WorkflowSession): Promise<void> {
    try {
      await db.query(
        `INSERT INTO workflow_sessions 
         (id, user_id, workflow_id, current_step_id, status, context, step_history, 
          escalation_reason, resolution, started_at, completed_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         ON CONFLICT (id) DO UPDATE SET
           current_step_id = $4,
           status = $5,
           context = $6,
           step_history = $7,
           escalation_reason = $8,
           resolution = $9,
           completed_at = $11,
           updated_at = NOW()`,
        [
          session.id,
          session.userId,
          session.workflowId,
          session.currentStepId,
          session.status,
          JSON.stringify(session.context),
          JSON.stringify(session.stepHistory),
          session.escalationReason,
          session.resolution,
          session.startedAt,
          session.completedAt,
        ]
      );
    } catch (error) {
      logger.error('Failed to save workflow session to database', error);
    }
  }

  /**
   * Track workflow success for analytics
   */
  private async trackWorkflowSuccess(
    workflow: DiagnosticWorkflow,
    session: WorkflowSession
  ): Promise<void> {
    try {
      const duration = session.completedAt && session.startedAt
        ? (session.completedAt.getTime() - session.startedAt.getTime()) / 1000
        : 0;

      await db.query(
        `INSERT INTO workflow_analytics 
         (workflow_id, success, duration_seconds, steps_taken, completed_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          workflow.id,
          session.status === 'completed',
          duration,
          session.stepHistory.length,
        ]
      );

      logger.info('Workflow analytics tracked', {
        workflowId: workflow.id,
        success: session.status === 'completed',
        duration,
        stepsTaken: session.stepHistory.length,
      });
    } catch (error) {
      logger.error('Failed to track workflow analytics', error);
    }
  }

  /**
   * Get workflow analytics
   */
  async getWorkflowAnalytics(workflowId: string): Promise<{
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
    avgSteps: number;
  }> {
    try {
      const result = await db.query(
        `SELECT 
           COUNT(*) as total_executions,
           AVG(CASE WHEN success THEN 1 ELSE 0 END) as success_rate,
           AVG(duration_seconds) as avg_duration,
           AVG(steps_taken) as avg_steps
         FROM workflow_analytics
         WHERE workflow_id = $1`,
        [workflowId]
      );

      const row = result.rows[0];
      return {
        totalExecutions: parseInt(row.total_executions) || 0,
        successRate: parseFloat(row.success_rate) || 0,
        avgDuration: parseFloat(row.avg_duration) || 0,
        avgSteps: parseFloat(row.avg_steps) || 0,
      };
    } catch (error) {
      logger.error('Failed to get workflow analytics', error);
      return {
        totalExecutions: 0,
        successRate: 0,
        avgDuration: 0,
        avgSteps: 0,
      };
    }
  }

  /**
   * Find best matching workflow for user's issue
   */
  findMatchingWorkflow(
    userMessage: string,
    workflows: DiagnosticWorkflow[]
  ): DiagnosticWorkflow | null {
    const messageLower = userMessage.toLowerCase();
    
    // Score each workflow based on trigger matches
    let bestMatch: { workflow: DiagnosticWorkflow; score: number } | null = null;

    for (const workflow of workflows) {
      let score = 0;
      
      for (const trigger of workflow.triggers) {
        if (messageLower.includes(trigger.toLowerCase())) {
          score += 1;
        }
      }

      // Boost score for high-priority workflows
      if (workflow.priority === 'high') {
        score *= 1.5;
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { workflow, score };
      }
    }

    return bestMatch?.workflow || null;
  }
}

// Singleton instance
export const workflowEngine = new WorkflowEngine();
