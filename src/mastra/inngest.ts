import { Inngest } from 'inngest';

// Initialize Inngest client
export const inngest = new Inngest({
  id: 'edge-control-support',
  name: 'Edge Control Support Bot',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// Event types
export type EdgeControlEvents = {
  'discord/message.received': {
    data: {
      messageId: string;
      channelId: string;
      userId: string;
      username: string;
      content: string;
      threadId: string;
      isNewConversation: boolean;
      attachments?: Array<{
        url: string;
        contentType: string;
      }>;
    };
  };
  'discord/button.clicked': {
    data: {
      interactionId: string;
      channelId: string;
      userId: string;
      username: string;
      buttonId: string;
      threadId: string;
    };
  };
};
