/**
 * Sentiment Analysis Service
 * Real-time sentiment analysis with tone adjustment and escalation detection
 * 
 * Features:
 * - VADER-like sentiment analysis (rule-based, no external APIs)
 * - Emotion detection from text
 * - Sentiment trajectory tracking
 * - Escalation risk scoring
 * - Response tone recommendations
 */

import type { D1Database } from '@cloudflare/workers-types';

// ============================================================================
// Types
// ============================================================================

export interface SentimentAnalysis {
  sentiment_label: 'positive' | 'negative' | 'neutral' | 'mixed';
  positive_score: number;
  negative_score: number;
  neutral_score: number;
  compound_score: number; // -1.0 to 1.0
  primary_emotion?: string;
  emotion_confidence?: number;
  suggested_tone: string;
  urgency_level: 'low' | 'medium' | 'high' | 'critical';
  escalation_recommended: boolean;
  escalation_reason?: string;
}

export interface ConversationSentimentTrajectory {
  conversation_id: string;
  sentiment_trend: 'improving' | 'declining' | 'stable' | 'volatile';
  escalation_risk_score: number;
  negative_streak_count: number;
  early_warning_triggered: boolean;
}

// ============================================================================
// Sentiment Lexicons (simplified VADER approach)
// ============================================================================

const POSITIVE_WORDS = new Set([
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome', 'perfect',
  'love', 'happy', 'pleased', 'satisfied', 'thank', 'thanks', 'appreciate', 'helpful',
  'works', 'working', 'fixed', 'resolved', 'solved', 'success', 'successful', 'easy'
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'angry', 'mad', 'frustrated',
  'frustrating', 'annoying', 'annoyed', 'upset', 'disappointed', 'useless', 'broken',
  'fail', 'failed', 'failure', 'error', 'problem', 'issue', 'wrong', 'not working',
  'doesn\'t work', 'won\'t work', 'can\'t', 'unable', 'impossible', 'waste', 'stupid'
]);

const INTENSIFIERS = new Set([
  'very', 'extremely', 'really', 'absolutely', 'completely', 'totally', 'so', 'too'
]);

const NEGATIONS = new Set([
  'not', 'no', 'never', 'none', 'nobody', 'nothing', 'neither', 'nowhere', 'isn\'t',
  'aren\'t', 'wasn\'t', 'weren\'t', 'haven\'t', 'hasn\'t', 'hadn\'t', 'won\'t', 'wouldn\'t',
  'don\'t', 'doesn\'t', 'didn\'t', 'can\'t', 'couldn\'t', 'shouldn\'t', 'wouldn\'t'
]);

const EMOTION_KEYWORDS = {
  anger: ['angry', 'mad', 'furious', 'rage', 'hate', 'pissed', 'outraged'],
  frustration: ['frustrated', 'frustrating', 'annoying', 'irritated', 'irritating'],
  sadness: ['sad', 'disappointed', 'unhappy', 'depressed', 'upset'],
  fear: ['worried', 'afraid', 'scared', 'anxious', 'nervous', 'concerned'],
  joy: ['happy', 'joyful', 'excited', 'thrilled', 'delighted', 'great', 'amazing'],
  surprise: ['surprised', 'shocked', 'unexpected', 'sudden', 'wow']
};

// ============================================================================
// Sentiment Analysis Service
// ============================================================================

export class SentimentAnalysisService {
  constructor(private db: D1Database) {}

  /**
   * Analyze sentiment of a user message
   */
  async analyzeMessage(
    conversationId: string,
    messageId: string,
    messageText: string,
    userId?: string
  ): Promise<SentimentAnalysis> {
    const startTime = Date.now();
    
    // Get previous message sentiment for context
    const previousMessage = await this.db
      .prepare(`
        SELECT sentiment_label, compound_score
        FROM message_sentiments
        WHERE conversation_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .bind(conversationId)
      .first<{ sentiment_label: string; compound_score: number }>();
    
    // Perform sentiment analysis
    const analysis = this.analyzeSentiment(messageText);
    
    // Detect emotion
    const emotion = this.detectEmotion(messageText);
    
    // Calculate sentiment change
    const sentimentChange = previousMessage 
      ? analysis.compound_score - previousMessage.compound_score
      : 0;
    
    // Check if this is first message
    const isFirstMessage = !previousMessage;
    
    // Determine suggested tone and urgency
    const toneAndUrgency = this.determineToneAndUrgency(
      analysis,
      emotion,
      sentimentChange,
      isFirstMessage
    );
    
    // Check escalation rules
    const escalation = await this.checkEscalationRules(
      conversationId,
      analysis,
      emotion
    );
    
    const analysisTime = Date.now() - startTime;
    
    // Store sentiment analysis
    await this.db
      .prepare(`
        INSERT INTO message_sentiments (
          conversation_id, message_id, user_id, message_text, message_length, word_count,
          sentiment_label, positive_score, negative_score, neutral_score, compound_score,
          primary_emotion, emotion_confidence,
          is_first_message, previous_sentiment, sentiment_change,
          suggested_tone, urgency_level, escalation_recommended, escalation_reason,
          analysis_model, analysis_time_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'vader', ?)
      `)
      .bind(
        conversationId,
        messageId,
        userId,
        messageText,
        messageText.length,
        messageText.split(/\s+/).length,
        analysis.sentiment_label,
        analysis.positive_score,
        analysis.negative_score,
        analysis.neutral_score,
        analysis.compound_score,
        emotion?.emotion || null,
        emotion?.confidence || null,
        isFirstMessage ? 1 : 0,
        previousMessage?.sentiment_label || null,
        sentimentChange,
        toneAndUrgency.tone,
        toneAndUrgency.urgency,
        escalation.recommended ? 1 : 0,
        escalation.reason || null,
        analysisTime
      )
      .run();
    
    // Update conversation trajectory
    await this.updateConversationTrajectory(conversationId, userId);
    
    return {
      ...analysis,
      primary_emotion: emotion?.emotion,
      emotion_confidence: emotion?.confidence,
      suggested_tone: toneAndUrgency.tone,
      urgency_level: toneAndUrgency.urgency,
      escalation_recommended: escalation.recommended,
      escalation_reason: escalation.reason
    };
  }

  /**
   * Core sentiment analysis logic (VADER-like)
   */
  private analyzeSentiment(text: string): {
    sentiment_label: 'positive' | 'negative' | 'neutral' | 'mixed';
    positive_score: number;
    negative_score: number;
    neutral_score: number;
    compound_score: number;
  } {
    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    let intensifierMultiplier = 1.0;
    let negationActive = false;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^\w]/g, '');
      
      // Check for intensifiers
      if (INTENSIFIERS.has(word)) {
        intensifierMultiplier = 1.5;
        continue;
      }
      
      // Check for negations
      if (NEGATIONS.has(word)) {
        negationActive = true;
        continue;
      }
      
      // Check sentiment
      if (POSITIVE_WORDS.has(word)) {
        if (negationActive) {
          negativeCount += 1 * intensifierMultiplier;
        } else {
          positiveCount += 1 * intensifierMultiplier;
        }
      } else if (NEGATIVE_WORDS.has(word)) {
        if (negationActive) {
          positiveCount += 1 * intensifierMultiplier;
        } else {
          negativeCount += 1 * intensifierMultiplier;
        }
      }
      
      // Reset modifiers after processing sentiment word
      if (POSITIVE_WORDS.has(word) || NEGATIVE_WORDS.has(word)) {
        intensifierMultiplier = 1.0;
        negationActive = false;
      }
    }
    
    // Normalize scores
    const total = positiveCount + negativeCount;
    const positiveScore = total > 0 ? positiveCount / total : 0;
    const negativeScore = total > 0 ? negativeCount / total : 0;
    const neutralScore = 1.0 - positiveScore - negativeScore;
    
    // Calculate compound score (-1 to 1)
    const compoundScore = total > 0 
      ? (positiveCount - negativeCount) / total 
      : 0;
    
    // Determine label
    let label: 'positive' | 'negative' | 'neutral' | 'mixed';
    if (Math.abs(compoundScore) < 0.1) {
      label = 'neutral';
    } else if (compoundScore > 0.5) {
      label = 'positive';
    } else if (compoundScore < -0.5) {
      label = 'negative';
    } else {
      label = 'mixed';
    }
    
    return {
      sentiment_label: label,
      positive_score: Math.max(0, Math.min(1, positiveScore)),
      negative_score: Math.max(0, Math.min(1, negativeScore)),
      neutral_score: Math.max(0, Math.min(1, neutralScore)),
      compound_score: Math.max(-1, Math.min(1, compoundScore))
    };
  }

  /**
   * Detect primary emotion from text
   */
  private detectEmotion(text: string): { emotion: string; confidence: number } | null {
    const lowerText = text.toLowerCase();
    const emotionScores: { [key: string]: number } = {};
    
    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          score += 1;
        }
      }
      if (score > 0) {
        emotionScores[emotion] = score;
      }
    }
    
    if (Object.keys(emotionScores).length === 0) {
      return null;
    }
    
    // Find dominant emotion
    const sortedEmotions = Object.entries(emotionScores)
      .sort(([, a], [, b]) => b - a);
    
    const [emotion, score] = sortedEmotions[0];
    const totalScore = Object.values(emotionScores).reduce((a, b) => a + b, 0);
    const confidence = score / totalScore;
    
    return { emotion, confidence };
  }

  /**
   * Determine appropriate response tone and urgency level
   */
  private determineToneAndUrgency(
    analysis: { sentiment_label: string; compound_score: number },
    emotion: { emotion: string; confidence: number } | null,
    sentimentChange: number,
    isFirstMessage: boolean
  ): { tone: string; urgency: 'low' | 'medium' | 'high' | 'critical' } {
    let tone = 'professional';
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    
    // Determine tone based on sentiment and emotion
    if (analysis.sentiment_label === 'negative') {
      if (emotion?.emotion === 'anger' && emotion.confidence > 0.7) {
        tone = 'apologetic';
        urgency = 'critical';
      } else if (emotion?.emotion === 'frustration') {
        tone = 'empathetic';
        urgency = 'high';
      } else if (analysis.compound_score < -0.7) {
        tone = 'empathetic';
        urgency = 'high';
      } else {
        tone = 'professional';
        urgency = 'medium';
      }
    } else if (analysis.sentiment_label === 'positive') {
      tone = 'friendly';
      urgency = 'low';
    } else {
      tone = 'professional';
      urgency = 'medium';
    }
    
    // Adjust for declining sentiment
    if (sentimentChange < -0.3 && !isFirstMessage) {
      urgency = urgency === 'low' ? 'medium' : urgency === 'medium' ? 'high' : 'critical';
    }
    
    return { tone, urgency };
  }

  /**
   * Check escalation rules based on sentiment
   */
  private async checkEscalationRules(
    conversationId: string,
    analysis: { compound_score: number },
    emotion: { emotion: string; confidence: number } | null
  ): Promise<{ recommended: boolean; reason?: string }> {
    // Get current trajectory
    const trajectory = await this.db
      .prepare('SELECT negative_streak_count, escalation_risk_score FROM conversation_sentiment_trajectory WHERE conversation_id = ?')
      .bind(conversationId)
      .first<{ negative_streak_count: number; escalation_risk_score: number }>();
    
    // Get active escalation rules
    const rules = await this.db
      .prepare('SELECT * FROM sentiment_escalation_rules WHERE is_active = 1 ORDER BY priority DESC')
      .all<any>();
    
    for (const rule of rules.results || []) {
      // Check negative streak
      if (rule.negative_streak_threshold && trajectory) {
        if (trajectory.negative_streak_count >= rule.negative_streak_threshold) {
          return {
            recommended: true,
            reason: `Negative streak threshold reached (${trajectory.negative_streak_count} messages)`
          };
        }
      }
      
      // Check compound score
      if (rule.compound_score_threshold) {
        if (analysis.compound_score <= rule.compound_score_threshold) {
          return {
            recommended: true,
            reason: `Severe negative sentiment detected (score: ${analysis.compound_score.toFixed(2)})`
          };
        }
      }
      
      // Check specific emotions
      if (rule.specific_emotions && emotion) {
        const targetEmotions: string[] = JSON.parse(rule.specific_emotions);
        if (targetEmotions.includes(emotion.emotion) && emotion.confidence > 0.6) {
          return {
            recommended: true,
            reason: `Strong ${emotion.emotion} emotion detected`
          };
        }
      }
    }
    
    return { recommended: false };
  }

  /**
   * Update conversation sentiment trajectory
   */
  private async updateConversationTrajectory(
    conversationId: string,
    userId?: string
  ): Promise<void> {
    // Get all messages for this conversation
    const messages = await this.db
      .prepare(`
        SELECT sentiment_label, compound_score, primary_emotion, created_at
        FROM message_sentiments
        WHERE conversation_id = ?
        ORDER BY created_at ASC
      `)
      .bind(conversationId)
      .all<any>();
    
    if (!messages.results || messages.results.length === 0) {
      return;
    }
    
    const messageList = messages.results;
    const firstMessage = messageList[0];
    const lastMessage = messageList[messageList.length - 1];
    
    // Calculate aggregate scores
    const avgPositive = messageList.reduce((sum, m) => sum + (m.compound_score > 0 ? m.compound_score : 0), 0) / messageList.length;
    const avgNegative = messageList.reduce((sum, m) => sum + (m.compound_score < 0 ? Math.abs(m.compound_score) : 0), 0) / messageList.length;
    const avgCompound = messageList.reduce((sum, m) => sum + m.compound_score, 0) / messageList.length;
    
    // Calculate volatility (standard deviation)
    const variance = messageList.reduce((sum, m) => {
      const diff = m.compound_score - avgCompound;
      return sum + diff * diff;
    }, 0) / messageList.length;
    const volatility = Math.sqrt(variance);
    
    // Calculate negative streak
    let currentStreak = 0;
    let maxStreak = 0;
    for (const msg of messageList.reverse()) {
      if (msg.sentiment_label === 'negative') {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    
    // Determine sentiment trend
    let trend: 'improving' | 'declining' | 'stable' | 'volatile';
    if (volatility > 0.5) {
      trend = 'volatile';
    } else if (messageList.length >= 3) {
      const recentAvg = messageList.slice(-3).reduce((sum, m) => sum + m.compound_score, 0) / 3;
      const olderAvg = messageList.slice(0, -3).reduce((sum, m) => sum + m.compound_score, 0) / Math.max(1, messageList.length - 3);
      
      if (recentAvg > olderAvg + 0.2) {
        trend = 'improving';
      } else if (recentAvg < olderAvg - 0.2) {
        trend = 'declining';
      } else {
        trend = 'stable';
      }
    } else {
      trend = 'stable';
    }
    
    // Calculate escalation risk score
    const riskFactors = [
      currentStreak >= 3 ? 0.4 : 0,
      avgCompound < -0.5 ? 0.3 : 0,
      volatility > 0.5 ? 0.2 : 0,
      trend === 'declining' ? 0.1 : 0
    ];
    const escalationRiskScore = Math.min(1.0, riskFactors.reduce((a, b) => a + b, 0));
    
    // Collect emotion sequence
    const emotionSequence = messageList.map(m => m.primary_emotion).filter(e => e);
    const emotionCounts: { [key: string]: number } = {};
    emotionSequence.forEach(e => {
      emotionCounts[e] = (emotionCounts[e] || 0) + 1;
    });
    const dominantEmotion = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;
    
    // Count sentiment labels
    const counts = {
      positive: messageList.filter(m => m.sentiment_label === 'positive').length,
      negative: messageList.filter(m => m.sentiment_label === 'negative').length,
      neutral: messageList.filter(m => m.sentiment_label === 'neutral').length
    };
    
    // Early warning trigger
    const earlyWarningTriggered = escalationRiskScore > 0.7 || currentStreak >= 3;
    
    // Upsert trajectory
    await this.db
      .prepare(`
        INSERT INTO conversation_sentiment_trajectory (
          conversation_id, user_id, initial_sentiment, current_sentiment, sentiment_trend,
          avg_positive_score, avg_negative_score, avg_compound_score,
          sentiment_volatility, negative_streak_count, max_negative_streak,
          emotion_sequence, dominant_emotion,
          escalation_risk_score, early_warning_triggered, early_warning_at,
          total_messages, positive_messages, negative_messages, neutral_messages,
          first_message_at, last_message_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (conversation_id) DO UPDATE SET
          current_sentiment = excluded.current_sentiment,
          sentiment_trend = excluded.sentiment_trend,
          avg_positive_score = excluded.avg_positive_score,
          avg_negative_score = excluded.avg_negative_score,
          avg_compound_score = excluded.avg_compound_score,
          sentiment_volatility = excluded.sentiment_volatility,
          negative_streak_count = excluded.negative_streak_count,
          max_negative_streak = excluded.max_negative_streak,
          emotion_sequence = excluded.emotion_sequence,
          dominant_emotion = excluded.dominant_emotion,
          escalation_risk_score = excluded.escalation_risk_score,
          early_warning_triggered = excluded.early_warning_triggered,
          early_warning_at = CASE WHEN excluded.early_warning_triggered = 1 AND conversation_sentiment_trajectory.early_warning_triggered = 0 THEN CURRENT_TIMESTAMP ELSE conversation_sentiment_trajectory.early_warning_at END,
          total_messages = excluded.total_messages,
          positive_messages = excluded.positive_messages,
          negative_messages = excluded.negative_messages,
          neutral_messages = excluded.neutral_messages,
          last_message_at = excluded.last_message_at,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(
        conversationId,
        userId,
        firstMessage.sentiment_label,
        lastMessage.sentiment_label,
        trend,
        avgPositive,
        avgNegative,
        avgCompound,
        volatility,
        currentStreak,
        maxStreak,
        JSON.stringify(emotionSequence),
        dominantEmotion,
        escalationRiskScore,
        earlyWarningTriggered ? 1 : 0,
        earlyWarningTriggered ? new Date().toISOString() : null,
        messageList.length,
        counts.positive,
        counts.negative,
        counts.neutral,
        firstMessage.created_at,
        lastMessage.created_at
      )
      .run();
  }

  /**
   * Get conversation sentiment trajectory
   */
  async getConversationTrajectory(conversationId: string): Promise<ConversationSentimentTrajectory | null> {
    const result = await this.db
      .prepare('SELECT * FROM conversation_sentiment_trajectory WHERE conversation_id = ?')
      .bind(conversationId)
      .first<any>();
    
    if (!result) {
      return null;
    }
    
    return {
      conversation_id: result.conversation_id,
      sentiment_trend: result.sentiment_trend,
      escalation_risk_score: result.escalation_risk_score,
      negative_streak_count: result.negative_streak_count,
      early_warning_triggered: !!result.early_warning_triggered
    };
  }

  /**
   * Get high-risk conversations
   */
  async getHighRiskConversations(limit: number = 20): Promise<any[]> {
    const result = await this.db
      .prepare('SELECT * FROM v_high_risk_conversations LIMIT ?')
      .bind(limit)
      .all();
    
    return result.results || [];
  }

  /**
   * Get sentiment trends
   */
  async getSentimentTrends(days: number = 7): Promise<any[]> {
    const result = await this.db
      .prepare('SELECT * FROM v_sentiment_trends_7d LIMIT ?')
      .bind(days)
      .all();
    
    return result.results || [];
  }

  /**
   * Get response template for sentiment
   */
  async getResponseTemplate(
    sentiment: string,
    urgency: string
  ): Promise<string | null> {
    const result = await this.db
      .prepare(`
        SELECT template_text
        FROM sentiment_response_templates
        WHERE target_sentiment = ?
          AND urgency_level = ?
          AND is_active = 1
        ORDER BY priority DESC, last_used_at ASC
        LIMIT 1
      `)
      .bind(sentiment, urgency)
      .first<{ template_text: string }>();
    
    if (result) {
      // Update last_used_at
      await this.db
        .prepare('UPDATE sentiment_response_templates SET last_used_at = CURRENT_TIMESTAMP WHERE template_text = ?')
        .bind(result.template_text)
        .run();
    }
    
    return result?.template_text || null;
  }

  /**
   * Aggregate daily sentiment analytics
   */
  async aggregateDailyAnalytics(date: string): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO sentiment_analytics_daily (
          date, total_messages, positive_messages, negative_messages, neutral_messages,
          avg_positive_score, avg_negative_score, avg_compound_score,
          total_conversations, conversations_with_escalation, avg_negative_streak
        )
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_messages,
          SUM(CASE WHEN sentiment_label = 'positive' THEN 1 ELSE 0 END) as positive_messages,
          SUM(CASE WHEN sentiment_label = 'negative' THEN 1 ELSE 0 END) as negative_messages,
          SUM(CASE WHEN sentiment_label = 'neutral' THEN 1 ELSE 0 END) as neutral_messages,
          AVG(CASE WHEN compound_score > 0 THEN compound_score ELSE 0 END) as avg_positive_score,
          AVG(CASE WHEN compound_score < 0 THEN ABS(compound_score) ELSE 0 END) as avg_negative_score,
          AVG(compound_score) as avg_compound_score,
          COUNT(DISTINCT conversation_id) as total_conversations,
          SUM(CASE WHEN escalation_recommended = 1 THEN 1 ELSE 0 END) as conversations_with_escalation,
          AVG(CASE WHEN sentiment_label = 'negative' THEN 1 ELSE 0 END) as avg_negative_streak
        FROM message_sentiments
        WHERE DATE(created_at) = ?
        GROUP BY DATE(created_at)
      `)
      .bind(date)
      .run();
  }
}
