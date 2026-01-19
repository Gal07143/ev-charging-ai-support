import { createTool } from '@mastra/core';
import { z } from 'zod';
import { chargerDb } from '../../services/chargerDatabase.js';
import { logger } from '../../utils/logger.js';

/**
 * Tool: Search Charger Models
 * Find charger specifications by manufacturer or model name
 */
export const searchChargerModelsTool = createTool({
  id: 'searchChargerModels',
  description: `Search for EV charger models by manufacturer or model name.
  Use this when user mentions a specific charger brand or model.
  Returns specifications: power, connectors, compatibility, common issues.
  
  Examples:
  - "ABB Terra" → finds all ABB Terra models
  - "Tritium" → finds all Tritium chargers
  - "50kW DC" → use error message, this requires different query`,
  inputSchema: z.object({
    query: z.string().describe('Search term: manufacturer name (e.g., "ABB", "Tritium") or model name (e.g., "Terra 54", "PKM150")'),
  }),
  execute: async ({ context }) => {
    try {
      const { query } = context;
      
      const models = await chargerDb.searchChargerModels(query);
      
      if (models.length === 0) {
        return {
          success: true,
          found: false,
          message: `No charger models found matching "${query}"`,
        };
      }

      logger.info('Charger models searched', { query, found: models.length });

      return {
        success: true,
        found: true,
        count: models.length,
        models: models.map(m => ({
          manufacturer: m.manufacturer,
          model: m.modelName,
          family: m.modelFamily,
          power: `${m.maxPowerKw}kW ${m.chargingType}`,
          connectors: m.connectorTypes.join(', '),
          commonIssues: m.commonIssues,
          notes: m.notes,
        })),
      };
    } catch (error: any) {
      logger.error('Failed to search charger models', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Tool: Lookup Error Code
 * Get detailed information about a charger error code
 */
export const lookupErrorCodeTool = createTool({
  id: 'lookupErrorCode',
  description: `Look up detailed information about a charger error code.
  Use this when user reports an error code like "E42", "E01", "F10", etc.
  Returns: error name, severity, symptoms, causes, troubleshooting steps.
  
  Critical: This is one of the MOST IMPORTANT tools for solving charging issues!`,
  inputSchema: z.object({
    errorCode: z.string().describe('Error code (e.g., "E42", "E01", "F10", "0x12")'),
    manufacturer: z.string().optional().describe('Charger manufacturer (e.g., "ABB", "Tritium") - optional but recommended for accuracy'),
  }),
  execute: async ({ context }) => {
    try {
      const { errorCode, manufacturer } = context;
      
      const errors = await chargerDb.lookupErrorCode(errorCode, manufacturer);
      
      if (errors.length === 0) {
        return {
          success: true,
          found: false,
          message: `Error code "${errorCode}" not found in database${manufacturer ? ` for ${manufacturer}` : ''}`,
          suggestion: 'Try searching the knowledge base with semanticSearch for this error code',
        };
      }

      const primaryError = errors[0];

      logger.info('Error code looked up', { errorCode, manufacturer, found: errors.length });

      return {
        success: true,
        found: true,
        errorCode: primaryError.errorCode,
        errorName: primaryError.errorName,
        manufacturer: primaryError.manufacturer,
        severity: primaryError.severity,
        category: primaryError.category,
        description: primaryError.description,
        symptoms: primaryError.symptoms,
        commonCauses: primaryError.commonCauses,
        troubleshootingSteps: primaryError.troubleshootingSteps,
        resolutionTimeMinutes: primaryError.resolutionTimeAvgMinutes,
        requiresTechnician: primaryError.requiresTechnician,
        requiresPartReplacement: primaryError.requiresPartReplacement,
        partsNeeded: primaryError.partsNeeded,
        frequency: primaryError.occurrenceFrequency,
        relatedErrorCodes: primaryError.relatedErrorCodes,
        notes: primaryError.notes,
        alternativeMatches: errors.slice(1).map(e => ({
          manufacturer: e.manufacturer,
          errorName: e.errorName,
        })),
      };
    } catch (error: any) {
      logger.error('Failed to lookup error code', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Tool: Get Charger Specifications
 * Get detailed specifications for a specific charger model
 */
export const getChargerSpecsTool = createTool({
  id: 'getChargerSpecs',
  description: `Get detailed specifications for a specific charger model.
  Use when you need exact specs about power, connectors, or compatibility.`,
  inputSchema: z.object({
    manufacturer: z.string().describe('Manufacturer name (e.g., "ABB", "Tritium", "Kempower")'),
    modelName: z.string().describe('Model name (e.g., "Terra 54", "PKM150", "Satellite")'),
  }),
  execute: async ({ context }) => {
    try {
      const { manufacturer, modelName } = context;
      
      const model = await chargerDb.getChargerModel(manufacturer, modelName);
      
      if (!model) {
        return {
          success: true,
          found: false,
          message: `Charger model "${manufacturer} ${modelName}" not found`,
        };
      }

      logger.info('Charger specs retrieved', { manufacturer, modelName });

      return {
        success: true,
        found: true,
        manufacturer: model.manufacturer,
        model: model.modelName,
        family: model.modelFamily,
        specifications: {
          maxPowerKw: model.maxPowerKw,
          chargingType: model.chargingType,
          connectorTypes: model.connectorTypes,
          voltageRange: model.voltageRange,
          currentRating: `${model.currentRatingAmps}A`,
          communicationProtocols: model.communicationProtocol,
          paymentMethods: model.paymentMethods,
        },
        physical: {
          dimensions: model.dimensions,
          weight: `${model.weightKg}kg`,
          ipRating: model.ipRating,
          operatingTempRange: model.operatingTempRange,
        },
        support: {
          warrantyYears: model.warrantyYears,
          commonIssues: model.commonIssues,
          notes: model.notes,
        },
      };
    } catch (error: any) {
      logger.error('Failed to get charger specs', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Tool: Search Troubleshooting Guides
 * Find troubleshooting guides for common issues
 */
export const searchTroubleshootingTool = createTool({
  id: 'searchTroubleshooting',
  description: `Search for troubleshooting guides for common charger issues.
  Use when you need step-by-step diagnostic procedures.
  
  Examples: "slow charging", "won't start", "connector stuck", "RCD fault"`,
  inputSchema: z.object({
    query: z.string().describe('Issue description (e.g., "slow charging", "connector stuck", "RCD fault")'),
    manufacturer: z.string().optional().describe('Limit to specific manufacturer (optional)'),
  }),
  execute: async ({ context }) => {
    try {
      const { query, manufacturer } = context;
      
      const guides = await chargerDb.searchTroubleshootingGuides(query, manufacturer);
      
      if (guides.length === 0) {
        return {
          success: true,
          found: false,
          message: `No troubleshooting guides found for "${query}"`,
        };
      }

      logger.info('Troubleshooting guides searched', { query, found: guides.length });

      // Increment view count for the first guide
      if (guides.length > 0) {
        await chargerDb.incrementGuideViews(guides[0].id);
      }

      return {
        success: true,
        found: true,
        count: guides.length,
        guides: guides.map(g => ({
          id: g.id,
          manufacturer: g.manufacturer,
          issueTitle: g.issueTitle,
          issueDescription: g.issueDescription,
          category: g.issueCategory,
          diagnosticSteps: g.diagnosticSteps,
          resolutionSteps: g.resolutionSteps,
          preventiveMeasures: g.preventiveMeasures,
          estimatedTime: `${g.estimatedResolutionTimeMinutes} minutes`,
          skillLevel: g.skillLevelRequired,
          toolsRequired: g.toolsRequired,
          successRate: `${(g.successRate * 100).toFixed(0)}%`,
          views: g.viewsCount,
          helpful: g.helpfulCount,
        })),
      };
    } catch (error: any) {
      logger.error('Failed to search troubleshooting guides', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Tool: Check Vehicle Compatibility
 * Check if a vehicle is compatible with specific chargers
 */
export const checkVehicleCompatibilityTool = createTool({
  id: 'checkVehicleCompatibility',
  description: `Check vehicle-charger compatibility and get max charging speed.
  Use when user asks about their specific vehicle.`,
  inputSchema: z.object({
    vehicleMake: z.string().describe('Vehicle manufacturer (e.g., "Tesla", "BMW", "Nissan")'),
    vehicleModel: z.string().describe('Vehicle model (e.g., "Model 3", "i4", "Leaf")'),
    chargerManufacturer: z.string().optional().describe('Specific charger manufacturer to check (optional)'),
  }),
  execute: async ({ context }) => {
    try {
      const { vehicleMake, vehicleModel, chargerManufacturer } = context;
      
      const compatibility = await chargerDb.checkCompatibility(
        vehicleMake,
        vehicleModel,
        chargerManufacturer
      );
      
      if (compatibility.length === 0) {
        return {
          success: true,
          found: false,
          message: `No compatibility data found for ${vehicleMake} ${vehicleModel}`,
        };
      }

      logger.info('Vehicle compatibility checked', { vehicleMake, vehicleModel, found: compatibility.length });

      return {
        success: true,
        found: true,
        vehicle: `${vehicleMake} ${vehicleModel}`,
        compatibleChargers: compatibility.map(c => ({
          charger: `${c.chargerManufacturer} ${c.chargerModel}`,
          status: c.compatibilityStatus,
          maxSpeedKw: c.maxChargingSpeedKw,
          connectorRequired: c.connectorRequired,
          adapterNeeded: c.adapterNeeded,
          notes: c.notes,
          tested: c.tested,
        })),
      };
    } catch (error: any) {
      logger.error('Failed to check vehicle compatibility', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Tool: Get Charger Database Stats
 * Get statistics about the charger database
 */
export const getChargerStatsTool = createTool({
  id: 'getChargerStats',
  description: 'Get statistics about the charger database (total models, error codes, manufacturers)',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const stats = await chargerDb.getChargerStatistics();
      
      return {
        success: true,
        statistics: {
          totalChargerModels: stats.totalModels,
          totalErrorCodes: stats.totalErrorCodes,
          manufacturersSupported: stats.manufacturerCount,
          avgMaxPowerKw: Math.round(stats.avgMaxPowerKw),
        },
      };
    } catch (error: any) {
      logger.error('Failed to get charger stats', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});
