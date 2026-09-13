import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth';
import { query } from '../config/db';

const router = Router();

// Apply authentication middleware
router.use(authenticateToken as any);

/**
 * Helper to resolve logged-in user details (employeeId, companyId)
 */
async function resolveUserContext(req: AuthenticatedRequest) {
  const userEmail = req.user?.email || (req.user as any)?.preferred_username;
  let rawCompanyId = req.user?.companyId || (req.user as any)?.company_id || (req.query.companyId as string);
  if (rawCompanyId === 'all' || rawCompanyId === 'undefined' || rawCompanyId === 'null') {
    rawCompanyId = undefined;
  }
  let companyId = rawCompanyId;
  let employeeId: string | null = null;
  let empName: string = userEmail || 'Employee';

  if (userEmail) {
    const empRes = await query(
      `SELECT id, company_id, first_name, last_name FROM hrms.employees 
       WHERE (LOWER(email) = LOWER($1) OR LOWER(emp_id_code) = LOWER($1) OR LOWER(SPLIT_PART(email, '@', 1)) = LOWER($1)) AND status = 'ACTIVE' LIMIT 1`,
      [userEmail]
    );
    if (empRes.rows.length > 0) {
      employeeId = empRes.rows[0].id;
      empName = `${empRes.rows[0].first_name || ''} ${empRes.rows[0].last_name || ''}`.trim() || userEmail;
      if (!companyId) {
        companyId = empRes.rows[0].company_id;
      }
    }
  }

  if (!companyId) {
    const defaultCompany = await query(`SELECT id FROM hrms.companies ORDER BY created_at ASC LIMIT 1`);
    if (defaultCompany.rows.length > 0) {
      companyId = defaultCompany.rows[0].id;
    }
  }

  return { userEmail, companyId, employeeId, empName };
}

/**
 * Helper to sync/ensure today's birthday & anniversary events exist in `hrms.employee_events` table
 */
async function syncTodayEvents(companyId: string) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const pad = (n: number) => String(n).padStart(2, '0');
  const mmdd = `${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const todayDateStr = `${currentYear}-${mmdd}`;

  if (companyId && companyId !== 'all') {
    // 1. Insert Birthdays today directly via SQL (using TO_CHAR for exact MM-DD match)
    await query(
      `INSERT INTO hrms.employee_events (company_id, employee_id, event_type, event_date, event_year)
       SELECT company_id, id, 'BIRTHDAY', $3, $4
       FROM hrms.employees
       WHERE company_id = $1 AND status = 'ACTIVE' AND dob IS NOT NULL AND TO_CHAR(dob, 'MM-DD') = $2
       ON CONFLICT (company_id, employee_id, event_type, event_year) DO NOTHING`,
      [companyId, mmdd, todayDateStr, currentYear]
    );

    // 2. Insert Anniversaries today directly via SQL (using TO_CHAR for exact MM-DD match)
    await query(
      `INSERT INTO hrms.employee_events (company_id, employee_id, event_type, event_date, event_year)
       SELECT company_id, id, 'ANNIVERSARY', $3, $4
       FROM hrms.employees
       WHERE company_id = $1 AND status = 'ACTIVE' AND joining_date IS NOT NULL AND TO_CHAR(joining_date, 'MM-DD') = $2
       ON CONFLICT (company_id, employee_id, event_type, event_year) DO NOTHING`,
      [companyId, mmdd, todayDateStr, currentYear]
    );
  } else {
    await query(
      `INSERT INTO hrms.employee_events (company_id, employee_id, event_type, event_date, event_year)
       SELECT company_id, id, 'BIRTHDAY', $2, $3
       FROM hrms.employees
       WHERE status = 'ACTIVE' AND dob IS NOT NULL AND TO_CHAR(dob, 'MM-DD') = $1
       ON CONFLICT (company_id, employee_id, event_type, event_year) DO NOTHING`,
      [mmdd, todayDateStr, currentYear]
    );

    await query(
      `INSERT INTO hrms.employee_events (company_id, employee_id, event_type, event_date, event_year)
       SELECT company_id, id, 'ANNIVERSARY', $2, $3
       FROM hrms.employees
       WHERE status = 'ACTIVE' AND joining_date IS NOT NULL AND TO_CHAR(joining_date, 'MM-DD') = $1
       ON CONFLICT (company_id, employee_id, event_type, event_year) DO NOTHING`,
      [mmdd, todayDateStr, currentYear]
    );
  }
}

/**
 * @route   GET /api/v1/events/today
 * @desc    Fetch today's events (Birthdays & Anniversaries) with wishes & reactions count
 */
router.get('/today', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { companyId, employeeId } = await resolveUserContext(req);

    if (!companyId) {
      return res.json({ events: [] });
    }

    // Auto-sync today's events
    await syncTodayEvents(companyId);

    const today = new Date();
    const currentYear = today.getFullYear();
    const pad = (n: number) => String(n).padStart(2, '0');
    const mmdd = `${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const todayStr = `${currentYear}-${mmdd}`;

    // Fetch today's events with employee info and aggregate reactions & wishes
    const eventsRes = await query(
      `SELECT 
        ee.id AS event_id,
        ee.company_id,
        ee.employee_id,
        ee.event_type,
        ee.event_date,
        ee.event_year,
        emp.first_name,
        emp.last_name,
        emp.email,
        emp.emp_image,
        COALESCE(desg.name, 'Team Member') AS designation,
        (SELECT COUNT(*) FROM hrms.event_reactions er WHERE er.event_id = ee.id) AS reaction_count,
        (SELECT reaction_type FROM hrms.event_reactions er WHERE er.event_id = ee.id AND er.sender_employee_id = $2 LIMIT 1) AS user_reaction,
        (SELECT COUNT(*) FROM hrms.event_wishes ew WHERE ew.event_id = ee.id AND ew.is_deleted = FALSE) AS wish_count
       FROM hrms.employee_events ee
       JOIN hrms.employees emp ON emp.id = ee.employee_id
       LEFT JOIN hrms.designations desg ON desg.id = emp.designation_id
       WHERE ($1 = 'all' OR ee.company_id::text = $1)
         AND (
           TO_CHAR(ee.event_date, 'YYYY-MM-DD') = $3
           OR TO_CHAR(emp.joining_date, 'MM-DD') = $4
           OR TO_CHAR(emp.dob, 'MM-DD') = $4
         )
       ORDER BY ee.created_at DESC`,
      [companyId, employeeId || '00000000-0000-0000-0000-000000000000', todayStr, mmdd]
    );

    // Fetch wishes & reactions for each event
    const events = [];
    for (const row of eventsRes.rows) {
      const wishesRes = await query(
        `SELECT 
          ew.id,
          ew.sender_employee_id,
          ew.message,
          ew.created_at,
          sender.first_name AS sender_first_name,
          sender.last_name AS sender_last_name,
          sender.emp_image AS sender_emp_image
         FROM hrms.event_wishes ew
         JOIN hrms.employees sender ON sender.id = ew.sender_employee_id
         WHERE ew.event_id = $1 AND ew.is_deleted = FALSE
         ORDER BY ew.created_at DESC`,
        [row.event_id]
      );

      const reactionsRes = await query(
        `SELECT 
          er.sender_employee_id,
          er.reaction_type,
          sender.first_name AS sender_first_name,
          sender.last_name AS sender_last_name,
          sender.emp_image AS sender_emp_image
         FROM hrms.event_reactions er
         JOIN hrms.employees sender ON sender.id = er.sender_employee_id
         WHERE er.event_id = $1
         ORDER BY er.created_at DESC`,
        [row.event_id]
      );

      events.push({
        eventId: String(row.event_id),
        employeeId: row.employee_id,
        employeeName: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email,
        empImage: row.emp_image || null,
        designation: row.designation || 'Team Member',
        eventType: row.event_type,
        eventDate: row.event_date,
        eventYear: row.event_year,
        reactionCount: parseInt(row.reaction_count || '0', 10),
        userReaction: row.user_reaction || null,
        wishCount: parseInt(row.wish_count || '0', 10),
        reactions: reactionsRes.rows.map(r => ({
          senderId: r.sender_employee_id,
          senderName: `${r.sender_first_name || ''} ${r.sender_last_name || ''}`.trim(),
          senderEmpImage: r.sender_emp_image || null,
          reactionType: r.reaction_type
        })),
        wishes: wishesRes.rows.map(w => ({
          id: String(w.id),
          senderId: w.sender_employee_id,
          senderName: `${w.sender_first_name || ''} ${w.sender_last_name || ''}`.trim(),
          senderEmpImage: w.sender_emp_image || null,
          message: w.message,
          createdAt: w.created_at,
          isCelebrantReply: w.sender_employee_id === row.employee_id
        }))
      });
    }

    return res.json({ events });
  } catch (error: any) {
    console.error('Error fetching today events:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch events' });
  }
});

/**
 * @route   POST /api/v1/events/:eventId/react
 * @desc    Toggle or add reaction (LIKE, HEART, CONGRATS) to an event
 */
router.post('/:eventId/react', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { employeeId } = await resolveUserContext(req);
    const { eventId } = req.params;
    const { reactionType = 'LIKE' } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Sender employee context not found' });
    }

    // Check if user already reacted
    const existing = await query(
      `SELECT id, reaction_type FROM hrms.event_reactions WHERE event_id = $1 AND sender_employee_id = $2`,
      [eventId, employeeId]
    );

    if (existing.rows.length > 0) {
      const currentReaction = existing.rows[0].reaction_type;
      if (currentReaction === reactionType) {
        // Toggle OFF if clicked same reaction again
        await query(`DELETE FROM hrms.event_reactions WHERE id = $1`, [existing.rows[0].id]);
      } else {
        // Update to new reaction type
        await query(`UPDATE hrms.event_reactions SET reaction_type = $1 WHERE id = $2`, [reactionType, existing.rows[0].id]);
      }
    } else {
      // Insert new reaction
      await query(
        `INSERT INTO hrms.event_reactions (event_id, sender_employee_id, reaction_type) VALUES ($1, $2, $3)`,
        [eventId, employeeId, reactionType]
      );
    }

    // Get updated total reaction count & user status
    const countRes = await query(`SELECT COUNT(*) FROM hrms.event_reactions WHERE event_id = $1`, [eventId]);
    const userRes = await query(
      `SELECT reaction_type FROM hrms.event_reactions WHERE event_id = $1 AND sender_employee_id = $2`,
      [eventId, employeeId]
    );

    return res.json({
      success: true,
      reactionCount: parseInt(countRes.rows[0].count || '0', 10),
      userReaction: userRes.rows.length > 0 ? userRes.rows[0].reaction_type : null
    });
  } catch (error: any) {
    console.error('Error toggling reaction:', error);
    return res.status(500).json({ error: error.message || 'Failed to update reaction' });
  }
});

/**
 * @route   POST /api/v1/events/:eventId/wish
 * @desc    Add a wish/comment message to an event
 */
router.post('/:eventId/wish', async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { employeeId, empName } = await resolveUserContext(req);
    const { eventId } = req.params;
    const { message } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Sender employee profile not found' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Wish message cannot be empty' });
    }

    const insertRes = await query(
      `INSERT INTO hrms.event_wishes (event_id, sender_employee_id, message)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [eventId, employeeId, message.trim()]
    );

    const newWish = {
      id: String(insertRes.rows[0].id),
      senderId: employeeId,
      senderName: empName,
      message: message.trim(),
      createdAt: insertRes.rows[0].created_at
    };

    return res.json({ success: true, wish: newWish });
  } catch (error: any) {
    console.error('Error posting wish:', error);
    return res.status(500).json({ error: error.message || 'Failed to send wish' });
  }
});

export default router;
