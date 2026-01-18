import { inngest } from '../inngest';
import { edgeControlAgent } from '../agents/edgeControlAgent';
import { discordClient } from '../../triggers/discordTriggers';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger, generateRequestId } from '../../utils/logger';
import { agentResponseTime, messagesProcessed, toolUsage, failedConversations } from '../../utils/metrics';
import { trimConversationHistory } from '../../utils/contextManager';
import { getFallbackResponse, serviceHealthTracker } from '../../utils/fallbackHandler';
import { detectLanguage } from '../utils/ampecoUtils';

// Extract context from conversation history
function extractContext(messages: any[]) {
  const context: any = {
    stationNumbers: [],
    customerName: null,
    frustrationLevel: 'low',
    problemType: null,
    attempts: 0,
  };

  for (const msg of messages) {
    if (msg.role === 'user') {
      context.attempts++;
      
      // Extract station numbers
      const stationMatch = msg.content.match(/\b\d{4,6}\b/g);
      if (stationMatch) {
        context.stationNumbers.push(...stationMatch);
      }

      // Detect frustration
      const frustrationWords = ['מתסכל', 'כועס', 'נמאס', 'frustrated', 'angry', 'annoyed'];
      if (frustrationWords.some(word => msg.content.toLowerCase().includes(word))) {
        context.frustrationLevel = 'high';
      }
    }

    if (msg.role === 'assistant') {
      // Extract customer name if asked
      const nameMatch = msg.content.match(/(?:איך קוראים לך|מה שמך|your name)/i);
      if (nameMatch && messages.indexOf(msg) < messages.length - 1) {
        const nextMsg = messages[messages.indexOf(msg) + 1];
        if (nextMsg.role === 'user') {
          context.customerName = nextMsg.content.trim().split(/\s+/)[0];
        }
      }
    }
  }

  return context;
}

// Create interactive buttons
function createButtons() {
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('rating_1')
        .setLabel('1⭐')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('rating_2')
        .setLabel('2⭐')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('rating_3')
        .setLabel('3⭐')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('rating_4')
        .setLabel('4⭐')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('rating_5')
        .setLabel('5⭐')
        .setStyle(ButtonStyle.Success)
    );

  const row2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('human_agent')
        .setLabel('🙋 דבר עם נציג')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('end_chat')
        .setLabel('✅ סיים שיחה')
        .setStyle(ButtonStyle.Success)
    );

  return [row, row2];
}

// Edge Control Support Workflow
export const edgeControlWorkflow = inngest.createFunction(
  {
    id: 'edge-control-support-workflow',
    name: 'Edge Control Support Workflow',
    retries: 3,
  },
  { event: 'discord/message.received' },
  async ({ event, step }) => {
    const {
      messageId,
      channelId,
      userId,
      username,
      content,
      threadId,
      isNewConversation,
      attachments = [],
    } = event.data;

    const requestId = generateRequestId();
    const requestLogger = logger.child({ requestId, userId, threadId });

    requestLogger.info('Starting workflow execution');

    // Step 1: Generate response using agent with error boundaries
    const agentResponse = await step.run('generate-response', async () => {
      const startTime = Date.now();
      
      try {
        // Check if Ampeco service is healthy
        if (!serviceHealthTracker.isHealthy('ampeco')) {
          requestLogger.warn('Ampeco service unhealthy, using fallback');
          const lang = detectLanguage(content);
          messagesProcessed.inc({ status: 'fallback' });
          
          return {
            success: false,
            text: getFallbackResponse(lang),
            usedFallback: true,
          };
        }

        // Get conversation history
        const history = await edgeControlAgent.memory.getMessages({
          threadId,
        });

        // Trim conversation history to manage context window
        const trimmedHistory = trimConversationHistory(history);

        // Extract context
        const context = extractContext(trimmedHistory);

        // Prepare messages for agent
        const messages = [
          ...trimmedHistory.map((msg: any) => ({
            role: msg.role,
            content: msg.content,
          })),
          {
            role: 'user',
            content,
          },
        ];

        // Add image analysis if attachments present
        if (attachments.length > 0) {
          const imageAttachments = attachments.filter((att: any) => 
            att.contentType?.startsWith('image/')
          );
          
          if (imageAttachments.length > 0) {
            messages.push({
              role: 'system',
              content: `User attached ${imageAttachments.length} image(s). Use the analyze-station-image tool to analyze them.`,
            });
          }
        }

        requestLogger.debug({ messageCount: messages.length }, 'Generating agent response');

        // Generate response
        const response = await edgeControlAgent.generateLegacy({
          messages,
          threadId,
        });

        // Record tool usage
        if (response.steps) {
          for (const step of response.steps) {
            if (step.toolCalls && step.toolCalls.length > 0) {
              for (const toolCall of step.toolCalls) {
                toolUsage.inc({ 
                  tool: toolCall.toolName || 'unknown', 
                  status: 'success' 
                });
              }
            }
          }
        }

        const duration = (Date.now() - startTime) / 1000;
        agentResponseTime.observe(duration);
        messagesProcessed.inc({ status: 'success' });
        serviceHealthTracker.recordSuccess('agent');

        requestLogger.info({ duration }, 'Agent response generated successfully');

        return {
          success: true,
          text: response.text,
          context,
          toolCalls: response.steps?.filter((s: any) => s.toolCalls?.length > 0) || [],
        };
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        agentResponseTime.observe(duration);
        
        requestLogger.error({ error, duration }, 'Agent generation failed');
        messagesProcessed.inc({ status: 'error' });
        serviceHealthTracker.recordFailure('agent');

        // Track if this requires human intervention
        if (context?.frustrationLevel === 'high' || context?.attempts > 3) {
          failedConversations.inc({ reason: 'agent_error' });
        }

        const lang = detectLanguage(content);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          text: getFallbackResponse(lang),
          usedFallback: true,
        };
      }
    });

    // Step 2: Send response to Discord (reuse existing client)
    await step.run('send-discord-response', async () => {
      try {
        requestLogger.debug('Sending response to Discord');

        const channel = await discordClient.channels.fetch(channelId);
        if (!channel?.isTextBased()) {
          throw new Error('Channel is not text-based');
        }

        // Split long messages (Discord limit: 2000 characters)
        const chunks: string[] = [];
        let currentChunk = '';
        
        const lines = agentResponse.text.split('\n');
        for (const line of lines) {
          if (currentChunk.length + line.length + 1 > 1900) {
            chunks.push(currentChunk);
            currentChunk = line;
          } else {
            currentChunk += (currentChunk ? '\n' : '') + line;
          }
        }
        if (currentChunk) chunks.push(currentChunk);

        // Send messages
        for (let i = 0; i < chunks.length; i++) {
          const isLastChunk = i === chunks.length - 1;
          
          await channel.send({
            content: chunks[i],
            components: isLastChunk && !agentResponse.usedFallback ? createButtons() : undefined,
          });
        }

        requestLogger.info({ chunks: chunks.length }, 'Response sent to Discord');

        return { success: true };
      } catch (error) {
        requestLogger.error({ error }, 'Discord send error');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    requestLogger.info('Workflow execution completed');

    return {
      success: true,
      messageId,
      threadId,
      requestId,
      agentResponse: agentResponse.text,
    };
  }
);
