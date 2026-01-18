import { logger } from './logger';

// Maximum tokens to keep in context
const MAX_CONTEXT_TOKENS = 8000;

// Approximate token count (rough estimate: 1 token ≈ 4 characters)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Trim conversation history to fit within token limit
 * Keeps system messages and recent user/assistant messages
 */
export function trimConversationHistory(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = MAX_CONTEXT_TOKENS
): Array<{ role: string; content: string }> {
  if (messages.length === 0) return messages;

  // Separate system messages from conversation
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  // Calculate system tokens
  const systemTokens = systemMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
  const availableTokens = maxTokens - systemTokens;

  if (availableTokens <= 0) {
    logger.warn('System messages exceed token limit, truncating');
    return systemMessages.slice(-1); // Keep only last system message
  }

  // Build trimmed conversation from newest to oldest
  const trimmedConversation: typeof conversationMessages = [];
  let currentTokens = 0;

  // Always include the last message (current user message)
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i];
    const msgTokens = estimateTokens(msg.content);

    if (currentTokens + msgTokens > availableTokens) {
      // Check if we can at least fit a summary
      if (i > 0) {
        logger.info(
          { droppedMessages: i + 1, keptMessages: trimmedConversation.length },
          'Trimmed conversation history'
        );
      }
      break;
    }

    trimmedConversation.unshift(msg);
    currentTokens += msgTokens;
  }

  return [...systemMessages, ...trimmedConversation];
}

/**
 * Keep only last N messages (simpler approach)
 */
export function keepRecentMessages(
  messages: Array<{ role: string; content: string }>,
  count: number = 20
): Array<{ role: string; content: string }> {
  if (messages.length <= count) return messages;

  // Always keep system messages
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  const recentConversation = conversationMessages.slice(-count);

  logger.info(
    { total: messages.length, kept: systemMessages.length + recentConversation.length },
    'Kept recent messages'
  );

  return [...systemMessages, ...recentConversation];
}
