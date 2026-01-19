/**
 * Vehicle-Charger Compatibility Tools for Mastra Agent
 * EV model search, compatibility checks, OEM quirks
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { vehicleCompatibilityService } from '../../services/vehicleCompatibilityService';
import logger from '../../utils/logger';

/**
 * Tool: Search EV Models
 * Search for electric vehicle models by make/model
 */
export const searchEVModelsTool = createTool({
  id: 'searchEVModels',
  description: 'Search for electric vehicle models by make or model name. Returns vehicle specs including charging capabilities.',
  inputSchema: z.object({
    query: z.string().describe('Search query (make or model name, e.g., "Tesla Model 3", "BMW i4")'),
    limit: z.number().optional().default(10).describe('Maximum number of results')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    vehicles: z.array(z.object({
      vehicleId: z.string(),
      make: z.string(),
      model: z.string(),
      year: z.number(),
      batteryCapacityKwh: z.number(),
      rangeKm: z.number(),
      acMaxPowerKw: z.number(),
      dcMaxPowerKw: z.number(),
      acConnectorType: z.string(),
      dcConnectorType: z.string()
    })).optional(),
    count: z.number().optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { query, limit } = input;
      
      const vehicles = await vehicleCompatibilityService.searchEVModels(query, limit);
      
      return {
        success: true,
        vehicles,
        count: vehicles.length,
        message: `Found ${vehicles.length} vehicles matching "${query}"`
      };
      
    } catch (error) {
      logger.error('Error in searchEVModelsTool:', error);
      return {
        success: false,
        message: `Failed to search EV models: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Check Vehicle-Charger Compatibility
 * Check if a vehicle is compatible with a specific charger
 */
export const checkVehicleChargerCompatibilityTool = createTool({
  id: 'checkVehicleChargerCompatibility',
  description: 'Check compatibility between a vehicle and charger. Returns compatibility status, max charging rate, estimated time.',
  inputSchema: z.object({
    vehicleId: z.string().describe('Vehicle ID from searchEVModels'),
    chargerModelId: z.string().describe('Charger model ID'),
    sessionId: z.string().optional().describe('Current session ID'),
    userId: z.string().optional().describe('User ID')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    isCompatible: z.boolean().optional(),
    compatibilityScore: z.number().optional(),
    acCompatible: z.boolean().optional(),
    dcCompatible: z.boolean().optional(),
    maxChargingRateKw: z.number().optional(),
    estimatedChargeTimeMinutes: z.number().optional(),
    issues: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { vehicleId, chargerModelId, sessionId, userId } = input;
      
      const result = await vehicleCompatibilityService.checkCompatibility(
        vehicleId,
        chargerModelId,
        sessionId,
        userId
      );
      
      const message = result.isCompatible
        ? `✅ Compatible! Max ${result.maxChargingRateKw}kW, estimated ${result.estimatedChargeTimeMinutes} minutes to 80%`
        : `❌ Not compatible: ${result.issues.join(', ')}`;
      
      return {
        success: true,
        ...result,
        message
      };
      
    } catch (error) {
      logger.error('Error in checkVehicleChargerCompatibilityTool:', error);
      return {
        success: false,
        message: `Failed to check compatibility: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Get OEM Charging Quirks
 * Get OEM-specific charging quirks and recommendations
 */
export const getOEMChargingQuirksTool = createTool({
  id: 'getOEMChargingQuirks',
  description: 'Get OEM-specific charging quirks, limitations, and recommendations (e.g., Tesla adapter requirements, BMW preconditions).',
  inputSchema: z.object({
    make: z.string().describe('Vehicle make (e.g., "Tesla", "BMW", "Nissan")'),
    model: z.string().optional().describe('Vehicle model (optional)'),
    year: z.number().optional().describe('Vehicle year (optional)')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    quirks: z.array(z.object({
      make: z.string(),
      title: z.string(),
      description: z.string(),
      severity: z.string(),
      workaround: z.string().optional(),
      recommendation: z.string().optional()
    })).optional(),
    count: z.number().optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { make, model, year } = input;
      
      const quirks = await vehicleCompatibilityService.getOEMQuirks(make, model, year);
      
      return {
        success: true,
        quirks,
        count: quirks.length,
        message: quirks.length > 0
          ? `Found ${quirks.length} charging quirks for ${make}`
          : `No specific quirks found for ${make}`
      };
      
    } catch (error) {
      logger.error('Error in getOEMChargingQuirksTool:', error);
      return {
        success: false,
        message: `Failed to get OEM quirks: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Get Popular EV Models
 * Get list of most popular/commonly used EV models
 */
export const getPopularEVModelsTool = createTool({
  id: 'getPopularEVModels',
  description: 'Get list of most popular electric vehicle models based on user queries.',
  inputSchema: z.object({
    limit: z.number().optional().default(20).describe('Maximum number of results')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    vehicles: z.array(z.any()).optional(),
    count: z.number().optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { limit } = input;
      
      const vehicles = await vehicleCompatibilityService.getPopularEVModels(limit);
      
      return {
        success: true,
        vehicles,
        count: vehicles.length,
        message: `Retrieved ${vehicles.length} popular EV models`
      };
      
    } catch (error) {
      logger.error('Error in getPopularEVModelsTool:', error);
      return {
        success: false,
        message: `Failed to get popular EV models: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});
