import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { getStationMonitoring, StationEvent } from '../services/stationMonitoring';
import { logger } from '../utils/logger';

/**
 * Proactive Notification Service
 * 
 * Sends Discord notifications for critical station events:
 * - Stations going offline
 * - Error conditions
 * - Maintenance needed
 * - High usage alerts
 */

export class ProactiveNotificationService {
  private discordClient: Client | null = null;
  private notificationChannelId: string | null = null;
  private running: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60000; // 1 minute

  constructor(discordClient: Client, notificationChannelId?: string) {
    this.discordClient = discordClient;
    this.notificationChannelId = notificationChannelId || process.env.DISCORD_ALERTS_CHANNEL_ID || null;
    
    // Listen to station events
    const monitoring = getStationMonitoring();
    monitoring.on('station_event', this.handleStationEvent.bind(this));
    
    logger.info('ProactiveNotificationService initialized', {
      hasChannel: !!this.notificationChannelId,
    });
  }

  /**
   * Start checking for unnotified events
   */
  start(): void {
    if (this.running) {
      logger.warn('Proactive notifications already running');
      return;
    }

    this.running = true;

    // Check for unnotified events every minute
    this.checkInterval = setInterval(async () => {
      await this.checkUnnotifiedEvents();
    }, this.CHECK_INTERVAL_MS);

    logger.info('Proactive notification service started');
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.running = false;
    logger.info('Proactive notification service stopped');
  }

  /**
   * Handle real-time station event
   */
  private async handleStationEvent(event: StationEvent): Promise<void> {
    try {
      logger.info('Station event received', {
        stationId: event.stationId,
        eventType: event.eventType,
        severity: event.severity,
      });

      // Only notify for critical/error events immediately
      if (event.severity === 'critical' || event.severity === 'error') {
        await this.sendNotification(event);
      }
    } catch (error) {
      logger.error('Failed to handle station event', { error, event });
    }
  }

  /**
   * Check for unnotified events in database
   */
  private async checkUnnotifiedEvents(): Promise<void> {
    try {
      const monitoring = getStationMonitoring();
      const events = await monitoring.getUnnotifiedEvents();

      if (events.length === 0) {
        return;
      }

      logger.info('Found unnotified events', { count: events.length });

      for (const event of events) {
        await this.sendNotification({
          stationId: event.station_id,
          eventType: event.event_type,
          severity: event.severity,
          message: event.message,
          metadata: event.metadata,
        }, event.id);
      }
    } catch (error) {
      logger.error('Failed to check unnotified events', { error });
    }
  }

  /**
   * Send Discord notification
   */
  private async sendNotification(event: StationEvent, eventId?: number): Promise<void> {
    try {
      if (!this.discordClient || !this.notificationChannelId) {
        logger.warn('Discord client or channel not configured', {
          hasClient: !!this.discordClient,
          hasChannel: !!this.notificationChannelId,
        });
        return;
      }

      const channel = await this.discordClient.channels.fetch(
        this.notificationChannelId
      ) as TextChannel;

      if (!channel || !channel.isTextBased()) {
        logger.error('Invalid notification channel', {
          channelId: this.notificationChannelId,
        });
        return;
      }

      // Create embed based on severity
      const embed = this.createEmbed(event);

      // Send notification
      await channel.send({ embeds: [embed] });

      // Mark as notified
      if (eventId) {
        const monitoring = getStationMonitoring();
        await monitoring.markEventNotified(eventId, this.notificationChannelId);
      }

      logger.info('Notification sent', {
        stationId: event.stationId,
        eventType: event.eventType,
        eventId,
      });
    } catch (error) {
      logger.error('Failed to send notification', { error, event });
    }
  }

  /**
   * Create Discord embed for event
   */
  private createEmbed(event: StationEvent): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(this.getEventTitle(event))
      .setDescription(event.message)
      .setTimestamp();

    // Color based on severity
    const colors = {
      info: 0x3498db,      // Blue
      warning: 0xf39c12,   // Orange
      error: 0xe74c3c,     // Red
      critical: 0x992d22,  // Dark red
    };
    embed.setColor(colors[event.severity]);

    // Add fields
    embed.addFields(
      { name: 'Station ID', value: event.stationId, inline: true },
      { name: 'Event Type', value: event.eventType.replace(/_/g, ' '), inline: true },
      { name: 'Severity', value: event.severity.toUpperCase(), inline: true }
    );

    // Add metadata if present
    if (event.metadata) {
      if (event.metadata.errorCode) {
        embed.addFields({
          name: 'Error Code',
          value: event.metadata.errorCode,
          inline: true,
        });
      }
      if (event.metadata.errorMessage) {
        embed.addFields({
          name: 'Error Message',
          value: event.metadata.errorMessage.substring(0, 200),
          inline: false,
        });
      }
    }

    // Add icon based on event type
    const icons = {
      went_offline: '🔴',
      came_online: '🟢',
      error: '⚠️',
      maintenance_needed: '🔧',
      high_usage: '📊',
    };
    const icon = icons[event.eventType] || '📡';
    
    embed.setFooter({ text: `${icon} Edge Control Station Monitoring` });

    return embed;
  }

  /**
   * Get event title
   */
  private getEventTitle(event: StationEvent): string {
    const titles = {
      went_offline: '🔴 Station Offline',
      came_online: '🟢 Station Back Online',
      error: '⚠️ Station Error',
      maintenance_needed: '🔧 Maintenance Required',
      high_usage: '📊 High Usage Alert',
    };

    return titles[event.eventType] || '📡 Station Event';
  }
}

// Global instance
let notificationServiceInstance: ProactiveNotificationService | null = null;

export function initializeNotificationService(
  discordClient: Client,
  channelId?: string
): void {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new ProactiveNotificationService(
      discordClient,
      channelId
    );
    notificationServiceInstance.start();
  }
}

export function getNotificationService(): ProactiveNotificationService | null {
  return notificationServiceInstance;
}

export function stopNotificationService(): void {
  if (notificationServiceInstance) {
    notificationServiceInstance.stop();
    notificationServiceInstance = null;
  }
}
