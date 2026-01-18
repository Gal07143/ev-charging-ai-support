import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { pgPool } from '../mastra/storage';
import { ampecoApiCall } from '../mastra/utils/ampecoUtils';

/**
 * Real-Time Station Monitoring Service
 * 
 * Monitors station status in real-time using:
 * 1. Polling Ampeco API every 30 seconds
 * 2. Caching status in PostgreSQL
 * 3. Detecting status changes and generating events
 * 4. Proactive Discord notifications for critical issues
 * 
 * Note: Ampeco doesn't provide WebSocket API, so we use intelligent polling
 */

export interface StationStatus {
  stationId: string;
  stationName: string;
  status: 'Available' | 'Occupied' | 'Faulted' | 'Offline' | 'Unavailable';
  statusCode?: number;
  connectors: Array<{
    connectorId: number;
    type: string;
    status: string;
    powerKw: number;
  }>;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  lastUpdated: Date;
  errorCode?: string;
  errorMessage?: string;
}

export interface StationEvent {
  stationId: string;
  eventType: 'went_offline' | 'came_online' | 'error' | 'maintenance_needed' | 'high_usage';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metadata?: Record<string, any>;
}

export class StationMonitoringService extends EventEmitter {
  private polling: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 30000; // 30 seconds
  private stationCache: Map<string, StationStatus> = new Map();

  constructor() {
    super();
    logger.info('StationMonitoringService initialized');
  }

  /**
   * Start monitoring stations
   */
  async start(): Promise<void> {
    if (this.polling) {
      logger.warn('Station monitoring already running');
      return;
    }

    logger.info('Starting station monitoring service...');
    this.polling = true;

    // Initial fetch
    await this.pollStations();

    // Start polling interval
    this.pollingInterval = setInterval(async () => {
      await this.pollStations();
    }, this.POLL_INTERVAL_MS);

    logger.info('Station monitoring service started', {
      pollInterval: `${this.POLL_INTERVAL_MS / 1000}s`,
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.polling = false;
    logger.info('Station monitoring service stopped');
  }

  /**
   * Poll all stations from Ampeco API
   */
  private async pollStations(): Promise<void> {
    try {
      logger.debug('Polling stations...');

      // Fetch all stations from Ampeco
      const response = await ampecoApiCall('/charging-stations', 'GET');

      if (!response || !response.data) {
        logger.warn('No station data received from Ampeco');
        return;
      }

      const stations = response.data;
      logger.debug('Fetched stations', { count: stations.length });

      // Process each station
      for (const station of stations) {
        await this.processStation(station);
      }

      logger.debug('Station polling complete', {
        stationsProcessed: stations.length,
      });
    } catch (error) {
      logger.error('Failed to poll stations', { error });
    }
  }

  /**
   * Process individual station status
   */
  private async processStation(stationData: any): Promise<void> {
    try {
      const stationId = stationData.id?.toString();
      if (!stationId) {
        logger.warn('Station missing ID', { stationData });
        return;
      }

      // Parse station status
      const status: StationStatus = {
        stationId,
        stationName: stationData.name || `Station ${stationId}`,
        status: this.mapStatus(stationData.status),
        statusCode: stationData.status_code,
        connectors: this.parseConnectors(stationData.connectors || []),
        location: stationData.location ? {
          latitude: stationData.location.latitude,
          longitude: stationData.location.longitude,
          address: stationData.location.address,
        } : undefined,
        lastUpdated: new Date(),
        errorCode: stationData.error_code,
        errorMessage: stationData.error_message,
      };

      // Check for status changes
      const previousStatus = this.stationCache.get(stationId);
      if (previousStatus) {
        await this.detectStatusChanges(previousStatus, status);
      }

      // Update cache
      this.stationCache.set(stationId, status);

      // Save to database
      await this.saveStationStatus(status);

    } catch (error) {
      logger.error('Failed to process station', { error, stationData });
    }
  }

  /**
   * Map Ampeco status to our standard format
   */
  private mapStatus(status: string): StationStatus['status'] {
    const statusMap: Record<string, StationStatus['status']> = {
      'Available': 'Available',
      'Occupied': 'Occupied',
      'Charging': 'Occupied',
      'Faulted': 'Faulted',
      'Unavailable': 'Unavailable',
      'Offline': 'Offline',
    };

    return statusMap[status] || 'Unavailable';
  }

  /**
   * Parse connector information
   */
  private parseConnectors(connectors: any[]): StationStatus['connectors'] {
    return connectors.map((c) => ({
      connectorId: c.id || c.connector_id,
      type: c.type || c.connector_type || 'Unknown',
      status: c.status || 'Unknown',
      powerKw: c.power_kw || c.max_power || 0,
    }));
  }

  /**
   * Detect status changes and generate events
   */
  private async detectStatusChanges(
    previous: StationStatus,
    current: StationStatus
  ): Promise<void> {
    // Status changed
    if (previous.status !== current.status) {
      logger.info('Station status changed', {
        stationId: current.stationId,
        from: previous.status,
        to: current.status,
      });

      // Went offline
      if (current.status === 'Offline' && previous.status !== 'Offline') {
        await this.createEvent({
          stationId: current.stationId,
          eventType: 'went_offline',
          severity: 'error',
          message: `Station ${current.stationName} went offline`,
          metadata: { previousStatus: previous.status },
        });
      }

      // Came back online
      if (current.status !== 'Offline' && previous.status === 'Offline') {
        await this.createEvent({
          stationId: current.stationId,
          eventType: 'came_online',
          severity: 'info',
          message: `Station ${current.stationName} came back online`,
          metadata: { currentStatus: current.status },
        });
      }

      // Faulted
      if (current.status === 'Faulted') {
        await this.createEvent({
          stationId: current.stationId,
          eventType: 'error',
          severity: 'critical',
          message: `Station ${current.stationName} is faulted: ${current.errorMessage || 'Unknown error'}`,
          metadata: {
            errorCode: current.errorCode,
            errorMessage: current.errorMessage,
          },
        });
      }
    }

    // Error code changed
    if (current.errorCode && current.errorCode !== previous.errorCode) {
      await this.createEvent({
        stationId: current.stationId,
        eventType: 'error',
        severity: 'warning',
        message: `New error on station ${current.stationName}: ${current.errorCode}`,
        metadata: {
          errorCode: current.errorCode,
          errorMessage: current.errorMessage,
        },
      });
    }
  }

  /**
   * Save station status to database
   */
  private async saveStationStatus(status: StationStatus): Promise<void> {
    try {
      await pgPool.query(
        `
        INSERT INTO station_status_cache (
          station_id, station_name, status, status_code,
          connectors, latitude, longitude, address,
          last_updated, current_error_code, current_error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (station_id) DO UPDATE SET
          station_name = EXCLUDED.station_name,
          status = EXCLUDED.status,
          status_code = EXCLUDED.status_code,
          connectors = EXCLUDED.connectors,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          address = EXCLUDED.address,
          last_updated = EXCLUDED.last_updated,
          current_error_code = EXCLUDED.current_error_code,
          current_error_message = EXCLUDED.current_error_message,
          last_status_change = CASE 
            WHEN station_status_cache.status != EXCLUDED.status 
            THEN EXCLUDED.last_updated 
            ELSE station_status_cache.last_status_change 
          END
        `,
        [
          status.stationId,
          status.stationName,
          status.status,
          status.statusCode,
          JSON.stringify(status.connectors),
          status.location?.latitude,
          status.location?.longitude,
          status.location?.address,
          status.lastUpdated,
          status.errorCode,
          status.errorMessage,
        ]
      );

      // Save to history
      await pgPool.query(
        `
        INSERT INTO station_status_history (
          station_id, status, status_code, error_code, error_message, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          status.stationId,
          status.status,
          status.statusCode,
          status.errorCode,
          status.errorMessage,
          status.lastUpdated,
        ]
      );
    } catch (error) {
      logger.error('Failed to save station status', { error, status });
    }
  }

  /**
   * Create station event
   */
  private async createEvent(event: StationEvent): Promise<void> {
    try {
      await pgPool.query(
        `
        INSERT INTO station_events (
          station_id, event_type, severity, message, metadata
        ) VALUES ($1, $2, $3, $4, $5)
        `,
        [
          event.stationId,
          event.eventType,
          event.severity,
          event.message,
          JSON.stringify(event.metadata || {}),
        ]
      );

      // Emit event for listeners (Discord bot, analytics, etc.)
      this.emit('station_event', event);

      logger.info('Station event created', {
        stationId: event.stationId,
        eventType: event.eventType,
        severity: event.severity,
      });
    } catch (error) {
      logger.error('Failed to create station event', { error, event });
    }
  }

  /**
   * Get station status from cache
   */
  async getStationStatus(stationId: string): Promise<StationStatus | null> {
    // Try memory cache first
    const cached = this.stationCache.get(stationId);
    if (cached) {
      return cached;
    }

    // Fallback to database
    try {
      const result = await pgPool.query(
        `SELECT * FROM station_status_cache WHERE station_id = $1`,
        [stationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        stationId: row.station_id,
        stationName: row.station_name,
        status: row.status,
        statusCode: row.status_code,
        connectors: row.connectors,
        location: row.latitude && row.longitude ? {
          latitude: row.latitude,
          longitude: row.longitude,
          address: row.address,
        } : undefined,
        lastUpdated: row.last_updated,
        errorCode: row.current_error_code,
        errorMessage: row.current_error_message,
      };
    } catch (error) {
      logger.error('Failed to get station status', { error, stationId });
      return null;
    }
  }

  /**
   * Get all stations with specific status
   */
  async getStationsByStatus(status: StationStatus['status']): Promise<StationStatus[]> {
    try {
      const result = await pgPool.query(
        `SELECT * FROM station_status_cache WHERE status = $1 ORDER BY last_updated DESC`,
        [status]
      );

      return result.rows.map((row) => ({
        stationId: row.station_id,
        stationName: row.station_name,
        status: row.status,
        statusCode: row.status_code,
        connectors: row.connectors,
        location: row.latitude && row.longitude ? {
          latitude: row.latitude,
          longitude: row.longitude,
          address: row.address,
        } : undefined,
        lastUpdated: row.last_updated,
        errorCode: row.current_error_code,
        errorMessage: row.current_error_message,
      }));
    } catch (error) {
      logger.error('Failed to get stations by status', { error, status });
      return [];
    }
  }

  /**
   * Get unnotified events for Discord
   */
  async getUnnotifiedEvents(): Promise<any[]> {
    try {
      const result = await pgPool.query(
        `
        SELECT e.*, s.station_name
        FROM station_events e
        JOIN station_status_cache s ON e.station_id = s.station_id
        WHERE e.notified = FALSE
        ORDER BY e.created_at ASC
        LIMIT 50
        `
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get unnotified events', { error });
      return [];
    }
  }

  /**
   * Mark event as notified
   */
  async markEventNotified(eventId: number, channelId: string): Promise<void> {
    try {
      await pgPool.query(
        `
        UPDATE station_events
        SET notified = TRUE, notified_at = NOW(), notification_channel_id = $2
        WHERE id = $1
        `,
        [eventId, channelId]
      );
    } catch (error) {
      logger.error('Failed to mark event as notified', { error, eventId });
    }
  }
}

// Singleton instance
let monitoringInstance: StationMonitoringService | null = null;

export function getStationMonitoring(): StationMonitoringService {
  if (!monitoringInstance) {
    monitoringInstance = new StationMonitoringService();
  }
  return monitoringInstance;
}
