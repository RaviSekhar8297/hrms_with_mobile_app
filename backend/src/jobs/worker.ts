import { Worker, Job } from 'bullmq';
import { query } from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

// 1. Audit Log Worker
export const auditWorker = new Worker(
  'audit-logs',
  async (job: Job) => {
    const { companyId, userEmail, action, module, details, ipAddress } = job.data;
    try {
      await query(
        `INSERT INTO hrms.activity_logs (company_id, user_email, action, module, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [companyId || null, userEmail, action, module, JSON.stringify(details || {}), ipAddress || null]
      );
    } catch (err: any) {
      // Fallback: If table activity_logs doesn't exist, log to console
      console.log(`[Audit Log Queued Job] ${userEmail} performed ${action} in ${module}`);
    }
  },
  { connection }
);

auditWorker.on('completed', () => {
  // Silent success
});

auditWorker.on('failed', (job, err) => {
  console.error(`⚠️ Audit Log job ${job?.id} failed:`, err.message);
});

console.log('✅ BullMQ Workers active and listening for background tasks');
