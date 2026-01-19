/**
 * Predictive Issue Detection Service
 * Session pattern analysis, ML-based predictions, fraud detection, and proactive notifications
 * 
 * Features:
 * - User behavior pattern analysis
 * - Escalation probability prediction
 * - Fraud detection algorithms
 * - Anomaly detection
 * - Proactive user notifications
 */

import { Pool } from 'pg';
import { generateId } from '../utils/idGenerator';
import logger from '../utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Types
export interface SessionData {
  sessionId: string;
  userId: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: Date;
    sentiment?: string;
  }>;
  toolsUsed: string[];
  errorsEncountered: string[];
  stationsAccessed: string[];
  actionsPerformed: string[];
  sessionStart: Date;
  currentTime: Date;
}

export interface PredictionResult {
  sessionId: string;
  escalationProbability: number;
  failureProbability: number;
  fraudProbability: number;
  predictedEscalation: boolean;
  predictedFailure: boolean;
  predictedFraud: boolean;
  riskFactors: string[];
  confidenceScore: number;
  recommendedActions: string[];
}

export interface AnomalyResult {
  detected: boolean;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  deviationScore: number;
  recommendedAction: string;
}

/**
 * Predictive Detection Service Class
 */
export class PredictiveDetectionService {
  
  /**
   * Analyze session and predict potential issues
   */
  async predictSessionOutcome(data: SessionData): Promise<PredictionResult> {
    try {
      logger.info(`Predicting outcome for session ${data.sessionId}`);
      
      // Get user behavior patterns
      const userPatterns = await this.getUserBehaviorPatterns(data.userId);
      
      // Calculate probabilities
      const escalationProb = this.calculateEscalationProbability(data, userPatterns);
      const failureProb = this.calculateFailureProbability(data, userPatterns);
      const fraudProb = this.calculateFraudProbability(data, userPatterns);
      
      // Identify risk factors
      const riskFactors = this.identifyRiskFactors(data, userPatterns, {
        escalationProb,
        failureProb,
        fraudProb
      });
      
      // Calculate confidence
      const confidence = this.calculatePredictionConfidence(data, userPatterns);
      
      // Determine predictions
      const predictedEscalation = escalationProb >= 0.6;
      const predictedFailure = failureProb >= 0.5;
      const predictedFraud = fraudProb >= 0.7;
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(riskFactors, {
        escalationProb,
        failureProb,
        fraudProb
      });
      
      // Save prediction
      await this.savePrediction(data.sessionId, data.userId, {
        escalationProbability: escalationProb,
        failureProbability: failureProb,
        fraudProbability: fraudProb,
        predictedEscalation,
        predictedFailure,
        predictedFraud,
        riskFactors,
        confidenceScore: confidence
      });
      
      return {
        sessionId: data.sessionId,
        escalationProbability: escalationProb,
        failureProbability: failureProb,
        fraudProbability: fraudProb,
        predictedEscalation,
        predictedFailure,
        predictedFraud,
        riskFactors,
        confidenceScore: confidence,
        recommendedActions: recommendations
      };
      
    } catch (error) {
      logger.error('Error predicting session outcome:', error);
      throw error;
    }
  }
  
  /**
   * Calculate escalation probability (0.0 to 1.0)
   */
  private calculateEscalationProbability(data: SessionData, userPatterns: any): number {
    let score = 0;
    let factors = 0;
    
    // Factor 1: User's historical escalation rate
    if (userPatterns) {
      score += (userPatterns.escalation_rate || 0.2);
      factors++;
    }
    
    // Factor 2: Message count (more messages = higher escalation risk)
    const messageCount = data.messages.length;
    if (messageCount >= 15) {
      score += 0.8;
    } else if (messageCount >= 10) {
      score += 0.5;
    } else if (messageCount >= 7) {
      score += 0.3;
    } else {
      score += 0.1;
    }
    factors++;
    
    // Factor 3: Session duration
    const durationMinutes = (data.currentTime.getTime() - data.sessionStart.getTime()) / 60000;
    if (durationMinutes >= 15) {
      score += 0.7;
    } else if (durationMinutes >= 10) {
      score += 0.4;
    } else {
      score += 0.1;
    }
    factors++;
    
    // Factor 4: Negative sentiment
    const negativeMsgs = data.messages.filter(m => 
      m.sentiment === 'negative' || m.sentiment === 'frustrated' || m.sentiment === 'angry'
    ).length;
    if (negativeMsgs >= 3) {
      score += 0.9;
    } else if (negativeMsgs >= 2) {
      score += 0.6;
    } else if (negativeMsgs >= 1) {
      score += 0.3;
    } else {
      score += 0.1;
    }
    factors++;
    
    // Factor 5: Multiple errors
    if (data.errorsEncountered.length >= 3) {
      score += 0.8;
    } else if (data.errorsEncountered.length >= 2) {
      score += 0.5;
    } else if (data.errorsEncountered.length >= 1) {
      score += 0.2;
    } else {
      score += 0;
    }
    factors++;
    
    // Factor 6: Repeat issue from user history
    if (userPatterns && userPatterns.repeat_issue_frequency >= 0.3) {
      score += 0.7;
      factors++;
    }
    
    return Math.min(score / factors, 1.0);
  }
  
  /**
   * Calculate failure probability (issue won't be resolved)
   */
  private calculateFailureProbability(data: SessionData, userPatterns: any): number {
    let score = 0;
    let factors = 0;
    
    // Factor 1: User's historical resolution rate (inverse)
    if (userPatterns) {
      score += (1 - (userPatterns.resolution_rate || 0.7));
      factors++;
    }
    
    // Factor 2: Complex issues (multiple errors, multiple stations)
    const complexity = data.errorsEncountered.length + data.stationsAccessed.length;
    if (complexity >= 5) {
      score += 0.8;
    } else if (complexity >= 3) {
      score += 0.5;
    } else {
      score += 0.2;
    }
    factors++;
    
    // Factor 3: Lack of progress (many messages, few actions)
    const actionRatio = data.actionsPerformed.length / Math.max(data.messages.length, 1);
    if (actionRatio < 0.1) {
      score += 0.7; // Not making progress
    } else if (actionRatio < 0.2) {
      score += 0.4;
    } else {
      score += 0.1;
    }
    factors++;
    
    // Factor 4: Few tools used (not leveraging capabilities)
    if (data.toolsUsed.length === 0 && data.messages.length > 5) {
      score += 0.6;
    } else if (data.toolsUsed.length < 2 && data.messages.length > 8) {
      score += 0.4;
    } else {
      score += 0.1;
    }
    factors++;
    
    return Math.min(score / factors, 1.0);
  }
  
  /**
   * Calculate fraud probability
   */
  private calculateFraudProbability(data: SessionData, userPatterns: any): number {
    let score = 0;
    let factors = 0;
    
    // Factor 1: User's historical fraud risk
    if (userPatterns && userPatterns.fraud_risk_score) {
      score += (userPatterns.fraud_risk_score / 100);
      factors++;
    } else {
      score += 0.1; // Default low risk
      factors++;
    }
    
    // Factor 2: Unusual session frequency
    const sessionCount = userPatterns?.total_sessions || 0;
    const avgSessionDuration = userPatterns?.avg_session_duration_seconds || 600;
    const currentDuration = (data.currentTime.getTime() - data.sessionStart.getTime()) / 1000;
    
    if (sessionCount > 20 && currentDuration < avgSessionDuration * 0.2) {
      score += 0.8; // Very short session for experienced user
    } else {
      score += 0.1;
    }
    factors++;
    
    // Factor 3: Rapid-fire actions (bot-like behavior)
    if (data.actionsPerformed.length > 5 && data.messages.length < 3) {
      score += 0.9; // Many actions, few messages = suspicious
    } else {
      score += 0.1;
    }
    factors++;
    
    // Factor 4: Payment-related keywords with unusual patterns
    const paymentMentions = data.messages.filter(m => 
      m.content.toLowerCase().includes('refund') || 
      m.content.toLowerCase().includes('free') ||
      m.content.toLowerCase().includes('החזר') // Hebrew: refund
    ).length;
    
    if (paymentMentions >= 2 && sessionCount < 3) {
      score += 0.7; // New user asking about refunds
    } else {
      score += 0.1;
    }
    factors++;
    
    return Math.min(score / factors, 1.0);
  }
  
  /**
   * Identify specific risk factors
   */
  private identifyRiskFactors(data: SessionData, userPatterns: any, probs: any): string[] {
    const factors: string[] = [];
    
    if (data.messages.length >= 12) {
      factors.push('long_conversation');
    }
    
    if (probs.escalationProb >= 0.6) {
      factors.push('high_escalation_risk');
    }
    
    if (probs.fraudProb >= 0.7) {
      factors.push('potential_fraud');
    }
    
    if (data.errorsEncountered.length >= 2) {
      factors.push('multiple_errors');
    }
    
    const negativeMsgs = data.messages.filter(m => 
      m.sentiment === 'negative' || m.sentiment === 'frustrated'
    ).length;
    if (negativeMsgs >= 2) {
      factors.push('negative_sentiment');
    }
    
    if (userPatterns && userPatterns.repeat_issue_frequency >= 0.3) {
      factors.push('repeat_customer_issue');
    }
    
    if (data.toolsUsed.length === 0 && data.messages.length > 5) {
      factors.push('no_tools_used');
    }
    
    if (data.actionsPerformed.length < 2 && data.messages.length > 8) {
      factors.push('lack_of_progress');
    }
    
    return factors;
  }
  
  /**
   * Calculate prediction confidence
   */
  private calculatePredictionConfidence(data: SessionData, userPatterns: any): number {
    let confidence = 0.5; // Base confidence
    
    // More data = higher confidence
    if (data.messages.length >= 8) {
      confidence += 0.2;
    }
    
    // Historical data available = higher confidence
    if (userPatterns && userPatterns.total_sessions >= 5) {
      confidence += 0.2;
    }
    
    // Recent activity = higher confidence
    if (userPatterns && userPatterns.last_session_date) {
      const daysSinceLastSession = (Date.now() - new Date(userPatterns.last_session_date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastSession < 7) {
        confidence += 0.1;
      }
    }
    
    return Math.min(confidence, 1.0);
  }
  
  /**
   * Generate recommended actions
   */
  private generateRecommendations(riskFactors: string[], probs: any): string[] {
    const recommendations: string[] = [];
    
    if (riskFactors.includes('high_escalation_risk')) {
      recommendations.push('Consider proactive escalation to human agent');
    }
    
    if (riskFactors.includes('potential_fraud')) {
      recommendations.push('Flag account for fraud review');
      recommendations.push('Require additional verification');
    }
    
    if (riskFactors.includes('multiple_errors')) {
      recommendations.push('Start diagnostic workflow');
      recommendations.push('Check station health status');
    }
    
    if (riskFactors.includes('negative_sentiment')) {
      recommendations.push('Use empathetic language');
      recommendations.push('Offer immediate assistance');
    }
    
    if (riskFactors.includes('no_tools_used')) {
      recommendations.push('Suggest semantic search');
      recommendations.push('Initiate appropriate workflow');
    }
    
    if (riskFactors.includes('repeat_customer_issue')) {
      recommendations.push('Escalate to senior agent');
      recommendations.push('Review previous session history');
    }
    
    if (probs.escalationProb >= 0.8) {
      recommendations.push('URGENT: Immediate escalation recommended');
    }
    
    return recommendations;
  }
  
  /**
   * Detect anomalies in user behavior
   */
  async detectAnomalies(data: SessionData): Promise<AnomalyResult[]> {
    try {
      const anomalies: AnomalyResult[] = [];
      const userPatterns = await this.getUserBehaviorPatterns(data.userId);
      
      // Anomaly 1: Unusual session frequency
      const frequencyAnomaly = this.detectFrequencyAnomaly(data, userPatterns);
      if (frequencyAnomaly) {
        anomalies.push(frequencyAnomaly);
      }
      
      // Anomaly 2: Unusual message pattern
      const messageAnomaly = this.detectMessageAnomaly(data, userPatterns);
      if (messageAnomaly) {
        anomalies.push(messageAnomaly);
      }
      
      // Anomaly 3: Suspicious payment behavior
      const paymentAnomaly = this.detectPaymentAnomaly(data, userPatterns);
      if (paymentAnomaly) {
        anomalies.push(paymentAnomaly);
      }
      
      // Save anomalies
      for (const anomaly of anomalies) {
        await this.saveAnomaly(data.sessionId, data.userId, anomaly);
      }
      
      return anomalies;
      
    } catch (error) {
      logger.error('Error detecting anomalies:', error);
      return [];
    }
  }
  
  /**
   * Detect unusual session frequency
   */
  private detectFrequencyAnomaly(data: SessionData, userPatterns: any): AnomalyResult | null {
    if (!userPatterns || userPatterns.total_sessions < 3) {
      return null; // Not enough data
    }
    
    // Check if session is much shorter than usual
    const avgDuration = userPatterns.avg_session_duration_seconds || 600;
    const currentDuration = (data.currentTime.getTime() - data.sessionStart.getTime()) / 1000;
    
    if (currentDuration < avgDuration * 0.2 && data.messages.length < 3) {
      return {
        detected: true,
        anomalyType: 'unusual_frequency',
        severity: 'medium',
        description: 'Session is unusually short compared to user history',
        deviationScore: ((avgDuration - currentDuration) / avgDuration) * 100,
        recommendedAction: 'Monitor for bot-like behavior'
      };
    }
    
    return null;
  }
  
  /**
   * Detect unusual message patterns
   */
  private detectMessageAnomaly(data: SessionData, userPatterns: any): AnomalyResult | null {
    if (!userPatterns) return null;
    
    const avgMessages = userPatterns.avg_messages_per_session || 10;
    const currentMessages = data.messages.length;
    
    // Significantly more messages than usual
    if (currentMessages > avgMessages * 2 && currentMessages > 15) {
      return {
        detected: true,
        anomalyType: 'excessive_messages',
        severity: 'medium',
        description: 'User sending unusually high number of messages',
        deviationScore: ((currentMessages - avgMessages) / avgMessages) * 100,
        recommendedAction: 'Check for circular conversation or confusion'
      };
    }
    
    return null;
  }
  
  /**
   * Detect suspicious payment behavior
   */
  private detectPaymentAnomaly(data: SessionData, userPatterns: any): AnomalyResult | null {
    const paymentKeywords = ['refund', 'free', 'charge', 'money', 'payment', 'החזר', 'חיוב', 'תשלום'];
    
    const paymentMentions = data.messages.filter(m =>
      paymentKeywords.some(kw => m.content.toLowerCase().includes(kw))
    ).length;
    
    // New user with high payment-related questions
    const sessionCount = userPatterns?.total_sessions || 0;
    if (paymentMentions >= 3 && sessionCount < 2) {
      return {
        detected: true,
        anomalyType: 'payment_fraud_indicators',
        severity: 'high',
        description: 'New user with unusual focus on payment/refund topics',
        deviationScore: (paymentMentions / data.messages.length) * 100,
        recommendedAction: 'Flag for fraud review and require verification'
      };
    }
    
    return null;
  }
  
  /**
   * Send proactive notification to user
   */
  async sendProactiveNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'urgent',
    triggerData: any
  ): Promise<string> {
    try {
      const notificationId = `NOTIF-${generateId()}`;
      
      await pool.query(`
        INSERT INTO proactive_notifications (
          notification_id, discord_user_id, notification_type,
          title, message, priority, triggered_by, trigger_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        notificationId,
        userId,
        type,
        title,
        message,
        priority,
        'predictive_detection',
        JSON.stringify(triggerData)
      ]);
      
      logger.info(`Proactive notification sent: ${notificationId} to user ${userId}`);
      
      return notificationId;
      
    } catch (error) {
      logger.error('Error sending proactive notification:', error);
      throw error;
    }
  }
  
  /**
   * Get user behavior patterns
   */
  private async getUserBehaviorPatterns(userId: string): Promise<any> {
    try {
      const result = await pool.query(`
        SELECT * FROM user_behavior_patterns WHERE discord_user_id = $1
      `, [userId]);
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting user patterns:', error);
      return null;
    }
  }
  
  /**
   * Save prediction to database
   */
  private async savePrediction(sessionId: string, userId: string, prediction: any): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO session_predictions (
          session_id, discord_user_id,
          escalation_probability, failure_probability, fraud_probability,
          predicted_escalation, predicted_failure, predicted_fraud,
          risk_factors, confidence_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (session_id) DO UPDATE SET
          escalation_probability = EXCLUDED.escalation_probability,
          failure_probability = EXCLUDED.failure_probability,
          fraud_probability = EXCLUDED.fraud_probability,
          predicted_escalation = EXCLUDED.predicted_escalation,
          predicted_failure = EXCLUDED.predicted_failure,
          predicted_fraud = EXCLUDED.predicted_fraud,
          risk_factors = EXCLUDED.risk_factors,
          confidence_score = EXCLUDED.confidence_score
      `, [
        sessionId,
        userId,
        prediction.escalationProbability,
        prediction.failureProbability,
        prediction.fraudProbability,
        prediction.predictedEscalation,
        prediction.predictedFailure,
        prediction.predictedFraud,
        JSON.stringify(prediction.riskFactors),
        prediction.confidenceScore
      ]);
    } catch (error) {
      logger.error('Error saving prediction:', error);
    }
  }
  
  /**
   * Save anomaly to database
   */
  private async saveAnomaly(sessionId: string, userId: string, anomaly: AnomalyResult): Promise<void> {
    try {
      const eventId = `ANOM-${generateId()}`;
      
      await pool.query(`
        INSERT INTO anomaly_events (
          event_id, discord_user_id, session_id,
          anomaly_type, severity, description, deviation_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        eventId,
        userId,
        sessionId,
        anomaly.anomalyType,
        anomaly.severity,
        anomaly.description,
        anomaly.deviationScore
      ]);
    } catch (error) {
      logger.error('Error saving anomaly:', error);
    }
  }
  
  /**
   * Get high-risk users
   */
  async getHighRiskUsers(limit: number = 20): Promise<any[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM high_risk_users LIMIT $1
      `, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting high-risk users:', error);
      return [];
    }
  }
  
  /**
   * Get active anomalies
   */
  async getActiveAnomalies(limit: number = 50): Promise<any[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM active_anomalies LIMIT $1
      `, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting active anomalies:', error);
      return [];
    }
  }
}

// Export singleton instance
export const predictiveDetectionService = new PredictiveDetectionService();
