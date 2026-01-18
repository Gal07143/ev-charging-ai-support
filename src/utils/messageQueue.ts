import { Queue, Worker, QueueEvents } from 'bullmq';
import { logger } from './logger';
import { inngest } from '../mastra/inngest';

// Redis connection configuration
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

// Create message queue
export const messageQueue = new Queue('discord-messages', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
    },
  },
});

// Queue events for monitoring
const queueEvents = new QueueEvents('discord-messages', {
  connection: redisConnection,
});

queueEvents.on('completed', ({ jobId }) => {
  logger.debug({ jobId }, 'Job completed');
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'Job failed');
});

// Worker to process messages
let messageWorker: Worker | null = null;

export function startMessageWorker() {
  if (messageWorker) {
    logger.warn('Message worker already started');
    return messageWorker;
  }

  messageWorker = new Worker(
    'discord-messages',
    async (job) => {
      const { messageId, channelId, userId, username, content, threadId, isNewConversation, attachments } = job.data;

      logger.info({ jobId: job.id, userId, threadId }, 'Processing message from queue');

      try {
        // Send to Inngest workflow
        await inngest.send({
          name: 'discord/message.received',
          data: {
            messageId,
            channelId,
            userId,
            username,
            content,
            threadId,
            isNewConversation,
            attachments: attachments || [],
          },
        });

        return { success: true };
      } catch (error) {
        logger.error({ jobId: job.id, error }, 'Failed to process message');
        throw error; // Will trigger retry
      }
    },
    {
      connection: redisConnection,
      concurrency: 10, // Process up to 10 messages concurrently
      limiter: {
        max: 50, // Max 50 jobs
        duration: 1000, // per second
      },
    }
  );

  messageWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Message processed successfully');
  });

  messageWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'Message processing failed');
  });

  logger.info('✅ Message worker started');
  return messageWorker;
}

export async function stopMessageWorker() {
  if (messageWorker) {
    await messageWorker.close();
    logger.info('✅ Message worker stopped');
    messageWorker = null;
  }
}

// Add message to queue
export async function enqueueMessage(data: {
  messageId: string;
  channelId: string;
  userId: string;
  username: string;
  content: string;
  threadId: string;
  isNewConversation: boolean;
  attachments?: Array<{ url: string; contentType: string }>;
}) {
  const job = await messageQueue.add('process-message', data, {
    jobId: `msg-${data.messageId}`, // Prevent duplicates
  });

  logger.debug({ jobId: job.id, userId: data.userId }, 'Message enqueued');
  return job;
}

// Get queue stats
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    messageQueue.getWaitingCount(),
    messageQueue.getActiveCount(),
    messageQueue.getCompletedCount(),
    messageQueue.getFailedCount(),
    messageQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}
