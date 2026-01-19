/**
 * Quality Scoring Tools for Mastra Agent
 * Tools for conversation quality assessment and improvement
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { qualityScoringService, ConversationData } from '../../services/qualityScoringService';
import logger from '../../utils/logger';

/**
 * Tool: Score conversation quality
 */
export const scoreConversationQualityTool = createTool({
  id: 'scoreConversationQuality',
  name: 'Score Conversation Quality',
  description: `
    Score the quality of the current conversation across multiple dimensions.
    
    Use this tool at the END of a conversation to assess:
    - Resolution success (did we solve the issue?)
    - Efficiency (message count, duration)
    - Sentiment progression (improved or worsened?)
    - Tool usage effectiveness
    - Customer satisfaction
    
    Returns a comprehensive quality score (0-100) and actionable insights.
    
    This helps with:
    - Identifying areas for improvement
    - Tracking agent performance over time
    - A/B testing different approaches
    - Quality assurance
  `,
  inputSchema: z.object({
    conversationId: z.string().describe('Unique conversation identifier'),
    userId: z.string().describe('Discord user ID'),
    username: z.string().describe('Discord username'),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      timestamp: z.string(),
      sentiment: z.string().optional(),
      sentimentScore: z.number().optional()
    })).describe('Full conversation history'),
    toolsUsed: z.array(z.string()).describe('Tools used during conversation'),
    issueResolved: z.boolean().describe('Was the issue resolved?'),
    escalated: z.boolean().default(false).describe('Was conversation escalated?'),
    conversationStart: z.string().describe('ISO timestamp when conversation started'),
    conversationEnd: z.string().describe('ISO timestamp when conversation ended'),
    promptVariant: z.string().optional().describe('A/B test variant identifier'),
    experimentId: z.string().optional().describe('A/B test experiment ID')
  }),
  outputSchema: z.object({
    conversationId: z.string(),
    overallScore: z.number(),
    qualityGrade: z.string(),
    componentScores: z.object({
      resolution: z.number(),
      efficiency: z.number(),
      sentiment: z.number(),
      toolUsage: z.number(),
      satisfaction: z.number()
    }),
    isLowQuality: z.boolean(),
    qualityIssues: z.array(z.string()),
    improvementSuggestions: z.array(z.string()),
    summary: z.string()
  }),
  execute: async ({ context, ...input }) => {
    try {
      logger.info(`Scoring conversation quality: ${input.conversationId}`);
      
      // Build conversation data
      const conversationData: ConversationData = {
        conversationId: input.conversationId,
        userId: input.userId,
        username: input.username,
        messages: input.messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          timestamp: new Date(m.timestamp),
          sentiment: m.sentiment,
          sentimentScore: m.sentimentScore
        })),
        toolsUsed: input.toolsUsed,
        issueResolved: input.issueResolved,
        escalated: input.escalated,
        conversationStart: new Date(input.conversationStart),
        conversationEnd: new Date(input.conversationEnd),
        promptVariant: input.promptVariant,
        experimentId: input.experimentId
      };
      
      // Score the conversation
      const score = await qualityScoringService.scoreConversation(conversationData);
      
      // Generate summary
      let summary = `Conversation quality: ${score.qualityGrade} (${score.overallScore}/100). `;
      
      if (score.isLowQuality) {
        summary += `This is a low-quality conversation with ${score.qualityIssues.length} issues identified. `;
        summary += `Key improvements: ${score.improvementSuggestions.slice(0, 2).join('; ')}.`;
      } else if (score.overallScore >= 85) {
        summary += `Excellent performance! `;
        if (conversationData.issueResolved) {
          summary += `Issue resolved efficiently.`;
        }
      } else {
        summary += `Good performance with room for improvement. `;
        if (score.improvementSuggestions.length > 0) {
          summary += `Focus on: ${score.improvementSuggestions[0]}.`;
        }
      }
      
      return {
        conversationId: score.conversationId,
        overallScore: score.overallScore,
        qualityGrade: score.qualityGrade,
        componentScores: {
          resolution: score.resolutionScore,
          efficiency: score.efficiencyScore,
          sentiment: score.sentimentScore,
          toolUsage: score.toolUsageScore,
          satisfaction: score.satisfactionScore
        },
        isLowQuality: score.isLowQuality,
        qualityIssues: score.qualityIssues,
        improvementSuggestions: score.improvementSuggestions,
        summary
      };
      
    } catch (error) {
      logger.error('Error in scoreConversationQuality tool:', error);
      return {
        conversationId: input.conversationId,
        overallScore: 0,
        qualityGrade: 'F',
        componentScores: {
          resolution: 0,
          efficiency: 0,
          sentiment: 0,
          toolUsage: 0,
          satisfaction: 0
        },
        isLowQuality: true,
        qualityIssues: ['scoring_error'],
        improvementSuggestions: ['Fix scoring system error'],
        summary: 'Failed to score conversation quality'
      };
    }
  }
});

/**
 * Tool: Get quality analytics
 */
export const getQualityAnalyticsTool = createTool({
  id: 'getQualityAnalytics',
  name: 'Get Quality Analytics',
  description: 'Get conversation quality analytics and trends for the last N days',
  inputSchema: z.object({
    days: z.number().default(7).describe('Number of days to look back')
  }),
  outputSchema: z.object({
    analytics: z.array(z.record(z.any())),
    summary: z.object({
      avgScore: z.number(),
      totalConversations: z.number(),
      lowQualityRate: z.number(),
      topGrade: z.string()
    })
  }),
  execute: async ({ context, days }) => {
    try {
      const analytics = await qualityScoringService.getAnalytics(days);
      
      // Calculate summary
      const totalConversations = analytics.reduce((sum, a) => sum + (a.total_conversations || 0), 0);
      const avgScore = analytics.reduce((sum, a) => sum + (parseFloat(a.avg_overall_score) || 0), 0) / analytics.length;
      const lowQualityRate = analytics.reduce((sum, a) => sum + (parseFloat(a.low_quality_rate) || 0), 0) / analytics.length;
      
      // Find most common grade
      const allGrades: Record<string, number> = {};
      for (const day of analytics) {
        if (day.grade_distribution) {
          for (const [grade, count] of Object.entries(day.grade_distribution)) {
            allGrades[grade] = (allGrades[grade] || 0) + (count as number);
          }
        }
      }
      const topGrade = Object.entries(allGrades).sort((a, b) => b[1] - a[1])[0]?.[0] || 'B';
      
      return {
        analytics,
        summary: {
          avgScore: Math.round(avgScore * 10) / 10,
          totalConversations,
          lowQualityRate: Math.round(lowQualityRate * 100) / 100,
          topGrade
        }
      };
    } catch (error) {
      logger.error('Error getting quality analytics:', error);
      return {
        analytics: [],
        summary: {
          avgScore: 0,
          totalConversations: 0,
          lowQualityRate: 0,
          topGrade: 'N/A'
        }
      };
    }
  }
});

/**
 * Tool: Get low-quality conversations
 */
export const getLowQualityConversationsTool = createTool({
  id: 'getLowQualityConversations',
  name: 'Get Low-Quality Conversations',
  description: 'Get list of recent low-quality conversations for review and improvement',
  inputSchema: z.object({
    limit: z.number().default(20).describe('Maximum number of conversations to return')
  }),
  outputSchema: z.object({
    conversations: z.array(z.record(z.any())),
    count: z.number(),
    commonIssues: z.array(z.string())
  }),
  execute: async ({ context, limit }) => {
    try {
      const conversations = await qualityScoringService.getLowQualityConversations(limit);
      
      // Extract common issues
      const issueCount: Record<string, number> = {};
      for (const conv of conversations) {
        if (conv.quality_issues) {
          for (const issue of conv.quality_issues) {
            issueCount[issue] = (issueCount[issue] || 0) + 1;
          }
        }
      }
      
      const commonIssues = Object.entries(issueCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([issue]) => issue);
      
      return {
        conversations,
        count: conversations.length,
        commonIssues
      };
    } catch (error) {
      logger.error('Error getting low-quality conversations:', error);
      return {
        conversations: [],
        count: 0,
        commonIssues: []
      };
    }
  }
});

/**
 * Tool: Get tool effectiveness
 */
export const getToolEffectivenessTool = createTool({
  id: 'getToolEffectiveness',
  name: 'Get Tool Effectiveness',
  description: 'Get effectiveness metrics for each tool (which tools correlate with high-quality conversations)',
  inputSchema: z.object({}),
  outputSchema: z.object({
    tools: z.array(z.record(z.any())),
    recommendations: z.array(z.string())
  }),
  execute: async ({ context }) => {
    try {
      const tools = await qualityScoringService.getToolEffectiveness();
      
      // Generate recommendations
      const recommendations: string[] = [];
      
      // Find most effective tools
      const topTools = tools.filter(t => t.quality_delta > 5).slice(0, 3);
      if (topTools.length > 0) {
        recommendations.push(`Most effective tools: ${topTools.map(t => t.tool_name).join(', ')}`);
      }
      
      // Find least effective tools
      const bottomTools = tools.filter(t => t.quality_delta < -5).slice(0, 2);
      if (bottomTools.length > 0) {
        recommendations.push(`Consider reducing usage of: ${bottomTools.map(t => t.tool_name).join(', ')}`);
      }
      
      // Underutilized tools
      const underused = tools.filter(t => t.total_usage < 10 && t.quality_delta > 0).slice(0, 2);
      if (underused.length > 0) {
        recommendations.push(`Underutilized but effective: ${underused.map(t => t.tool_name).join(', ')}`);
      }
      
      return {
        tools,
        recommendations
      };
    } catch (error) {
      logger.error('Error getting tool effectiveness:', error);
      return {
        tools: [],
        recommendations: []
      };
    }
  }
});
