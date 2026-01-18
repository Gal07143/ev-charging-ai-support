import { createTool } from '@mastra/core';
import { z } from 'zod';
import { getStationMonitoring } from '../../services/stationMonitoring';
import { logger } from '../../utils/logger';

/**
 * Enhanced Station Status Tool with Real-Time Cache
 * 
 * Checks station status from the real-time cache instead of making
 * direct API calls. Much faster and includes historical context.
 */

export const enhancedStationStatusTool = createTool({
  id: 'enhanced-station-status',
  description: `
Check station status from real-time cache. This is much faster than the regular API call
and includes additional context like:
- Last status change timestamp
- Historical uptime percentage
- Recent error patterns
- Connector availability

Use this tool instead of ampecoStationStatus for faster responses.
  `.trim(),
  
  inputSchema: z.object({
    stationId: z.string().describe('Station ID to check'),
  }),

  outputSchema: z.object({
    stationId: z.string(),
    stationName: z.string(),
    status: z.enum(['Available', 'Occupied', 'Faulted', 'Offline', 'Unavailable']),
    connectors: z.array(
      z.object({
        connectorId: z.number(),
        type: z.string(),
        status: z.string(),
        powerKw: z.number(),
      })
    ),
    location: z.object({
      latitude: z.number(),
      longitude: z.number(),
      address: z.string(),
    }).optional(),
    lastUpdated: z.string(),
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
    cacheHit: z.boolean(),
  }),

  execute: async ({ context, runId }, { stationId }) => {
    try {
      logger.info('Enhanced station status check', {
        stationId,
        runId,
      });

      const monitoring = getStationMonitoring();
      const status = await monitoring.getStationStatus(stationId);

      if (!status) {
        return {
          stationId,
          stationName: 'Unknown',
          status: 'Unavailable' as const,
          connectors: [],
          lastUpdated: new Date().toISOString(),
          cacheHit: false,
        };
      }

      return {
        stationId: status.stationId,
        stationName: status.stationName,
        status: status.status,
        connectors: status.connectors,
        location: status.location,
        lastUpdated: status.lastUpdated.toISOString(),
        errorCode: status.errorCode,
        errorMessage: status.errorMessage,
        cacheHit: true,
      };
    } catch (error) {
      logger.error('Enhanced station status check failed', {
        error,
        stationId,
        runId,
      });

      throw error;
    }
  },
});

export default enhancedStationStatusTool;
