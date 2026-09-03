import { query } from '../config/db';
import { emailQueue, whatsappQueue } from '../jobs/queue';

export interface SendNotificationOptions {
  companyId: string;
  recipientId: string | null;
  senderId?: string | null;
  module: string;
  eventCode: string;
  referenceType?: string | null;
  referenceId?: string | number | null;
  title: string;
  message: string;
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
  actionUrl?: string | null;
}

/**
 * Unified Enterprise Notification Service
 * - Fast synchronous In-App Notification insertion to DB (< 5ms)
 * - Asynchronous Email & WhatsApp job queue dispatch (BullMQ)
 * - Error isolation so Queue/Config errors never break main transactions
 */
export async function sendNotification(options: SendNotificationOptions): Promise<void> {
  const {
    companyId,
    recipientId,
    senderId = null,
    module,
    eventCode,
    referenceType = null,
    referenceId = null,
    title,
    message,
    type = 'INFO',
    actionUrl = null,
  } = options;

  if (!companyId || !title || !message) {
    console.warn('[NotificationService] Missing required notification fields:', { companyId, title });
    return;
  }

  // 1. Insert In-App Notification to PostgreSQL (Synchronous for Bell UI)
  if (recipientId) {
    try {
      await query(
        `INSERT INTO hrms.notifications (
          company_id, sender_id, recipient_id, module, event_code,
          reference_type, reference_id, title, message, type, action_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          companyId,
          senderId,
          recipientId,
          module,
          eventCode,
          referenceType,
          referenceId ? String(referenceId) : null,
          title,
          message,
          type,
          actionUrl,
        ]
      );
    } catch (dbErr) {
      console.error('[NotificationService] Failed to insert in-app notification:', dbErr);
    }
  }

  // 2. Asynchronous External Delivery via BullMQ (Email & WhatsApp)
  try {
    const configResult = await query(
      `SELECT email_enabled, whatsapp_enabled, email_integration_id, whatsapp_campaign_id 
       FROM hrms.notification_configurations 
       WHERE company_id = $1 AND module = $2 AND event_code = $3 
       LIMIT 1`,
      [companyId, module, eventCode]
    );

    if (configResult.rows.length > 0) {
      const config = configResult.rows[0];

      // Dispatch Email Job asynchronously
      if (config.email_enabled) {
        emailQueue.add('send-email-notification', {
          companyId,
          recipientId,
          senderId,
          emailIntegrationId: config.email_integration_id,
          module,
          eventCode,
          title,
          message,
        }).catch((qErr: any) => {
          console.error('[NotificationService] Error enqueuing email notification:', qErr);
        });
      }

      // Dispatch WhatsApp Job asynchronously
      if (config.whatsapp_enabled) {
        whatsappQueue.add('send-whatsapp-notification', {
          companyId,
          recipientId,
          senderId,
          whatsappCampaignId: config.whatsapp_campaign_id,
          module,
          eventCode,
          title,
          message,
        }).catch((qErr: any) => {
          console.error('[NotificationService] Error enqueuing whatsapp notification:', qErr);
        });
      }
    }
  } catch (configErr) {
    console.error('[NotificationService] Error checking notification configurations:', configErr);
  }
}
