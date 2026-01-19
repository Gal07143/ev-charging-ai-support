import { createTool } from '@mastra/core';
import { z } from 'zod';
import { ampecoRequest } from '../utils/ampecoUtils';

export const ampecoStopChargingTool = createTool({
  id: 'ampeco-stop-charging',
  description: 'Remotely stop an active charging session at a charge point. Use this when users want to stop charging before the vehicle is full or need to end the session.',
  inputSchema: z.object({
    chargePointId: z.string().describe('The charge point ID where charging should stop (e.g., "35")'),
    reason: z.string().optional().describe('Optional reason for stopping (e.g., "user_request", "emergency")'),
  }),
  execute: async ({ context }) => {
    try {
      const { chargePointId, reason } = context;

      // Build request body
      const requestBody: any = {};
      if (reason) requestBody.reason = reason;

      // Stop charging session
      const result = await ampecoRequest(
        `/public-api/actions/charge-point/v1.0/${chargePointId}/stop`,
        {
          method: 'POST',
          body: requestBody,
          useCache: false,
        }
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to stop charging session',
        };
      }

      return {
        success: true,
        message: 'Charging session stopped successfully',
        chargePointId,
        responseData: result.data,
        instructions: [
          'The charging session has been stopped',
          'Please wait 5-10 seconds for the system to process',
          'You can now unplug the vehicle',
          'Check your app for final session details and cost',
        ],
        nextSteps: [
          'Unplug the charging cable from your vehicle',
          'Return the cable to the holder if applicable',
          'Check your receipt/session summary',
        ],
      };
    } catch (error) {
      console.error('Stop charging tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});
