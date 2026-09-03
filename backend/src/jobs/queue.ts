import { Queue } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

// 1. Audit & Activity Logs Queue
export const auditLogQueue = new Queue('audit-logs', {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 100,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

// 2. Email Notification Queue
export const emailQueue = new Queue('email-notifications', {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
    attempts: 3,
  },
});

// 3. WhatsApp Notification Queue
export const whatsappQueue = new Queue('whatsapp-notifications', {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
    attempts: 3,
  },
});

// 4. Bulk Data Import Queue
export const dataImportQueue = new Queue('data-imports', {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 20,
    attempts: 2,
  },
});

console.log('✅ BullMQ Queues initialized (audit-logs, email-notifications, whatsapp-notifications, data-imports)');
