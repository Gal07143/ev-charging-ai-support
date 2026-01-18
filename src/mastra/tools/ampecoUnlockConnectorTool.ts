import { createTool } from '@mastra/core';
import { z } from 'zod';
import { findStationBySocketNumber, unlockConnector } from '../utils/ampecoUtils';

export const ampecoUnlockConnectorTool = createTool({
  id: 'ampeco-unlock-connector',
  description: 'Unlock a stuck charging connector/cable at a station. Use this when a customer cannot remove the cable after charging.',
  inputSchema: z.object({
    socketNumber: z.string().describe('The socket/station number with the stuck connector'),
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

      const { evse } = findResult;

      // Unlock connector
      const unlockResult = await unlockConnector(evse.id);

      if (!unlockResult.success) {
        return {
          success: false,
          error: unlockResult.error || 'Unlock failed',
        };
      }

      return {
        success: true,
        message: `Connector at station ${socketNumber} unlocked successfully`,
        evseId: evse.id,
        instruction: 'Customer can now remove the cable. If still stuck, wait 30 seconds and try pulling gently.',
      };
    } catch (error) {
      console.error('Unlock connector tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});
