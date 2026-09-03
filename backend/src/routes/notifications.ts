import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth';
import { query } from '../config/db';

const router = Router();

// Apply authentication middleware to all notification endpoints
router.use(authenticateToken as any);

/**
 * Helper to resolve employee ID and company ID for logged-in user
 */
async function resolveUserContext(req: AuthenticatedRequest) {
  const userEmail = req.user?.email;
  let companyId = req.user?.companyId || (req.user as any)?.company_id || (req.query.companyId as string);
  let employeeId: string | null = null;

  if (userEmail) {
    const empRes = await query(
      `SELECT id, company_id FROM hrms.employees WHERE (LOWER(email) = LOWER($1) OR LOWER(emp_id_code) = LOWER($1) OR LOWER(SPLIT_PART(email, '@', 1)) = LOWER($1)) AND status = 'ACTIVE' LIMIT 1`,
      [userEmail]
    );
    if (empRes.rows.length > 0) {
      employeeId = empRes.rows[0].id;
      if (!companyId) {
        companyId = empRes.rows[0].company_id;
      }
    }
  }

  return { userEmail, companyId, employeeId };
}

/**
 * @route   GET /api/notifications or /api/v1/notifications
 * @desc    Fetch paginated notifications & unread count for logged-in user
 * @access  Private (Authenticated User)
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { userEmail, companyId, employeeId } = await resolveUserContext(req);

    if (!userEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // If no employee profile or company context exists for this user, return empty list gracefully (HTTP 200)
    if (!employeeId) {
      return res.status(200).json({ notifications: [], unreadCount: 0 });
    }

    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const offset = (page - 1) * limit;

    // Fetch notifications filtered by recipient_id (and company_id if present)
    let listSql = `
      SELECT n.id, n.company_id, n.sender_id, n.recipient_id, n.module, n.event_code,
             n.reference_type, n.reference_id, n.title, n.message, n.type, n.action_url,
             n.is_read, n.read_at, n.created_at,
             COALESCE(e.first_name || ' ' || COALESCE(e.last_name, ''), 'System') AS sender_name
      FROM hrms.notifications n
      LEFT JOIN hrms.employees e ON e.id = n.sender_id
      WHERE n.recipient_id = $1
    `;
    const queryParams: any[] = [employeeId];

    if (companyId) {
      listSql += ` AND n.company_id = $2`;
      queryParams.push(companyId);
    }

    listSql += ` ORDER BY n.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const listRes = await query(listSql, queryParams);

    // Count unread notifications
    let countSql = `SELECT COUNT(*)::int AS unread_count FROM hrms.notifications WHERE recipient_id = $1 AND is_read = FALSE`;
    const countParams: any[] = [employeeId];
    if (companyId) {
      countSql += ` AND company_id = $2`;
      countParams.push(companyId);
    }

    const countRes = await query(countSql, countParams);
    const unreadCount = countRes.rows[0]?.unread_count || 0;

    return res.status(200).json({
      notifications: listRes.rows,
      unreadCount,
      page,
      limit,
    });
  } catch (err: any) {
    console.error('[Notifications API] Error fetching notifications:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a single notification as read
 * @access  Private
 */
router.put('/:id/read', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { employeeId } = await resolveUserContext(req);

    if (!id || !employeeId) {
      return res.status(400).json({ error: 'Invalid notification request' });
    }

    const result = await query(
      `UPDATE hrms.notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND recipient_id = $2
       RETURNING id, is_read, read_at`,
      [id, employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json({ success: true, notification: result.rows[0] });
  } catch (err: any) {
    console.error('[Notifications API] Error marking notification as read:', err);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all unread notifications as read
 * @access  Private
 */
router.put('/read-all', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { employeeId } = await resolveUserContext(req);

    if (!employeeId) {
      return res.status(400).json({ error: 'Invalid notification request' });
    }

    await query(
      `UPDATE hrms.notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE recipient_id = $1 AND is_read = FALSE`,
      [employeeId]
    );

    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err: any) {
    console.error('[Notifications API] Error marking all notifications as read:', err);
    return res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification for logged-in user
 * @access  Private
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { employeeId } = await resolveUserContext(req);

    if (!id || !employeeId) {
      return res.status(400).json({ error: 'Invalid notification request' });
    }

    await query(
      `DELETE FROM hrms.notifications
       WHERE id = $1 AND recipient_id = $2`,
      [id, employeeId]
    );

    return res.json({ success: true, message: 'Notification deleted' });
  } catch (err: any) {
    console.error('[Notifications API] Error deleting notification:', err);
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
