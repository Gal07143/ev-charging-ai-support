/**
 * Vehicle-Charger Compatibility Service
 * EV model database, compatibility checks, charging rate calculations
 */

import { Pool } from 'pg';
import { generateId } from '../utils/idGenerator';
import logger from '../utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Types
export interface EVModel {
  vehicleId: string;
  make: string;
  model: string;
  year: number;
  trim?: string;
  batteryCapacityKwh: number;
  rangeKm: number;
  acMaxPowerKw: number;
  dcMaxPowerKw: number;
  acConnectorType: string;
  dcConnectorType: string;
}

export interface CompatibilityResult {
  isCompatible: boolean;
  compatibilityScore: number;
  acCompatible: boolean;
  dcCompatible: boolean;
  maxChargingRateKw: number;
  estimatedChargeTimeMinutes: number;
  issues: string[];
  warnings: string[];
  recommendations: string[];
}

export interface OEMQuirk {
  make: string;
  title: string;
  description: string;
  severity: string;
  workaround?: string;
  recommendation?: string;
}

/**
 * Vehicle Compatibility Service Class
 */
export class VehicleCompatibilityService {
  
  /**
   * Search for EV models by make/model
   */
  async searchEVModels(query: string, limit: number = 20): Promise<EVModel[]> {
    try {
      const searchPattern = `%${query.toLowerCase()}%`;
      
      const result = await pool.query(`
        SELECT 
          vehicle_id as "vehicleId",
          make, model, year, trim,
          battery_capacity_kwh as "batteryCapacityKwh",
          range_km as "rangeKm",
          ac_max_power_kw as "acMaxPowerKw",
          dc_max_power_kw as "dcMaxPowerKw",
          ac_connector_type as "acConnectorType",
          dc_connector_type as "dcConnectorType"
        FROM ev_models
        WHERE is_active = TRUE
          AND (LOWER(make) LIKE $1 OR LOWER(model) LIKE $1)
        ORDER BY year DESC, make, model
        LIMIT $2
      `, [searchPattern, limit]);
      
      return result.rows;
      
    } catch (error) {
      logger.error('Error searching EV models:', error);
      return [];
    }
  }
  
  /**
   * Get EV model by ID
   */
  async getEVModel(vehicleId: string): Promise<EVModel | null> {
    try {
      const result = await pool.query(`
        SELECT 
          vehicle_id as "vehicleId",
          make, model, year, trim,
          battery_capacity_kwh as "batteryCapacityKwh",
          range_km as "rangeKm",
          ac_max_power_kw as "acMaxPowerKw",
          dc_max_power_kw as "dcMaxPowerKw",
          ac_connector_type as "acConnectorType",
          dc_connector_type as "dcConnectorType"
        FROM ev_models
        WHERE vehicle_id = $1 AND is_active = TRUE
      `, [vehicleId]);
      
      return result.rows[0] || null;
      
    } catch (error) {
      logger.error('Error getting EV model:', error);
      return null;
    }
  }
  
  /**
   * Check vehicle-charger compatibility
   */
  async checkCompatibility(
    vehicleId: string,
    chargerModelId: string,
    sessionId?: string,
    userId?: string
  ): Promise<CompatibilityResult> {
    try {
      const checkId = `COMPAT-${generateId()}`;
      
      // Get vehicle details
      const vehicle = await this.getEVModel(vehicleId);
      if (!vehicle) {
        return this.createIncompatibleResult('Vehicle not found');
      }
      
      // Get charger details (from existing charger_models table)
      const chargerResult = await pool.query(`
        SELECT 
          charger_model_id, manufacturer, model_name,
          ac_power_kw, dc_power_kw, connector_types
        FROM charger_models
        WHERE charger_model_id = $1 AND is_active = TRUE
      `, [chargerModelId]);
      
      if (chargerResult.rows.length === 0) {
        return this.createIncompatibleResult('Charger not found');
      }
      
      const charger = chargerResult.rows[0];
      
      // Check AC compatibility
      const acCompatible = await this.checkConnectorCompatibility(
        vehicle.acConnectorType,
        charger.connector_types[0] // Simplified
      );
      
      // Check DC compatibility
      const dcCompatible = await this.checkConnectorCompatibility(
        vehicle.dcConnectorType,
        charger.connector_types[0] // Simplified
      );
      
      const isCompatible = acCompatible || dcCompatible;
      
      // Calculate max charging rate
      let maxChargingRateKw = 0;
      if (dcCompatible && vehicle.dcMaxPowerKw && charger.dc_power_kw) {
        maxChargingRateKw = Math.min(vehicle.dcMaxPowerKw, charger.dc_power_kw);
      } else if (acCompatible && vehicle.acMaxPowerKw && charger.ac_power_kw) {
        maxChargingRateKw = Math.min(vehicle.acMaxPowerKw, charger.ac_power_kw);
      }
      
      // Estimate charge time (0-80%)
      const estimatedChargeTimeMinutes = this.calculateChargeTime(
        vehicle.batteryCapacityKwh * 0.8, // 80% charge
        maxChargingRateKw
      );
      
      // Get OEM quirks
      const quirks = await this.getOEMQuirks(vehicle.make, vehicle.model, vehicle.year);
      
      // Build result
      const issues: string[] = [];
      const warnings: string[] = [];
      const recommendations: string[] = [];
      
      if (!isCompatible) {
        issues.push(`Vehicle connector (${vehicle.dcConnectorType || vehicle.acConnectorType}) not compatible with charger`);
      }
      
      // Add quirk warnings
      quirks.forEach(quirk => {
        if (quirk.severity === 'critical') {
          issues.push(quirk.title);
        } else if (quirk.severity === 'warning') {
          warnings.push(quirk.title);
        }
        if (quirk.recommendation) {
          recommendations.push(quirk.recommendation);
        }
      });
      
      // Calculate compatibility score
      let compatibilityScore = 0;
      if (isCompatible) {
        compatibilityScore = 50;
        if (dcCompatible) compatibilityScore += 30;
        if (acCompatible) compatibilityScore += 10;
        if (maxChargingRateKw >= 50) compatibilityScore += 10;
        compatibilityScore -= (issues.length * 10);
        compatibilityScore = Math.max(0, Math.min(100, compatibilityScore));
      }
      
      const result: CompatibilityResult = {
        isCompatible,
        compatibilityScore,
        acCompatible,
        dcCompatible,
        maxChargingRateKw,
        estimatedChargeTimeMinutes,
        issues,
        warnings,
        recommendations
      };
      
      // Log check
      await pool.query(`
        INSERT INTO compatibility_checks (
          check_id, vehicle_id, charger_model_id, session_id, discord_user_id,
          is_compatible, compatibility_score, ac_compatible, dc_compatible,
          max_charging_rate_kw, estimated_charge_time_minutes,
          issues_found, warnings, recommendations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        checkId, vehicleId, chargerModelId, sessionId, userId,
        result.isCompatible, result.compatibilityScore,
        result.acCompatible, result.dcCompatible,
        result.maxChargingRateKw, result.estimatedChargeTimeMinutes,
        JSON.stringify(result.issues),
        JSON.stringify(result.warnings),
        JSON.stringify(result.recommendations)
      ]);
      
      logger.info(`Compatibility check ${checkId}: ${vehicle.make} ${vehicle.model} + ${charger.manufacturer} ${charger.model_name} = ${isCompatible ? 'COMPATIBLE' : 'INCOMPATIBLE'}`);
      
      return result;
      
    } catch (error) {
      logger.error('Error checking compatibility:', error);
      return this.createIncompatibleResult('Error checking compatibility');
    }
  }
  
  /**
   * Check connector compatibility
   */
  private async checkConnectorCompatibility(vehicleConnector: string, chargerConnector: string): Promise<boolean> {
    try {
      if (!vehicleConnector || !chargerConnector) return false;
      
      const result = await pool.query(`
        SELECT is_compatible
        FROM connector_compatibility
        WHERE vehicle_connector = $1 AND charger_connector = $2
      `, [vehicleConnector, chargerConnector]);
      
      return result.rows[0]?.is_compatible || false;
      
    } catch (error) {
      logger.error('Error checking connector compatibility:', error);
      return false;
    }
  }
  
  /**
   * Get OEM-specific quirks
   */
  async getOEMQuirks(make: string, model?: string, year?: number): Promise<OEMQuirk[]> {
    try {
      const result = await pool.query(`
        SELECT 
          make, title, description, severity, workaround, recommendation
        FROM oem_charging_quirks
        WHERE is_active = TRUE
          AND LOWER(make) = LOWER($1)
          AND (model_pattern IS NULL OR LOWER($2) LIKE LOWER(model_pattern))
          AND (year_from IS NULL OR $3 >= year_from)
          AND (year_to IS NULL OR $3 <= year_to)
        ORDER BY severity DESC, title
      `, [make, model || '', year || 9999]);
      
      return result.rows;
      
    } catch (error) {
      logger.error('Error getting OEM quirks:', error);
      return [];
    }
  }
  
  /**
   * Calculate estimated charge time
   */
  private calculateChargeTime(energyNeededKwh: number, chargingPowerKw: number): number {
    if (chargingPowerKw === 0) return 0;
    
    // Simple calculation: time = energy / power (in minutes)
    // Account for charging curve (80% efficiency average)
    const timeHours = energyNeededKwh / (chargingPowerKw * 0.8);
    return Math.round(timeHours * 60);
  }
  
  /**
   * Helper: Create incompatible result
   */
  private createIncompatibleResult(reason: string): CompatibilityResult {
    return {
      isCompatible: false,
      compatibilityScore: 0,
      acCompatible: false,
      dcCompatible: false,
      maxChargingRateKw: 0,
      estimatedChargeTimeMinutes: 0,
      issues: [reason],
      warnings: [],
      recommendations: []
    };
  }
  
  /**
   * Get popular EV models
   */
  async getPopularEVModels(limit: number = 20): Promise<any[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM popular_ev_models LIMIT $1
      `, [limit]);
      
      return result.rows;
      
    } catch (error) {
      logger.error('Error getting popular EV models:', error);
      return [];
    }
  }
  
  /**
   * Get compatibility check statistics
   */
  async getCompatibilityStats(): Promise<any[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM compatibility_check_stats
        ORDER BY date DESC
        LIMIT 30
      `);
      
      return result.rows;
      
    } catch (error) {
      logger.error('Error getting compatibility stats:', error);
      return [];
    }
  }
}

// Export singleton instance
export const vehicleCompatibilityService = new VehicleCompatibilityService();
