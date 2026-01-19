import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

export interface ChargerModel {
  id: number;
  manufacturer: string;
  modelName: string;
  modelFamily: string | null;
  connectorTypes: string[];
  maxPowerKw: number;
  chargingType: 'AC' | 'DC' | 'Both';
  voltageRange: string;
  currentRatingAmps: number;
  communicationProtocol: string[];
  displayType: string;
  paymentMethods: string[];
  ipRating: string;
  operatingTempRange: string;
  dimensions: string;
  weightKg: number;
  warrantyYears: number;
  commonIssues: string[];
  notes: string;
}

export interface ErrorCode {
  id: number;
  manufacturer: string;
  modelFamily: string | null;
  errorCode: string;
  errorName: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  symptoms: string[];
  commonCauses: string[];
  troubleshootingSteps: string[];
  resolutionTimeAvgMinutes: number;
  requiresTechnician: boolean;
  requiresPartReplacement: boolean;
  partsNeeded: string[];
  occurrenceFrequency: 'very_common' | 'common' | 'occasional' | 'rare';
  relatedErrorCodes: string[];
  notes: string;
}

export interface TroubleshootingGuide {
  id: number;
  manufacturer: string;
  modelFamily: string | null;
  issueTitle: string;
  issueDescription: string;
  issueCategory: string;
  diagnosticSteps: any; // JSONB
  resolutionSteps: string[];
  preventiveMeasures: string[];
  estimatedResolutionTimeMinutes: number;
  skillLevelRequired: 'user' | 'operator' | 'technician' | 'engineer';
  toolsRequired: string[];
  successRate: number;
  viewsCount: number;
  helpfulCount: number;
}

/**
 * Charger Database Service
 * Query charger specifications, error codes, and troubleshooting guides
 */
export class ChargerDatabaseService {
  
  /**
   * Search charger models by manufacturer or model name
   */
  async searchChargerModels(query: string): Promise<ChargerModel[]> {
    try {
      const result = await db.query(
        `SELECT 
          id, manufacturer, model_name as "modelName", model_family as "modelFamily",
          connector_types as "connectorTypes", max_power_kw as "maxPowerKw",
          charging_type as "chargingType", voltage_range as "voltageRange",
          current_rating_amps as "currentRatingAmps", 
          communication_protocol as "communicationProtocol",
          display_type as "displayType", payment_methods as "paymentMethods",
          ip_rating as "ipRating", operating_temp_range as "operatingTempRange",
          dimensions, weight_kg as "weightKg", warranty_years as "warrantyYears",
          common_issues as "commonIssues", notes
         FROM charger_models
         WHERE 
          manufacturer ILIKE $1 OR 
          model_name ILIKE $1 OR
          model_family ILIKE $1
         ORDER BY manufacturer, model_name
         LIMIT 10`,
        [`%${query}%`]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to search charger models', error);
      return [];
    }
  }

  /**
   * Get charger model by exact manufacturer and model name
   */
  async getChargerModel(manufacturer: string, modelName: string): Promise<ChargerModel | null> {
    try {
      const result = await db.query(
        `SELECT 
          id, manufacturer, model_name as "modelName", model_family as "modelFamily",
          connector_types as "connectorTypes", max_power_kw as "maxPowerKw",
          charging_type as "chargingType", voltage_range as "voltageRange",
          current_rating_amps as "currentRatingAmps",
          communication_protocol as "communicationProtocol",
          display_type as "displayType", payment_methods as "paymentMethods",
          ip_rating as "ipRating", operating_temp_range as "operatingTempRange",
          dimensions, weight_kg as "weightKg", warranty_years as "warrantyYears",
          common_issues as "commonIssues", notes
         FROM charger_models
         WHERE manufacturer ILIKE $1 AND model_name ILIKE $2
         LIMIT 1`,
        [manufacturer, modelName]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get charger model', error);
      return null;
    }
  }

  /**
   * Look up error code details
   */
  async lookupErrorCode(errorCode: string, manufacturer?: string): Promise<ErrorCode[]> {
    try {
      let query = `
        SELECT 
          id, manufacturer, model_family as "modelFamily", error_code as "errorCode",
          error_name as "errorName", description, severity, category, symptoms,
          common_causes as "commonCauses", troubleshooting_steps as "troubleshootingSteps",
          resolution_time_avg_minutes as "resolutionTimeAvgMinutes",
          requires_technician as "requiresTechnician",
          requires_part_replacement as "requiresPartReplacement",
          parts_needed as "partsNeeded", occurrence_frequency as "occurrenceFrequency",
          related_error_codes as "relatedErrorCodes", notes
        FROM charger_error_codes
        WHERE error_code ILIKE $1
      `;

      const params: any[] = [errorCode];

      if (manufacturer) {
        query += ` AND (manufacturer ILIKE $2 OR manufacturer = 'Generic')`;
        params.push(manufacturer);
      }

      query += ` ORDER BY 
        CASE 
          WHEN manufacturer = $${manufacturer ? 2 : 1} THEN 1
          WHEN manufacturer = 'Generic' THEN 3
          ELSE 2
        END,
        severity DESC
        LIMIT 5`;

      const result = await db.query(query, params);

      return result.rows;
    } catch (error) {
      logger.error('Failed to lookup error code', error);
      return [];
    }
  }

  /**
   * Get all error codes for a specific manufacturer
   */
  async getManufacturerErrorCodes(manufacturer: string): Promise<ErrorCode[]> {
    try {
      const result = await db.query(
        `SELECT 
          id, manufacturer, model_family as "modelFamily", error_code as "errorCode",
          error_name as "errorName", description, severity, category, symptoms,
          common_causes as "commonCauses", troubleshooting_steps as "troubleshootingSteps",
          resolution_time_avg_minutes as "resolutionTimeAvgMinutes",
          requires_technician as "requiresTechnician",
          requires_part_replacement as "requiresPartReplacement",
          parts_needed as "partsNeeded", occurrence_frequency as "occurrenceFrequency",
          related_error_codes as "relatedErrorCodes", notes
         FROM charger_error_codes
         WHERE manufacturer ILIKE $1
         ORDER BY severity DESC, occurrence_frequency DESC`,
        [manufacturer]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get manufacturer error codes', error);
      return [];
    }
  }

  /**
   * Search troubleshooting guides
   */
  async searchTroubleshootingGuides(
    query: string,
    manufacturer?: string
  ): Promise<TroubleshootingGuide[]> {
    try {
      let sqlQuery = `
        SELECT 
          id, manufacturer, model_family as "modelFamily", issue_title as "issueTitle",
          issue_description as "issueDescription", issue_category as "issueCategory",
          diagnostic_steps as "diagnosticSteps", resolution_steps as "resolutionSteps",
          preventive_measures as "preventiveMeasures",
          estimated_resolution_time_minutes as "estimatedResolutionTimeMinutes",
          skill_level_required as "skillLevelRequired", tools_required as "toolsRequired",
          success_rate as "successRate", views_count as "viewsCount",
          helpful_count as "helpfulCount"
        FROM troubleshooting_guides
        WHERE (
          issue_title ILIKE $1 OR
          issue_description ILIKE $1 OR
          issue_category ILIKE $1
        )
      `;

      const params: any[] = [`%${query}%`];

      if (manufacturer) {
        sqlQuery += ` AND manufacturer ILIKE $2`;
        params.push(manufacturer);
      }

      sqlQuery += ` ORDER BY success_rate DESC, views_count DESC LIMIT 5`;

      const result = await db.query(sqlQuery, params);

      return result.rows;
    } catch (error) {
      logger.error('Failed to search troubleshooting guides', error);
      return [];
    }
  }

  /**
   * Get vehicle-charger compatibility
   */
  async checkCompatibility(
    vehicleMake: string,
    vehicleModel: string,
    chargerManufacturer?: string
  ): Promise<any[]> {
    try {
      let query = `
        SELECT 
          charger_manufacturer as "chargerManufacturer",
          charger_model as "chargerModel",
          vehicle_make as "vehicleMake",
          vehicle_model as "vehicleModel",
          vehicle_year_start as "vehicleYearStart",
          vehicle_year_end as "vehicleYearEnd",
          compatibility_status as "compatibilityStatus",
          max_charging_speed_kw as "maxChargingSpeedKw",
          connector_required as "connectorRequired",
          adapter_needed as "adapterNeeded",
          notes, tested, last_tested_date as "lastTestedDate"
        FROM charger_vehicle_compatibility
        WHERE vehicle_make ILIKE $1 AND vehicle_model ILIKE $2
      `;

      const params: any[] = [vehicleMake, vehicleModel];

      if (chargerManufacturer) {
        query += ` AND charger_manufacturer ILIKE $3`;
        params.push(chargerManufacturer);
      }

      query += ` ORDER BY compatibility_status, max_charging_speed_kw DESC`;

      const result = await db.query(query, params);

      return result.rows;
    } catch (error) {
      logger.error('Failed to check compatibility', error);
      return [];
    }
  }

  /**
   * Get charger statistics
   */
  async getChargerStatistics(): Promise<{
    totalModels: number;
    totalErrorCodes: number;
    manufacturerCount: number;
    avgMaxPowerKw: number;
  }> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_models,
          COUNT(DISTINCT manufacturer) as manufacturer_count,
          AVG(max_power_kw) as avg_max_power
        FROM charger_models
      `);

      const errorResult = await db.query(`
        SELECT COUNT(*) as total_error_codes
        FROM charger_error_codes
      `);

      return {
        totalModels: parseInt(result.rows[0].total_models) || 0,
        manufacturerCount: parseInt(result.rows[0].manufacturer_count) || 0,
        avgMaxPowerKw: parseFloat(result.rows[0].avg_max_power) || 0,
        totalErrorCodes: parseInt(errorResult.rows[0].total_error_codes) || 0,
      };
    } catch (error) {
      logger.error('Failed to get charger statistics', error);
      return {
        totalModels: 0,
        totalErrorCodes: 0,
        manufacturerCount: 0,
        avgMaxPowerKw: 0,
      };
    }
  }

  /**
   * Increment troubleshooting guide views
   */
  async incrementGuideViews(guideId: number): Promise<void> {
    try {
      await db.query(
        `UPDATE troubleshooting_guides 
         SET views_count = views_count + 1
         WHERE id = $1`,
        [guideId]
      );
    } catch (error) {
      logger.error('Failed to increment guide views', error);
    }
  }

  /**
   * Mark guide as helpful
   */
  async markGuideHelpful(guideId: number): Promise<void> {
    try {
      await db.query(
        `UPDATE troubleshooting_guides 
         SET helpful_count = helpful_count + 1
         WHERE id = $1`,
        [guideId]
      );
    } catch (error) {
      logger.error('Failed to mark guide helpful', error);
    }
  }
}

// Singleton instance
export const chargerDb = new ChargerDatabaseService();
