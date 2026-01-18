import { createTool } from '@mastra/core';
import { z } from 'zod';
import { findStationBySocketNumber, resetStation } from '../utils/ampecoUtils';

export const ampecoResetStationTool = createTool({
  id: 'ampeco-reset-station',
  description: 'Remotely reset a charging station. Use soft reset first (restarts station software). Use hard reset only if soft reset fails (power cycle).',
  inputSchema: z.object({
    socketNumber: z.string().describe('The socket/station number to reset'),
    resetType: z.enum(['soft', 'hard']).default('soft').describe('Type of reset: soft (software restart) or hard (power cycle)'),
  }),
  execute: async ({ context }) => {
    try {
      const { socketNumber, resetType } = context;

      // Find station by socket number
      const findResult = await findStationBySocketNumber(socketNumber);
      
      if (!findResult.success) {
        return {
          success: false,
          error: findResult.error || 'Station not found',
        };
      }

      const { station } = findResult;

      // Perform reset
      const resetResult = await resetStation(station.id, resetType);

      if (!resetResult.success) {
        return {
          success: false,
          error: resetResult.error || 'Reset failed',
        };
      }

      return {
        success: true,
        message: `Station ${socketNumber} ${resetType} reset initiated successfully`,
        stationId: station.id,
        resetType,
        estimatedTime: resetType === 'soft' ? '30-60 seconds' : '2-3 minutes',
      };
    } catch (error) {
      console.error('Reset station tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});
