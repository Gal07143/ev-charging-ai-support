import { createTool } from '@mastra/core';
import { z } from 'zod';
import { findStationBySocketNumber, getTariffInfo } from '../utils/ampecoUtils';

export const ampecoTariffTool = createTool({
  id: 'ampeco-tariff',
  description: 'Get pricing/tariff information for a charging station. Returns cost per kWh, parking fees, and other charges.',
  inputSchema: z.object({
    socketNumber: z.string().describe('The socket/station number to get pricing for'),
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

      // Get tariff info
      const tariffResult = await getTariffInfo(station.id);

      if (!tariffResult.success) {
        return {
          success: false,
          error: tariffResult.error || 'Failed to fetch tariff information',
        };
      }

      const tariff = tariffResult.data;

      return {
        success: true,
        stationId: station.id,
        socketNumber,
        stationName: station.name,
        currency: tariff.currency || 'ILS',
        pricePerKwh: tariff.pricePerKwh ? `${tariff.pricePerKwh.toFixed(2)}` : 'N/A',
        parkingFee: tariff.parkingFee ? `${tariff.parkingFee.toFixed(2)} per hour` : 'None',
        sessionStartFee: tariff.sessionStartFee ? `${tariff.sessionStartFee.toFixed(2)}` : 'None',
        minimumCharge: tariff.minimumCharge ? `${tariff.minimumCharge.toFixed(2)}` : 'None',
        freeMinutes: tariff.freeParkingMinutes || 0,
        tariffName: tariff.name || 'Standard tariff',
        description: tariff.description || 'Standard charging rates apply',
      };
    } catch (error) {
      console.error('Tariff tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});
