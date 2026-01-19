import { createTool } from '@mastra/core';
import { z } from 'zod';
import { ampecoRequest } from '../utils/ampecoUtils';

export const ampecoStartChargingTool = createTool({
  id: 'ampeco-start-charging',
  description: 'Remotely start a charging session at a charge point. Requires charge point ID and EVSE ID. Useful when users want to start charging without being at the station.',
  inputSchema: z.object({
    chargePointId: z.string().describe('The charge point ID (e.g., "35")'),
    evseId: z.string().describe('The EVSE ID to start charging on (e.g., "33")'),
    userId: z.string().optional().describe('Optional user ID for the session'),
    idTag: z.string().optional().describe('Optional RFID tag/authorization ID'),
  }),
  execute: async ({ context }) => {
    try {
      const { chargePointId, evseId, userId, idTag } = context;

      // Build request body
      const requestBody: any = {
        evseId: parseInt(evseId),
      };

      if (userId) requestBody.userId = parseInt(userId);
      if (idTag) requestBody.idTag = idTag;

      // Start charging session
      const result = await ampecoRequest(
        `/public-api/actions/charge-point/v1.0/${chargePointId}/start`,
        {
          method: 'POST',
          body: requestBody,
          useCache: false,
        }
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to start charging session',
        };
      }

      return {
        success: true,
        message: 'Charging session started successfully',
        chargePointId,
        evseId,
        sessionData: result.data,
        instructions: [
          'The charging session has been initiated',
          'Please plug in the vehicle if not already connected',
          'Charging will begin automatically',
          'You can monitor progress in the app or dashboard',
        ],
      };
    } catch (error) {
      console.error('Start charging tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});
