import { Client, GatewayIntentBits, Events, Message, Interaction } from 'discord.js';
import { checkRateLimit, isGreeting, updateSessionActivity, isSessionExpired } from '../mastra/utils/ampecoUtils';
import { enqueueMessage } from '../utils/messageQueue';
import { initializeNotificationService, stopNotificationService } from '../services/proactiveNotifications';
import { logger } from '../utils/logger';
import { messagesProcessed, rateLimitViolations } from '../utils/metrics';
import { detectLanguage } from '../mastra/utils/ampecoUtils';
import { getFallbackResponse } from '../utils/fallbackHandler';

// Duplicate message prevention
const processedMessages = new Set<string>();
const MESSAGE_EXPIRY = 60000; // 1 minute

// Initialize Discord client - EXPORT for reuse
export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// Start Discord bot
export async function startDiscordBot() {
  try {
    discordClient.once(Events.ClientReady, (client) => {
      logger.info({ tag: client.user.tag }, '✅ Discord bot ready!');
      
      // Initialize proactive notification service
      initializeNotificationService(discordClient, process.env.DISCORD_ALERTS_CHANNEL_ID);
      logger.info('✅ Proactive notifications initialized');
    });

    // Handle messages
    discordClient.on(Events.MessageCreate, async (message: Message) => {
      try {
        // Ignore bot messages
        if (message.author.bot) return;

        // Duplicate prevention
        const messageKey = `${message.id}-${message.channelId}`;
        if (processedMessages.has(messageKey)) return;
        
        processedMessages.add(messageKey);
        setTimeout(() => processedMessages.delete(messageKey), MESSAGE_EXPIRY);

        // Rate limiting
        const rateLimitCheck = checkRateLimit(message.author.id);
        if (!rateLimitCheck.allowed) {
          rateLimitViolations.inc({ user_id: message.author.id });
          
          await message.reply(
            `⏳ אנא המתן ${rateLimitCheck.resetIn} שניות לפני שליחת הודעה נוספת.\n` +
            `Please wait ${rateLimitCheck.resetIn} seconds before sending another message.`
          );
          return;
        }

        // Check session expiration
        const baseThreadId = `discord-${message.channelId}-${message.author.id}`;
        const isExpired = !isGreeting(message.content) && isSessionExpired(baseThreadId);
        
        // Generate thread ID
        const isNewConv = isGreeting(message.content) || isExpired;
        const threadId = isNewConv
          ? `${baseThreadId}-${Date.now()}`
          : baseThreadId;

        // Update session activity
        updateSessionActivity(threadId);

        // Show typing indicator
        await message.channel.sendTyping();

        // Extract attachments
        const attachments = message.attachments.map(att => ({
          url: att.url,
          contentType: att.contentType || 'unknown',
        }));

        // Add message to queue instead of direct Inngest call
        await enqueueMessage({
          messageId: message.id,
          channelId: message.channelId,
          userId: message.author.id,
          username: message.author.username,
          content: message.content,
          threadId,
          isNewConversation: isNewConv,
          attachments,
        });

        messagesProcessed.inc({ status: 'queued' });
        
        logger.info(
          { 
            userId: message.author.id, 
            threadId, 
            isNewConv,
            messageLength: message.content.length 
          }, 
          '📨 Message enqueued'
        );
      } catch (error) {
        logger.error({ error, userId: message.author.id }, 'Error handling message');
        messagesProcessed.inc({ status: 'error' });
        
        const lang = detectLanguage(message.content);
        await message.reply(getFallbackResponse(lang));
      }
    });

    // Handle button interactions
    discordClient.on(Events.InteractionCreate, async (interaction: Interaction) => {
      try {
        if (!interaction.isButton()) return;

        const buttonId = interaction.customId;
        const userId = interaction.user.id;
        const channelId = interaction.channelId;

        // Handle rating buttons
        if (buttonId.startsWith('rating_')) {
          const rating = buttonId.replace('rating_', '');
          await interaction.reply({
            content: `תודה על הדירוג! קיבלנו ${rating}⭐`,
            ephemeral: true,
          });

          console.log(`⭐ Rating: ${rating} from user ${userId}`);
          return;
        }

        // Handle human agent button
        if (buttonId === 'human_agent') {
          await interaction.reply({
            content: 
              '🙋 מעביר אותך לנציג אנושי...\n' +
              'נציג יצור איתך קשר בהקדם האפשרי.\n\n' +
              'Transferring to human agent...\n' +
              'An agent will contact you as soon as possible.',
            ephemeral: true,
          });

          logger.info({ userId, channelId }, '🙋 Human agent requested');
          return;
        }

        // Handle end chat button
        if (buttonId === 'end_chat') {
          await interaction.reply({
            content: 
              '✅ תודה שפנית לתמיכה של Edge Control!\n' +
              'נסיעה מהנה! 🚗⚡\n\n' +
              'Thank you for contacting Edge Control support!\n' +
              'Drive safe! 🚗⚡',
            ephemeral: true,
          });

          logger.info({ userId, channelId }, '✅ Chat ended');
          return;
        }
      } catch (error) {
        logger.error({ error, userId: interaction.user.id }, 'Error handling interaction');
        if (interaction.isButton() && !interaction.replied) {
          await interaction.reply({
            content: '❌ שגיאה בעיבוד הלחיצה. אנא נסה שוב.',
            ephemeral: true,
          });
        }
      }
    });

    // Login
    await discordClient.login(process.env.DISCORD_BOT_TOKEN);
    
    return discordClient;
  } catch (error) {
    logger.error({ error }, '❌ Failed to start Discord bot');
    throw error;
  }
}

// Stop Discord bot
export async function stopDiscordBot() {
  try {
    // Stop notification service
    stopNotificationService();
    
    if (discordClient) {
      await discordClient.destroy();
      logger.info('✅ Discord bot stopped');
    }
  } catch (error) {
    logger.error({ error }, 'Error stopping Discord bot');
  }
}
