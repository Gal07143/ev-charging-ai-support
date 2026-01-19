/**
 * Sentiment Analysis Tools
 * Mastra tools for real-time sentiment analysis and tone adjustment
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import type { D1Database } from '@cloudflare/workers-types';
import { SentimentAnalysisService } from '../../services/sentimentAnalysisService';

// ============================================================================
// Tool 1: Analyze Message Sentiment
// ============================================================================

export const analyzeMessageSentimentTool = createTool({
  id: 'analyze_message_sentiment',
  name: 'Analyze Message Sentiment',
  description: 'Analyze the sentiment and emotion of a user message in real-time. Returns sentiment scores, detected emotion, and recommended response tone.',
  inputSchema: z.object({
    conversation_id: z.string().describe('Current conversation ID'),
    message_id: z.string().describe('Unique message identifier'),
    message_text: z.string().describe('User message to analyze'),
    user_id: z.string().optional().describe('User identifier (optional)')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new SentimentAnalysisService(db);
    
    const analysis = await service.analyzeMessage(
      input.conversation_id,
      input.message_id,
      input.message_text,
      input.user_id
    );
    
    return {
      success: true,
      sentiment: {
        label: analysis.sentiment_label,
        compound_score: analysis.compound_score,
        positive_score: analysis.positive_score,
        negative_score: analysis.negative_score,
        neutral_score: analysis.neutral_score
      },
      emotion: {
        primary: analysis.primary_emotion,
        confidence: analysis.emotion_confidence
      },
      response_guidance: {
        suggested_tone: analysis.suggested_tone,
        urgency_level: analysis.urgency_level,
        escalation_recommended: analysis.escalation_recommended,
        escalation_reason: analysis.escalation_reason
      },
      message: `Sentiment: ${analysis.sentiment_label} (${(analysis.compound_score * 100).toFixed(0)}%), Tone: ${analysis.suggested_tone}, Urgency: ${analysis.urgency_level}`
    };
  }
});

// ============================================================================
// Tool 2: Get Conversation Sentiment Trajectory
// ============================================================================

export const getConversationTrajectoryTool = createTool({
  id: 'get_conversation_trajectory',
  name: 'Get Conversation Sentiment Trajectory',
  description: 'Get the emotional trajectory and sentiment trend for an ongoing conversation. Useful for understanding if user frustration is increasing.',
  inputSchema: z.object({
    conversation_id: z.string().describe('Conversation ID to analyze')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new SentimentAnalysisService(db);
    
    const trajectory = await service.getConversationTrajectory(input.conversation_id);
    
    if (!trajectory) {
      return {
        success: false,
        message: 'No sentiment data found for this conversation'
      };
    }
    
    return {
      success: true,
      trajectory: {
        trend: trajectory.sentiment_trend,
        escalation_risk_score: trajectory.escalation_risk_score,
        negative_streak_count: trajectory.negative_streak_count,
        early_warning_triggered: trajectory.early_warning_triggered
      },
      recommendations: this.generateRecommendations(trajectory),
      message: `Sentiment trend: ${trajectory.sentiment_trend}, Risk score: ${(trajectory.escalation_risk_score * 100).toFixed(0)}%`
    };
  }
});

function generateRecommendations(trajectory: any): string[] {
  const recommendations: string[] = [];
  
  if (trajectory.early_warning_triggered) {
    recommendations.push('⚠️ Early escalation warning triggered - consider involving human agent');
  }
  
  if (trajectory.negative_streak_count >= 3) {
    recommendations.push('🔴 User has sent 3+ consecutive negative messages - use empathetic tone');
  }
  
  if (trajectory.escalation_risk_score > 0.7) {
    recommendations.push('🚨 High escalation risk - prioritize quick resolution');
  }
  
  if (trajectory.sentiment_trend === 'declining') {
    recommendations.push('📉 Sentiment declining - adjust tone and offer immediate help');
  }
  
  if (trajectory.sentiment_trend === 'volatile') {
    recommendations.push('📊 Volatile sentiment - stay calm and professional');
  }
  
  if (trajectory.sentiment_trend === 'improving') {
    recommendations.push('✅ Sentiment improving - continue current approach');
  }
  
  return recommendations;
}

// ============================================================================
// Tool 3: Get High-Risk Conversations
// ============================================================================

export const getHighRiskConversationsTool = createTool({
  id: 'get_high_risk_conversations',
  name: 'Get High-Risk Conversations',
  description: 'Get a list of conversations with high escalation risk based on negative sentiment trends.',
  inputSchema: z.object({
    limit: z.number().optional().default(20).describe('Maximum number of conversations to return')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new SentimentAnalysisService(db);
    
    const conversations = await service.getHighRiskConversations(input.limit);
    
    return {
      success: true,
      count: conversations.length,
      conversations: conversations.map((c: any) => ({
        conversation_id: c.conversation_id,
        user_id: c.user_id,
        trend: c.sentiment_trend,
        risk_score: c.escalation_risk_score,
        negative_streak: c.negative_streak_count,
        early_warning: c.early_warning_triggered,
        message_count: c.message_count,
        minutes_since_last: c.minutes_since_last_message,
        dominant_emotion: c.dominant_emotion
      })),
      message: `Found ${conversations.length} high-risk conversations requiring attention`
    };
  }
});

// ============================================================================
// Tool 4: Get Response Template
// ============================================================================

export const getResponseTemplateTool = createTool({
  id: 'get_response_template',
  name: 'Get Sentiment-Aware Response Template',
  description: 'Get a pre-defined response template matched to the current user sentiment and urgency level.',
  inputSchema: z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral', 'frustrated', 'angry']).describe('Current user sentiment'),
    urgency: z.enum(['low', 'medium', 'high', 'critical']).describe('Urgency level')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new SentimentAnalysisService(db);
    
    const template = await service.getResponseTemplate(input.sentiment, input.urgency);
    
    if (!template) {
      return {
        success: false,
        message: 'No template found for this sentiment/urgency combination'
      };
    }
    
    return {
      success: true,
      template,
      guidance: {
        tone: this.getToneGuidance(input.sentiment, input.urgency),
        dos: this.getDos(input.sentiment),
        donts: this.getDonts(input.sentiment)
      },
      message: 'Response template retrieved successfully'
    };
  }
});

function getToneGuidance(sentiment: string, urgency: string): string {
  if (sentiment === 'angry' || urgency === 'critical') {
    return 'Use apologetic, de-escalating language. Acknowledge frustration immediately.';
  } else if (sentiment === 'negative' || sentiment === 'frustrated') {
    return 'Be empathetic and solution-focused. Show understanding of their situation.';
  } else if (sentiment === 'positive') {
    return 'Match their positive energy. Be friendly and enthusiastic.';
  } else {
    return 'Maintain professional, helpful tone. Stay focused on solving their issue.';
  }
}

function getDos(sentiment: string): string[] {
  const commonDos = [
    'Be specific about next steps',
    'Set clear expectations',
    'Offer alternatives if possible'
  ];
  
  if (sentiment === 'negative' || sentiment === 'frustrated' || sentiment === 'angry') {
    return [
      'Acknowledge their frustration immediately',
      'Apologize for the inconvenience',
      'Take ownership of the problem',
      ...commonDos
    ];
  } else if (sentiment === 'positive') {
    return [
      'Express enthusiasm',
      'Reinforce positive experience',
      ...commonDos
    ];
  } else {
    return commonDos;
  }
}

function getDonts(sentiment: string): string[] {
  const commonDonts = [
    'Don\'t make promises you can\'t keep',
    'Don\'t use technical jargon',
    'Don\'t be defensive'
  ];
  
  if (sentiment === 'negative' || sentiment === 'frustrated' || sentiment === 'angry') {
    return [
      'Don\'t minimize their feelings',
      'Don\'t blame them or other parties',
      'Don\'t use robotic language',
      ...commonDonts
    ];
  } else {
    return commonDonts;
  }
}

// ============================================================================
// Tool 5: Get Sentiment Trends
// ============================================================================

export const getSentimentTrendsTool = createTool({
  id: 'get_sentiment_trends',
  name: 'Get Sentiment Trends',
  description: 'Get sentiment trends over the last 7 days to understand overall user satisfaction patterns.',
  inputSchema: z.object({
    days: z.number().optional().default(7).describe('Number of days to analyze (default: 7)')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new SentimentAnalysisService(db);
    
    const trends = await service.getSentimentTrends(input.days);
    
    return {
      success: true,
      time_range: `Last ${input.days} days`,
      trends: trends.map((t: any) => ({
        date: t.date,
        total_messages: t.total_messages,
        positive_percent: t.positive_percent,
        negative_percent: t.negative_percent,
        neutral_percent: t.neutral_percent,
        avg_compound_score: t.avg_compound_score,
        escalation_rate: t.escalation_rate_percent
      })),
      summary: this.generateTrendSummary(trends),
      message: `Analyzed sentiment trends for ${input.days} days`
    };
  }
});

function generateTrendSummary(trends: any[]): any {
  if (trends.length === 0) {
    return { message: 'No data available' };
  }
  
  const latest = trends[0];
  const oldest = trends[trends.length - 1];
  
  const positiveChange = latest.positive_percent - oldest.positive_percent;
  const negativeChange = latest.negative_percent - oldest.negative_percent;
  
  return {
    overall_sentiment: latest.avg_compound_score > 0.1 ? 'Positive' : latest.avg_compound_score < -0.1 ? 'Negative' : 'Neutral',
    positive_trend: positiveChange > 5 ? '📈 Improving' : positiveChange < -5 ? '📉 Declining' : '➡️ Stable',
    negative_trend: negativeChange < -5 ? '✅ Improving' : negativeChange > 5 ? '⚠️ Worsening' : '➡️ Stable',
    escalation_rate: `${latest.escalation_rate_percent}%`,
    recommendation: positiveChange < -10 || negativeChange > 10 
      ? 'Consider reviewing recent changes or issues causing sentiment decline'
      : 'Sentiment trends are stable or improving'
  };
}

// ============================================================================
// Export All Tools
// ============================================================================

export const sentimentAnalysisTools = {
  analyzeMessageSentiment: analyzeMessageSentimentTool,
  getConversationTrajectory: getConversationTrajectoryTool,
  getHighRiskConversations: getHighRiskConversationsTool,
  getResponseTemplate: getResponseTemplateTool,
  getSentimentTrends: getSentimentTrendsTool
};
