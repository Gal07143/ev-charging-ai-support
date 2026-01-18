import { createTool } from '@mastra/core';
import { z } from 'zod';
import { findStationBySocketNumber, getActiveSession } from '../utils/ampecoUtils';

export const ampecoActiveSessionTool = createTool({
  id: 'ampeco-active-session',
  description: 'Check the current active charging session at a station. Returns session details including kWh consumed, duration, and estimated cost.',
  inputSchema: z.object({
    socketNumber: z.string().describe('The socket/station number to check'),
  }),
  execute: async ({ context }) => {
    try {
      const { socketNumber } = context;

      // Find station by socket number
      const findResult = await findStationBySocketNumber(socketNumber);
      
      if (!findResult.success) {
        return {
          success: false,
          error: findResult.error || 'Station not found',
        };
      }

      const { station } = findResult;

      // Get active session
      const sessionResult = await getActiveSession(station.id);

      if (!sessionResult.success) {
        return {
          success: false,
          error: 'No active session found or failed to fetch session data',
          hasActiveSession: false,
        };
      }

      const session = sessionResult.data;

      if (!session || !session.id) {
        return {
          success: true,
          hasActiveSession: false,
          message: 'No active charging session at this station',
        };
      }

      // Calculate duration
      const startTime = new Date(session.startTime);
      const now = new Date();
      const durationMs = now.getTime() - startTime.getTime();
      const durationMinutes = Math.floor(durationMs / 60000);
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;

      return {
        success: true,
        hasActiveSession: true,
        sessionId: session.id,
        startTime: session.startTime,
        duration: `${hours}h ${minutes}m`,
        energyConsumed: session.energyConsumed ? `${session.energyConsumed.toFixed(2)} kWh` : 'Calculating...',
        estimatedCost: session.cost ? `${session.cost.toFixed(2)} ${session.currency || 'ILS'}` : 'Calculating...',
        chargingRate: session.currentPower ? `${session.currentPower} kW` : 'Unknown',
        userId: session.userId,
      };
    } catch (error) {
      console.error('Active session tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});
