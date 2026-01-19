/**
 * Quality Scoring Service
 * Multi-metric conversation quality scoring and A/B testing
 * 
 * Features:
 * - Comprehensive quality scoring (5 components)
 * - Low-quality detection with recommendations
 * - A/B testing framework for prompt optimization
 * - Tool effectiveness tracking
 * - Pattern recognition
 */

import { Pool } from 'pg';
import logger from '../utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Types
export interface ConversationData {
  conversationId: string;
  userId: string;
  username: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    sentiment?: string;
    sentimentScore?: number;
  }>;
  toolsUsed: string[];
  issueResolved: boolean;
  escalated: boolean;
  conversationStart: Date;
  conversationEnd: Date;
  promptVariant?: string;
  experimentId?: string;
}

export interface QualityScore {
  conversationId: string;
  overallScore: number;
  qualityGrade: string;
  resolutionScore: number;
  efficiencyScore: number;
  sentimentScore: number;
  toolUsageScore: number;
  satisfactionScore: number;
  isLowQuality: boolean;
  qualityIssues: string[];
  improvementSuggestions: string[];
}

/**
 * Quality Scoring Service Class
 */
export class QualityScoringService {
  
  /**
   * Calculate comprehensive quality score for a conversation
   */
  async scoreConversation(data: ConversationData): Promise<QualityScore> {
    try {
      logger.info(`Scoring conversation ${data.conversationId}`);
      
      // Calculate component scores
      const resolutionScore = this.calculateResolutionScore(data);
      const efficiencyScore = this.calculateEfficiencyScore(data);
      const sentimentScore = this.calculateSentimentScore(data);
      const toolUsageScore = this.calculateToolUsageScore(data);
      const satisfactionScore = this.calculateSatisfactionScore(data);
      
      // Calculate overall score (weighted average)
      const overallScore = Math.round(
        resolutionScore * 0.35 +      // 35% weight - most important
        efficiencyScore * 0.25 +       // 25% weight
        sentimentScore * 0.20 +        // 20% weight
        toolUsageScore * 0.10 +        // 10% weight
        satisfactionScore * 0.10       // 10% weight
      );
      
      // Determine quality grade
      const qualityGrade = this.getQualityGrade(overallScore);
      
      // Detect issues and generate suggestions
      const { qualityIssues, improvementSuggestions, isLowQuality } = 
        this.detectQualityIssues(data, {
          overallScore,
          resolutionScore,
          efficiencyScore,
          sentimentScore,
          toolUsageScore,
          satisfactionScore
        });
      
      // Save to database
      await this.saveQualityScore(data, {
        conversationId: data.conversationId,
        overallScore,
        qualityGrade,
        resolutionScore,
        efficiencyScore,
        sentimentScore,
        toolUsageScore,
        satisfactionScore,
        isLowQuality,
        qualityIssues,
        improvementSuggestions
      });
      
      // Update analytics
      await this.updateAnalytics(overallScore, qualityGrade, data);
      
      // Update A/B test metrics if applicable
      if (data.experimentId && data.promptVariant) {
        await this.updateABTestMetrics(data.experimentId, data.promptVariant, overallScore);
      }
      
      return {
        conversationId: data.conversationId,
        overallScore,
        qualityGrade,
        resolutionScore,
        efficiencyScore,
        sentimentScore,
        toolUsageScore,
        satisfactionScore,
        isLowQuality,
        qualityIssues,
        improvementSuggestions
      };
      
    } catch (error) {
      logger.error('Error scoring conversation:', error);
      throw error;
    }
  }
  
  /**
   * Calculate resolution score (0-100)
   * Did we solve the customer's issue?
   */
  private calculateResolutionScore(data: ConversationData): number {
    let score = 50; // Base score
    
    // +50 if issue resolved
    if (data.issueResolved) {
      score += 50;
    }
    
    // -30 if escalated (couldn't resolve)
    if (data.escalated) {
      score -= 30;
    }
    
    // Bonus for quick resolution
    const durationMinutes = (data.conversationEnd.getTime() - data.conversationStart.getTime()) / 60000;
    if (data.issueResolved && durationMinutes <= 5) {
      score += 10; // Quick win!
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Calculate efficiency score (0-100)
   * Was the conversation efficient (short, focused)?
   */
  private calculateEfficiencyScore(data: ConversationData): number {
    const messageCount = data.messages.length;
    const durationMinutes = (data.conversationEnd.getTime() - data.conversationStart.getTime()) / 60000;
    
    let score = 100;
    
    // Penalize long conversations
    if (messageCount > 20) {
      score -= 30;
    } else if (messageCount > 15) {
      score -= 20;
    } else if (messageCount > 10) {
      score -= 10;
    }
    
    // Penalize long duration
    if (durationMinutes > 15) {
      score -= 20;
    } else if (durationMinutes > 10) {
      score -= 10;
    }
    
    // Bonus for concise resolution
    if (messageCount <= 6 && data.issueResolved) {
      score += 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Calculate sentiment score (0-100)
   * Did sentiment improve during the conversation?
   */
  private calculateSentimentScore(data: ConversationData): number {
    const messagesWithSentiment = data.messages.filter(m => m.sentiment);
    
    if (messagesWithSentiment.length === 0) {
      return 70; // Neutral default
    }
    
    const firstSentiment = messagesWithSentiment[0];
    const lastSentiment = messagesWithSentiment[messagesWithSentiment.length - 1];
    
    // Count sentiment types
    const negativeCoun = messagesWithSentiment.filter(m => 
      m.sentiment === 'negative' || m.sentiment === 'frustrated' || m.sentiment === 'angry'
    ).length;
    
    const positiveCoun = messagesWithSentiment.filter(m => 
      m.sentiment === 'positive' || m.sentiment === 'satisfied' || m.sentiment === 'happy'
    ).length;
    
    let score = 50;
    
    // Improvement bonus
    if (lastSentiment.sentiment === 'positive' || lastSentiment.sentiment === 'satisfied') {
      score += 30;
    }
    
    // Started negative but ended positive = great!
    if ((firstSentiment.sentiment === 'negative' || firstSentiment.sentiment === 'frustrated') &&
        (lastSentiment.sentiment === 'positive' || lastSentiment.sentiment === 'satisfied')) {
      score += 20; // Turnaround bonus!
    }
    
    // Penalty for persistent negative sentiment
    if (negativeCoun >= messagesWithSentiment.length * 0.5) {
      score -= 30;
    }
    
    // Bonus for mostly positive
    if (positiveCoun >= messagesWithSentiment.length * 0.7) {
      score += 20;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Calculate tool usage score (0-100)
   * Were the right tools used effectively?
   */
  private calculateToolUsageScore(data: ConversationData): number {
    const toolsUsed = data.toolsUsed;
    
    if (toolsUsed.length === 0) {
      return 50; // Neutral - maybe simple question
    }
    
    let score = 70; // Base score for using tools
    
    // Bonus for using semantic search (RAG)
    if (toolsUsed.includes('semanticSearch')) {
      score += 10;
    }
    
    // Bonus for using diagnostic workflows
    if (toolsUsed.some(t => t.includes('Workflow'))) {
      score += 10;
    }
    
    // Bonus for using charger database
    if (toolsUsed.some(t => t.includes('Charger') || t.includes('ErrorCode'))) {
      score += 5;
    }
    
    // Penalty for using too many tools (unfocused)
    if (toolsUsed.length > 10) {
      score -= 20;
    }
    
    // Bonus for resolved with tools
    if (data.issueResolved && toolsUsed.length > 0) {
      score += 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Calculate satisfaction score (0-100)
   * Overall customer satisfaction indicators
   */
  private calculateSatisfactionScore(data: ConversationData): number {
    let score = 60; // Neutral base
    
    // Issue resolved is major satisfaction driver
    if (data.issueResolved) {
      score += 40;
    }
    
    // Not escalated is good
    if (!data.escalated) {
      score += 10;
    }
    
    // Check for explicit satisfaction keywords in last 3 messages
    const lastMessages = data.messages.slice(-3);
    const satisfactionKeywords = ['thank', 'thanks', 'תודה', 'great', 'perfect', 'helpful', 'solved', 'resolved'];
    const hasSatisfactionKeyword = lastMessages.some(m => 
      m.role === 'user' && satisfactionKeywords.some(kw => m.content.toLowerCase().includes(kw))
    );
    
    if (hasSatisfactionKeyword) {
      score += 15;
    }
    
    // Penalty for very long conversations
    if (data.messages.length > 20) {
      score -= 15;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Get quality grade from overall score
   */
  private getQualityGrade(score: number): string {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }
  
  /**
   * Detect quality issues and generate improvement suggestions
   */
  private detectQualityIssues(data: ConversationData, scores: any): {
    qualityIssues: string[];
    improvementSuggestions: string[];
    isLowQuality: boolean;
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Check resolution
    if (!data.issueResolved && data.escalated) {
      issues.push('unresolved_and_escalated');
      suggestions.push('Improve diagnostic capabilities for this issue type');
    } else if (!data.issueResolved && !data.escalated) {
      issues.push('unresolved_without_escalation');
      suggestions.push('Consider earlier escalation or additional troubleshooting steps');
    }
    
    // Check efficiency
    if (data.messages.length > 15) {
      issues.push('too_many_messages');
      suggestions.push('Use structured workflows to reduce message count');
    }
    
    const durationMinutes = (data.conversationEnd.getTime() - data.conversationStart.getTime()) / 60000;
    if (durationMinutes > 15) {
      issues.push('long_duration');
      suggestions.push('Streamline troubleshooting process');
    }
    
    // Check sentiment
    if (scores.sentimentScore < 40) {
      issues.push('negative_sentiment');
      suggestions.push('Focus on empathy and acknowledgment of frustration');
    }
    
    // Check tool usage
    if (data.toolsUsed.length === 0 && !data.issueResolved) {
      issues.push('no_tools_used');
      suggestions.push('Leverage semantic search and diagnostic tools');
    }
    
    if (data.toolsUsed.length > 10) {
      issues.push('excessive_tool_usage');
      suggestions.push('More focused tool selection needed');
    }
    
    // Check for circular conversations (repeated questions)
    const userMessages = data.messages.filter(m => m.role === 'user').map(m => m.content.toLowerCase());
    const repeatedMessages = userMessages.filter((msg, idx) => 
      userMessages.indexOf(msg) !== idx
    );
    
    if (repeatedMessages.length >= 2) {
      issues.push('circular_conversation');
      suggestions.push('Avoid asking the same questions multiple times');
    }
    
    const isLowQuality = scores.overallScore < 60 || issues.length >= 3;
    
    return { qualityIssues: issues, improvementSuggestions: suggestions, isLowQuality };
  }
  
  /**
   * Save quality score to database
   */
  private async saveQualityScore(data: ConversationData, score: QualityScore): Promise<void> {
    try {
      const initialSentiment = data.messages.find(m => m.sentiment)?.sentiment || 'neutral';
      const finalSentiment = [...data.messages].reverse().find(m => m.sentiment)?.sentiment || 'neutral';
      const sentimentImproved = this.sentimentImproved(initialSentiment, finalSentiment);
      const negativeSentimentCount = data.messages.filter(m => 
        m.sentiment === 'negative' || m.sentiment === 'frustrated' || m.sentiment === 'angry'
      ).length;
      
      await pool.query(`
        INSERT INTO conversation_quality_scores (
          conversation_id, discord_user_id, discord_username,
          overall_score, quality_grade,
          resolution_score, efficiency_score, sentiment_score, tool_usage_score, satisfaction_score,
          message_count, duration_seconds, tools_used, issue_resolved, escalated,
          initial_sentiment, final_sentiment, sentiment_improved, negative_sentiment_count,
          is_low_quality, quality_issues, improvement_suggestions,
          prompt_variant, experiment_id,
          conversation_start, conversation_end
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
        )
        ON CONFLICT (conversation_id) DO UPDATE SET
          overall_score = EXCLUDED.overall_score,
          quality_grade = EXCLUDED.quality_grade,
          resolution_score = EXCLUDED.resolution_score,
          efficiency_score = EXCLUDED.efficiency_score,
          sentiment_score = EXCLUDED.sentiment_score,
          tool_usage_score = EXCLUDED.tool_usage_score,
          satisfaction_score = EXCLUDED.satisfaction_score,
          is_low_quality = EXCLUDED.is_low_quality,
          quality_issues = EXCLUDED.quality_issues,
          improvement_suggestions = EXCLUDED.improvement_suggestions,
          scored_at = NOW()
      `, [
        data.conversationId, data.userId, data.username,
        score.overallScore, score.qualityGrade,
        score.resolutionScore, score.efficiencyScore, score.sentimentScore, 
        score.toolUsageScore, score.satisfactionScore,
        data.messages.length,
        Math.round((data.conversationEnd.getTime() - data.conversationStart.getTime()) / 1000),
        JSON.stringify(data.toolsUsed),
        data.issueResolved,
        data.escalated,
        initialSentiment,
        finalSentiment,
        sentimentImproved,
        negativeSentimentCount,
        score.isLowQuality,
        JSON.stringify(score.qualityIssues),
        JSON.stringify(score.improvementSuggestions),
        data.promptVariant || null,
        data.experimentId || null,
        data.conversationStart,
        data.conversationEnd
      ]);
      
      logger.info(`Quality score saved: ${data.conversationId} = ${score.overallScore} (${score.qualityGrade})`);
      
    } catch (error) {
      logger.error('Error saving quality score:', error);
      throw error;
    }
  }
  
  /**
   * Check if sentiment improved
   */
  private sentimentImproved(initial: string, final: string): boolean {
    const sentimentRank: Record<string, number> = {
      'angry': 1,
      'frustrated': 2,
      'negative': 3,
      'neutral': 4,
      'positive': 5,
      'satisfied': 6,
      'happy': 7
    };
    
    const initialRank = sentimentRank[initial] || 4;
    const finalRank = sentimentRank[final] || 4;
    
    return finalRank > initialRank;
  }
  
  /**
   * Update daily analytics
   */
  private async updateAnalytics(score: number, grade: string, data: ConversationData): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await pool.query(`
        INSERT INTO quality_analytics (
          date, total_conversations, scored_conversations,
          grade_distribution, avg_overall_score
        )
        VALUES ($1, 1, 1, $2::jsonb, $3)
        ON CONFLICT (date) DO UPDATE SET
          total_conversations = quality_analytics.total_conversations + 1,
          scored_conversations = quality_analytics.scored_conversations + 1,
          grade_distribution = jsonb_set(
            COALESCE(quality_analytics.grade_distribution, '{}'::jsonb),
            ARRAY[$4],
            (COALESCE((quality_analytics.grade_distribution->$4)::int, 0) + 1)::text::jsonb
          ),
          avg_overall_score = (
            (quality_analytics.avg_overall_score * quality_analytics.scored_conversations + $3) / 
            (quality_analytics.scored_conversations + 1)
          ),
          updated_at = NOW()
      `, [today, JSON.stringify({ [grade]: 1 }), score, grade]);
      
    } catch (error) {
      logger.error('Error updating quality analytics:', error);
    }
  }
  
  /**
   * Update A/B test metrics
   */
  private async updateABTestMetrics(experimentId: string, variant: string, score: number): Promise<void> {
    try {
      await pool.query(`
        UPDATE ab_test_experiments
        SET 
          total_conversations = total_conversations + 1,
          metrics_by_variant = jsonb_set(
            COALESCE(metrics_by_variant, '{}'::jsonb),
            ARRAY[$2, 'count'],
            (COALESCE((metrics_by_variant->$2->>'count')::int, 0) + 1)::text::jsonb
          ),
          updated_at = NOW()
        WHERE experiment_id = $1
      `, [experimentId, variant]);
      
    } catch (error) {
      logger.error('Error updating A/B test metrics:', error);
    }
  }
  
  /**
   * Get quality analytics for date range
   */
  async getAnalytics(days: number = 7): Promise<any[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM quality_analytics
        WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY date DESC
      `);
      return result.rows;
    } catch (error) {
      logger.error('Error getting quality analytics:', error);
      return [];
    }
  }
  
  /**
   * Get low-quality conversations for review
   */
  async getLowQualityConversations(limit: number = 20): Promise<any[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM low_quality_conversations
        LIMIT $1
      `, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting low-quality conversations:', error);
      return [];
    }
  }
  
  /**
   * Get tool effectiveness summary
   */
  async getToolEffectiveness(): Promise<any[]> {
    try {
      const result = await pool.query('SELECT * FROM tool_effectiveness_summary');
      return result.rows;
    } catch (error) {
      logger.error('Error getting tool effectiveness:', error);
      return [];
    }
  }
}

// Export singleton instance
export const qualityScoringService = new QualityScoringService();
