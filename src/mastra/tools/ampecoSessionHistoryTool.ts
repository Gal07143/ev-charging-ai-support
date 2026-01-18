import { createTool } from '@mastra/core';
import { z } from 'zod';
import { getSessionHistory } from '../utils/ampecoUtils';

export const ampecoSessionHistoryTool = createTool({
  id: 'ampeco-session-history',
  description: 'Get charging session history for a user. Returns the last 5 sessions with dates, energy consumed, duration, and costs.',
  inputSchema: z.object({
    userId: z.string().describe('The user ID or email to get session history for'),
    limit: z.number().default(5).describe('Number of sessions to retrieve (default: 5)'),
  }),
  execute: async ({ context }) => {
    try {
      const { userId, limit } = context;

      // Get session history
      const historyResult = await getSessionHistory(userId, limit);

      if (!historyResult.success) {
        return {
          success: false,
          error: historyResult.error || 'Failed to fetch session history',
        };
      }

      const sessions = historyResult.data?.sessions || [];

      if (sessions.length === 0) {
        return {
          success: true,
          sessions: [],
          message: 'No charging sessions found for this user',
        };
      }

      // Format sessions
      const formattedSessions = sessions.map((session: any) => {
        const startTime = new Date(session.startTime);
        const endTime = session.endTime ? new Date(session.endTime) : null;
        
        let duration = 'N/A';
        if (endTime) {
          const durationMs = endTime.getTime() - startTime.getTime();
          const durationMinutes = Math.floor(durationMs / 60000);
          const hours = Math.floor(durationMinutes / 60);
          const minutes = durationMinutes % 60;
          duration = `${hours}h ${minutes}m`;
        }

        return {
          sessionId: session.id,
          date: startTime.toLocaleDateString('he-IL'),
          time: startTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
          stationName: session.stationName || 'Unknown station',
          socketNumber: session.socketNumber || 'N/A',
          energyConsumed: session.energyConsumed ? `${session.energyConsumed.toFixed(2)} kWh` : 'N/A',
          duration,
          cost: session.cost ? `${session.cost.toFixed(2)} ${session.currency || 'ILS'}` : 'N/A',
          status: session.status || 'Completed',
        };
      });

      return {
        success: true,
        sessions: formattedSessions,
        totalSessions: formattedSessions.length,
      };
    } catch (error) {
      console.error('Session history tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});
