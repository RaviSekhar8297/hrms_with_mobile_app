import { Router, Response } from 'express';
import { query } from '../config/db';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middlewares/auth';
import { enqueueActivityLog } from '../server'; 

const router = Router();

router.use(authenticateToken as any);

/**
 * @openapi
 * /api/v1/visitors/logs:
 *   get:
 *     summary: Get Visitor Pass & Check-in Logs
 *     tags:
 *       - Visitor Management
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of visitor log objects
 *       401:
 *         description: Unauthorized
 */
router.get('/logs', requirePermission('visitors:read') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const result = await query(
      `SELECT vl.*, v.name, v.phone_number, v.visitor_type 
       FROM hrms.visitor_logs vl
       JOIN hrms.visitors v ON vl.visitor_id = v.id
       WHERE vl.company_id = $1 AND vl.check_in_time >= CURRENT_DATE
       ORDER BY vl.check_in_time DESC`,
      [companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching visitor logs:', err);
    res.status(500).json({ error: 'Failed to fetch visitor logs' });
  }
});

/**
 * @openapi
 * /api/v1/visitors/checkin:
 *   post:
 *     summary: Create New Visitor Check-in
 *     tags:
 *       - Visitor Management
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone_number
 *               - visitor_type
 *             properties:
 *               name:
 *                 type: string
 *                 example: Ramesh Kumar
 *               phone_number:
 *                 type: string
 *                 example: "9876543210"
 *               visitor_type:
 *                 type: string
 *                 example: Client / Vendor
 *               host_id:
 *                 type: string
 *               purpose:
 *                 type: string
 *                 example: Project discussion meeting
 *     responses:
 *       201:
 *         description: Visitor checked in successfully
 *       400:
 *         description: Invalid input parameters
 */
router.post('/checkin', requirePermission('visitors:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { name, phone_number, visitor_type, host_id, purpose } = req.body;

    // 1. Check if visitor exists, if not create
    let visitorId;
    const visitorQuery = await query(
      `SELECT id FROM hrms.visitors WHERE company_id = $1 AND phone_number = $2 LIMIT 1`,
      [companyId, phone_number]
    );

    if (visitorQuery.rows.length > 0) {
      visitorId = visitorQuery.rows[0].id;
    } else {
      const newVisitor = await query(
        `INSERT INTO hrms.visitors (company_id, name, phone_number, visitor_type) VALUES ($1, $2, $3, $4) RETURNING id`,
        [companyId, name, phone_number, visitor_type]
      );
      visitorId = newVisitor.rows[0].id;
    }

    // 2. Create visitor log
    const logResult = await query(
      `INSERT INTO hrms.visitor_logs (company_id, visitor_id, host_id, purpose, check_in_time, status) 
       VALUES ($1, $2, $3, $4, NOW(), 'CHECKED_IN') RETURNING *`,
      [companyId, visitorId, host_id, purpose]
    );

    // 🔔 Notify Host Employee about visitor arrival
    if (host_id && companyId) {
      try {
        const { sendNotification } = require('../services/notificationService');
        sendNotification({
          companyId,
          recipientId: host_id,
          module: 'VISITORS',
          eventCode: 'VISITOR_CHECKED_IN',
          referenceType: 'VISITOR',
          referenceId: logResult.rows[0].id,
          title: 'Guest Arrived at Reception 🚪',
          message: `${name} (${visitor_type || 'Visitor'}) has checked in to meet you. Purpose: ${purpose || 'Meeting'}`,
          type: 'INFO',
          actionUrl: '/dashboard/visitors',
        });
      } catch (notifErr) {
        console.error('[VisitorNotification] Failed to send notification:', notifErr);
      }
    }

    enqueueActivityLog(companyId ?? null, email || '', 'VISITOR_CHECKIN', 'visitors', `Checked in visitor ${name}`, req.ip || '', (req.headers['user-agent'] as string) || '');
    
    res.status(201).json(logResult.rows[0]);
  } catch (err) {
    console.error('Error creating check-in:', err);
    res.status(500).json({ error: 'Failed to create check-in' });
  }
});

export default router;
