import { Client, GatewayIntentBits, Events, Message, Interaction } from 'discord.js';
import { inngest } from '../mastra/inngest';
import { checkRateLimit, isGreeting } from '../mastra/utils/ampecoUtils';

// Duplicate message prevention
const processedMessages = new Set<string>();
const MESSAGE_EXPIRY = 60000; // 1 minute

// Initialize Discord client
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
      console.log(`✅ Discord bot ready! Logged in as ${client.user.tag}`);
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
          await message.reply(
            `⏳ אנא המתן ${rateLimitCheck.resetIn} שניות לפני שליחת הודעה נוספת.\n` +
            `Please wait ${rateLimitCheck.resetIn} seconds before sending another message.`
          );
          return;
        }

        // Generate thread ID
        const isNewConv = isGreeting(message.content);
        const threadId = isNewConv
          ? `discord-${message.channelId}-${message.author.id}-${Date.now()}`
          : `discord-${message.channelId}-${message.author.id}`;

        // Show typing indicator
        await message.channel.sendTyping();

        // Extract attachments
        const attachments = message.attachments.map(att => ({
          url: att.url,
          contentType: att.contentType || 'unknown',
        }));

        // Send event to Inngest workflow
        await inngest.send({
          name: 'discord/message.received',
          data: {
            messageId: message.id,
            channelId: message.channelId,
            userId: message.author.id,
            username: message.author.username,
            content: message.content,
            threadId,
            isNewConversation: isNewConv,
            attachments,
          },
        });

        console.log(`📨 Message received from ${message.author.username}: ${message.content.substring(0, 50)}...`);
      } catch (error) {
        console.error('Error handling message:', error);
        await message.reply('❌ מצטער, נתקלתי בבעיה. אנא נסה שוב או פנה לתמיכה.');
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

          // Send event for human agent request
          await inngest.send({
            name: 'discord/button.clicked',
            data: {
              interactionId: interaction.id,
              channelId,
              userId,
              username: interaction.user.username,
              buttonId: 'human_agent',
              threadId: `discord-${channelId}-${userId}`,
            },
          });

          console.log(`🙋 Human agent requested by user ${userId}`);
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

          console.log(`✅ Chat ended by user ${userId}`);
          return;
        }
      } catch (error) {
        console.error('Error handling interaction:', error);
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
    console.error('❌ Failed to start Discord bot:', error);
    throw error;
  }
}

// Stop Discord bot
export async function stopDiscordBot() {
  try {
    if (discordClient) {
      await discordClient.destroy();
      console.log('✅ Discord bot stopped');
    }
  } catch (error) {
    console.error('Error stopping Discord bot:', error);
  }
}
