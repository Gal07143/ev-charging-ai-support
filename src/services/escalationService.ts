/**
 * Escalation Service
 * Smart escalation detection and ticket management
 * 
 * Features:
 * - Automatic escalation detection with multiple triggers
 * - Urgency scoring and priority calculation
 * - Context aggregation for ticket creation
 * - Sentiment analysis integration
 * - Analytics tracking
 */

import { Pool } from 'pg';
import { generateId } from '../utils/idGenerator';
import logger from '../utils/logger';

// Database pool (assumes it's configured elsewhere)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Types
export interface EscalationTrigger {
  type: 'timeout' | 'repeated_issue' | 'negative_sentiment' | 'explicit_request' | 'workflow_failure' | 'safety_concern' | 'payment_failure' | 'technical_complexity';
  details: Record<string, any>;
  confidence: number; // 0.0 to 1.0
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sentiment?: string;
  sentimentScore?: number;
}

export interface EscalationContext {
  userId: string;
  username: string;
  messages: ConversationMessage[];
  conversationDuration: number; // seconds
  stationsInvolved: string[];
  errorsEncountered: string[];
  actionsTaken: string[];
  sentimentHistory: Array<{ timestamp: Date; sentiment: string; score: number }>;
  diagnosticResults?: Record<string, any>;
  technicalDetails?: Record<string, any>;
}

export interface EscalationTicket {
  id?: number;
  ticketId: string;
  discordUserId: string;
  discordUsername: string;
  issueType: 'technical' | 'billing' | 'account' | 'general';
  issueCategory?: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  priorityScore: number;
  conversationSummary: string;
  conversationContext: EscalationContext;
  diagnosticResults?: Record<string, any>;
  technicalDetails?: Record<string, any>;
  userSentiment: string;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  escalationReason: string;
  escalationTriggers: EscalationTrigger[];
}

/**
 * Escalation Service Class
 */
export class EscalationService {
  
  /**
   * Detect if conversation should be escalated
   * Returns array of triggers if escalation is needed, empty array otherwise
   */
  async detectEscalation(context: EscalationContext): Promise<EscalationTrigger[]> {
    const triggers: EscalationTrigger[] = [];
    
    try {
      // 1. Explicit user request
      const explicitRequest = this.detectExplicitRequest(context.messages);
      if (explicitRequest) {
        triggers.push(explicitRequest);
      }
      
      // 2. Safety concerns
      const safetyConcern = this.detectSafetyConcern(context.messages);
      if (safetyConcern) {
        triggers.push(safetyConcern);
      }
      
      // 3. Repeated issue
      const repeatedIssue = await this.detectRepeatedIssue(context.userId);
      if (repeatedIssue) {
        triggers.push(repeatedIssue);
      }
      
      // 4. Negative sentiment
      const negativeSentiment = this.detectNegativeSentiment(context.sentimentHistory);
      if (negativeSentiment) {
        triggers.push(negativeSentiment);
      }
      
      // 5. Conversation timeout (too many messages)
      const timeout = this.detectTimeout(context);
      if (timeout) {
        triggers.push(timeout);
      }
      
      // 6. Workflow failures
      const workflowFailure = this.detectWorkflowFailure(context.diagnosticResults);
      if (workflowFailure) {
        triggers.push(workflowFailure);
      }
      
      // 7. Payment failures
      const paymentFailure = this.detectPaymentFailure(context.messages, context.errorsEncountered);
      if (paymentFailure) {
        triggers.push(paymentFailure);
      }
      
      // 8. Technical complexity
      const technicalComplexity = this.detectTechnicalComplexity(context);
      if (technicalComplexity) {
        triggers.push(technicalComplexity);
      }
      
      logger.info(`Escalation detection for user ${context.userId}: ${triggers.length} triggers found`);
      
      return triggers;
      
    } catch (error) {
      logger.error('Error detecting escalation:', error);
      return [];
    }
  }
  
  /**
   * Detect explicit escalation requests
   */
  private detectExplicitRequest(messages: ConversationMessage[]): EscalationTrigger | null {
    const keywords = [
      'talk to human', 'speak to agent', 'human agent', 'real person',
      'escalate', 'manager', 'supervisor', 'not working', 'frustrated',
      'אדם אמיתי', 'נציג אנושי', 'מנהל', 'מפקח' // Hebrew
    ];
    
    const recentMessages = messages.slice(-5);
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        const content = msg.content.toLowerCase();
        if (keywords.some(kw => content.includes(kw))) {
          return {
            type: 'explicit_request',
            details: {
              message: msg.content,
              timestamp: msg.timestamp
            },
            confidence: 0.95
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Detect safety concerns (injuries, electrical hazards, fire, etc.)
   */
  private detectSafetyConcern(messages: ConversationMessage[]): EscalationTrigger | null {
    const safetyKeywords = [
      'smoke', 'fire', 'spark', 'shock', 'electrical', 'burn', 'injury', 'danger',
      'עשן', 'אש', 'ניצוץ', 'התחשמלות', 'כוויה', 'פציעה', 'סכנה' // Hebrew
    ];
    
    const recentMessages = messages.slice(-10);
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        const content = msg.content.toLowerCase();
        if (safetyKeywords.some(kw => content.includes(kw))) {
          return {
            type: 'safety_concern',
            details: {
              message: msg.content,
              timestamp: msg.timestamp,
              keywords: safetyKeywords.filter(kw => content.includes(kw))
            },
            confidence: 1.0 // CRITICAL
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Detect repeated issues for this user
   */
  private async detectRepeatedIssue(userId: string): Promise<EscalationTrigger | null> {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count, 
               ARRAY_AGG(issue_category) as categories
        FROM escalation_tickets
        WHERE discord_user_id = $1
        AND created_at >= NOW() - INTERVAL '7 days'
      `, [userId]);
      
      if (result.rows[0].count >= 2) {
        return {
          type: 'repeated_issue',
          details: {
            count: parseInt(result.rows[0].count),
            recentCategories: result.rows[0].categories
          },
          confidence: 0.85
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Error detecting repeated issue:', error);
      return null;
    }
  }
  
  /**
   * Detect persistent negative sentiment
   */
  private detectNegativeSentiment(sentimentHistory: Array<{ timestamp: Date; sentiment: string; score: number }>): EscalationTrigger | null {
    if (sentimentHistory.length < 3) return null;
    
    const recent = sentimentHistory.slice(-5);
    const negativeCount = recent.filter(s => s.sentiment === 'negative' || s.sentiment === 'frustrated' || s.sentiment === 'angry').length;
    
    if (negativeCount >= 3) {
      const avgScore = recent.reduce((sum, s) => sum + s.score, 0) / recent.length;
      return {
        type: 'negative_sentiment',
        details: {
          negativeCount,
          totalChecked: recent.length,
          averageScore: avgScore
        },
        confidence: 0.80
      };
    }
    
    return null;
  }
  
  /**
   * Detect conversation timeout (too many messages without resolution)
   */
  private detectTimeout(context: EscalationContext): EscalationTrigger | null {
    const messageThreshold = 15;
    const durationThreshold = 600; // 10 minutes
    
    if (context.messages.length >= messageThreshold || context.conversationDuration >= durationThreshold) {
      return {
        type: 'timeout',
        details: {
          messageCount: context.messages.length,
          durationSeconds: context.conversationDuration
        },
        confidence: 0.70
      };
    }
    
    return null;
  }
  
  /**
   * Detect workflow failures
   */
  private detectWorkflowFailure(diagnosticResults?: Record<string, any>): EscalationTrigger | null {
    if (!diagnosticResults) return null;
    
    if (diagnosticResults.status === 'failed' || diagnosticResults.status === 'stuck') {
      return {
        type: 'workflow_failure',
        details: {
          workflowId: diagnosticResults.workflowId,
          step: diagnosticResults.currentStep,
          reason: diagnosticResults.failureReason
        },
        confidence: 0.75
      };
    }
    
    return null;
  }
  
  /**
   * Detect payment failures
   */
  private detectPaymentFailure(messages: ConversationMessage[], errors: string[]): EscalationTrigger | null {
    const paymentErrors = errors.filter(e => e.includes('payment') || e.includes('billing') || e.includes('charge'));
    
    if (paymentErrors.length > 0) {
      return {
        type: 'payment_failure',
        details: {
          errors: paymentErrors
        },
        confidence: 0.85
      };
    }
    
    // Check messages for payment keywords
    const paymentKeywords = ['payment', 'charge', 'refund', 'credit card', 'תשלום', 'חיוב', 'החזר'];
    const recentMessages = messages.slice(-5);
    
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        const content = msg.content.toLowerCase();
        if (paymentKeywords.some(kw => content.includes(kw))) {
          return {
            type: 'payment_failure',
            details: {
              messageContent: msg.content
            },
            confidence: 0.70
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Detect technical complexity
   */
  private detectTechnicalComplexity(context: EscalationContext): EscalationTrigger | null {
    const complexityScore = 
      (context.errorsEncountered.length * 10) +
      (context.stationsInvolved.length * 5) +
      (context.actionsTaken.length * 3);
    
    if (complexityScore >= 30) {
      return {
        type: 'technical_complexity',
        details: {
          complexityScore,
          errorsCount: context.errorsEncountered.length,
          stationsCount: context.stationsInvolved.length,
          actionsCount: context.actionsTaken.length
        },
        confidence: 0.65
      };
    }
    
    return null;
  }
  
  /**
   * Calculate urgency level based on triggers
   */
  calculateUrgency(triggers: EscalationTrigger[]): { level: 'low' | 'medium' | 'high' | 'critical'; score: number } {
    if (triggers.length === 0) {
      return { level: 'low', score: 10 };
    }
    
    // Safety concerns are always critical
    if (triggers.some(t => t.type === 'safety_concern')) {
      return { level: 'critical', score: 100 };
    }
    
    // Calculate weighted score
    let score = 0;
    const weights: Record<string, number> = {
      explicit_request: 60,
      negative_sentiment: 50,
      repeated_issue: 70,
      payment_failure: 55,
      workflow_failure: 45,
      technical_complexity: 40,
      timeout: 35
    };
    
    for (const trigger of triggers) {
      const weight = weights[trigger.type] || 30;
      score += weight * trigger.confidence;
    }
    
    // Normalize to 0-100
    score = Math.min(score, 100);
    
    if (score >= 80) return { level: 'critical', score };
    if (score >= 60) return { level: 'high', score };
    if (score >= 40) return { level: 'medium', score };
    return { level: 'low', score };
  }
  
  /**
   * Classify issue type
   */
  classifyIssue(context: EscalationContext): { type: 'technical' | 'billing' | 'account' | 'general'; category?: string } {
    const content = context.messages.map(m => m.content.toLowerCase()).join(' ');
    
    // Billing/Payment
    if (content.includes('payment') || content.includes('charge') || content.includes('refund') || 
        content.includes('תשלום') || content.includes('חיוב') || content.includes('החזר')) {
      return { type: 'billing', category: 'payment_issue' };
    }
    
    // Technical issues
    if (context.errorsEncountered.length > 0 || context.stationsInvolved.length > 0) {
      if (content.includes('not start') || content.includes('won\'t charge') || content.includes('לא מתחיל')) {
        return { type: 'technical', category: 'charging_failure' };
      }
      if (content.includes('slow') || content.includes('אטי')) {
        return { type: 'technical', category: 'slow_charging' };
      }
      return { type: 'technical', category: 'hardware_issue' };
    }
    
    // Account issues
    if (content.includes('account') || content.includes('login') || content.includes('password') ||
        content.includes('חשבון') || content.includes('כניסה')) {
      return { type: 'account', category: 'account_access' };
    }
    
    return { type: 'general', category: 'other' };
  }
  
  /**
   * Generate conversation summary
   */
  generateSummary(context: EscalationContext): string {
    const parts: string[] = [];
    
    // User info
    parts.push(`User: ${context.username} (${context.userId})`);
    
    // Issue classification
    const classification = this.classifyIssue(context);
    parts.push(`Issue Type: ${classification.type}`);
    if (classification.category) {
      parts.push(`Category: ${classification.category}`);
    }
    
    // Context stats
    parts.push(`\nConversation: ${context.messages.length} messages over ${Math.round(context.conversationDuration / 60)} minutes`);
    
    // Technical details
    if (context.stationsInvolved.length > 0) {
      parts.push(`Stations: ${context.stationsInvolved.join(', ')}`);
    }
    if (context.errorsEncountered.length > 0) {
      parts.push(`Errors: ${context.errorsEncountered.join(', ')}`);
    }
    if (context.actionsTaken.length > 0) {
      parts.push(`Actions Taken: ${context.actionsTaken.join(', ')}`);
    }
    
    // Recent messages
    parts.push('\n--- Recent Conversation ---');
    const recentMessages = context.messages.slice(-5);
    for (const msg of recentMessages) {
      const prefix = msg.role === 'user' ? 'Customer' : 'Agent';
      parts.push(`${prefix}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`);
    }
    
    return parts.join('\n');
  }
  
  /**
   * Create escalation ticket
   */
  async createTicket(context: EscalationContext, triggers: EscalationTrigger[]): Promise<EscalationTicket> {
    try {
      const ticketId = `ESC-${generateId()}`;
      const urgency = this.calculateUrgency(triggers);
      const classification = this.classifyIssue(context);
      const summary = this.generateSummary(context);
      
      const overallSentiment = context.sentimentHistory.length > 0 
        ? context.sentimentHistory[context.sentimentHistory.length - 1].sentiment
        : 'neutral';
      
      const escalationReason = triggers.map(t => t.type).join(', ');
      
      // Insert ticket
      const ticketResult = await pool.query(`
        INSERT INTO escalation_tickets (
          ticket_id, discord_user_id, discord_username,
          issue_type, issue_category, urgency_level, priority_score,
          conversation_summary, conversation_context,
          user_sentiment, status, escalation_reason, escalation_triggers
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [
        ticketId,
        context.userId,
        context.username,
        classification.type,
        classification.category,
        urgency.level,
        urgency.score,
        summary,
        JSON.stringify(context),
        overallSentiment,
        'open',
        escalationReason,
        JSON.stringify(triggers)
      ]);
      
      const dbTicketId = ticketResult.rows[0].id;
      
      // Insert triggers
      for (const trigger of triggers) {
        await pool.query(`
          INSERT INTO escalation_triggers (ticket_id, trigger_type, trigger_details, confidence_score)
          VALUES ($1, $2, $3, $4)
        `, [dbTicketId, trigger.type, JSON.stringify(trigger.details), trigger.confidence]);
      }
      
      // Insert conversation context
      await pool.query(`
        INSERT INTO conversation_contexts (
          discord_user_id, ticket_id, message_count, conversation_duration_seconds,
          messages, stations_involved, errors_encountered, actions_taken,
          sentiment_history, overall_sentiment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        context.userId,
        dbTicketId,
        context.messages.length,
        context.conversationDuration,
        JSON.stringify(context.messages),
        JSON.stringify(context.stationsInvolved),
        JSON.stringify(context.errorsEncountered),
        JSON.stringify(context.actionsTaken),
        JSON.stringify(context.sentimentHistory),
        overallSentiment
      ]);
      
      // Update analytics
      await this.updateAnalytics(classification.type, urgency.level);
      
      logger.info(`Created escalation ticket ${ticketId} for user ${context.userId}`);
      
      const ticket: EscalationTicket = {
        id: dbTicketId,
        ticketId,
        discordUserId: context.userId,
        discordUsername: context.username,
        issueType: classification.type,
        issueCategory: classification.category,
        urgencyLevel: urgency.level,
        priorityScore: urgency.score,
        conversationSummary: summary,
        conversationContext: context,
        userSentiment: overallSentiment,
        status: 'open',
        escalationReason,
        escalationTriggers: triggers
      };
      
      return ticket;
      
    } catch (error) {
      logger.error('Error creating escalation ticket:', error);
      throw error;
    }
  }
  
  /**
   * Update daily analytics
   */
  private async updateAnalytics(issueType: string, urgency: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await pool.query(`
        INSERT INTO escalation_analytics (date, total_escalations, escalations_by_type, escalations_by_urgency)
        VALUES ($1, 1, $2::jsonb, $3::jsonb)
        ON CONFLICT (date) DO UPDATE SET
          total_escalations = escalation_analytics.total_escalations + 1,
          escalations_by_type = jsonb_set(
            COALESCE(escalation_analytics.escalations_by_type, '{}'::jsonb),
            ARRAY[$4],
            (COALESCE((escalation_analytics.escalations_by_type->$4)::int, 0) + 1)::text::jsonb
          ),
          escalations_by_urgency = jsonb_set(
            COALESCE(escalation_analytics.escalations_by_urgency, '{}'::jsonb),
            ARRAY[$5],
            (COALESCE((escalation_analytics.escalations_by_urgency->$5)::int, 0) + 1)::text::jsonb
          ),
          updated_at = NOW()
      `, [today, JSON.stringify({ [issueType]: 1 }), JSON.stringify({ [urgency]: 1 }), issueType, urgency]);
      
    } catch (error) {
      logger.error('Error updating escalation analytics:', error);
    }
  }
  
  /**
   * Get active escalations
   */
  async getActiveEscalations(): Promise<any[]> {
    try {
      const result = await pool.query('SELECT * FROM active_escalations LIMIT 50');
      return result.rows;
    } catch (error) {
      logger.error('Error getting active escalations:', error);
      return [];
    }
  }
  
  /**
   * Get escalation analytics
   */
  async getAnalytics(days: number = 7): Promise<any[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM escalation_analytics
        WHERE date >= NOW() - INTERVAL '${days} days'
        ORDER BY date DESC
      `);
      return result.rows;
    } catch (error) {
      logger.error('Error getting escalation analytics:', error);
      return [];
    }
  }
  
  /**
   * Resolve escalation ticket
   */
  async resolveTicket(ticketId: string, resolutionNote: string, satisfactionScore?: number): Promise<void> {
    try {
      const result = await pool.query(`
        UPDATE escalation_tickets
        SET 
          status = 'resolved',
          resolved_at = NOW(),
          resolution_time_seconds = EXTRACT(EPOCH FROM (NOW() - escalated_at))::INTEGER,
          customer_satisfaction_score = COALESCE($2, customer_satisfaction_score)
        WHERE ticket_id = $1
        RETURNING id
      `, [ticketId, satisfactionScore]);
      
      if (result.rows.length > 0) {
        const dbTicketId = result.rows[0].id;
        
        // Add resolution note
        await pool.query(`
          INSERT INTO escalation_notes (ticket_id, note_type, note_text, author)
          VALUES ($1, 'resolution', $2, 'system')
        `, [dbTicketId, resolutionNote]);
        
        logger.info(`Resolved escalation ticket ${ticketId}`);
      }
    } catch (error) {
      logger.error('Error resolving escalation ticket:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const escalationService = new EscalationService();
