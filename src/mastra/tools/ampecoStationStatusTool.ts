import { createTool } from '@mastra/core';
import { z } from 'zod';
import { findStationBySocketNumber, getStationStatus } from '../utils/ampecoUtils';

export const ampecoStationStatusTool = createTool({
  id: 'ampeco-station-status',
  description: 'Check the status of a charging station by socket number. Returns station availability, connector status, and current usage.',
  inputSchema: z.object({
    socketNumber: z.string().describe('The socket/station number (e.g., "12345", "ST-001")'),
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

      const { station, evse } = findResult;

      // Get detailed status
      const statusResult = await getStationStatus(station.id);

      if (!statusResult.success) {
        return {
          success: false,
          error: 'Failed to fetch station status',
        };
      }

      const stationData = statusResult.data;

      // Format response
      return {
        success: true,
        stationId: station.id,
        socketNumber: evse.socketNumber,
        name: station.name,
        location: station.location?.address || 'Unknown location',
        status: evse.status, // Available, Charging, Faulted, Unavailable
        connectorType: evse.connectorType,
        powerOutput: evse.maxPower ? `${evse.maxPower} kW` : 'Unknown',
        isAvailable: evse.status === 'Available',
        isFaulted: evse.status === 'Faulted',
        isCharging: evse.status === 'Charging',
        errorCode: evse.errorCode || null,
        lastUpdate: stationData.lastHeartbeat || stationData.updatedAt,
      };
    } catch (error) {
      console.error('Station status tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});
