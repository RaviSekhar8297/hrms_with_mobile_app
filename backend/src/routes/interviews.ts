import { Router, Response } from 'express';
import { query } from '../config/db';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middlewares/auth';
import { enqueueActivityLog } from '../server'; 

const router = Router();

router.use(authenticateToken as any);

/**
 * @openapi
 * /api/v1/interviews/schedules:
 *   get:
 *     summary: Get Interview Schedules & Evaluator Assignments
 *     tags:
 *       - Interview Panel & Scorecards
 *     responses:
 *       200:
 *         description: Array of interview schedule objects
 */
router.get('/schedules', requirePermission('recruitment:read') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const result = await query(
      `SELECT 
        ins.id,
        ins.company_id,
        ins.application_id,
        ins.interview_mode,
        ins.meeting_link,
        ins.location,
        ins.scheduled_start_time,
        ins.scheduled_end_time,
        ins.status,
        ins.created_at,
        c.id as candidate_id,
        c.first_name || ' ' || c.last_name as candidate_name,
        c.email as candidate_email,
        c.phone as candidate_phone,
        jp.title as job_title,
        ir.round_name
      FROM hrms.interview_schedules ins
      LEFT JOIN hrms.job_applications ja ON ja.id = ins.application_id
      LEFT JOIN hrms.candidates c ON c.id = ja.candidate_id
      LEFT JOIN hrms.job_postings jp ON jp.id = ja.job_posting_id
      LEFT JOIN hrms.job_interview_rounds ir ON ir.id = ins.job_interview_round_id
      WHERE ins.company_id = $1 OR $1 IS NULL
      ORDER BY ins.scheduled_start_time DESC`,
      [companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching schedules:', err);
    res.status(500).json({ error: 'Failed to fetch interview schedules' });
  }
});

/**
 * @route   GET /api/v1/interviews/feedback/history
 * @desc    Get past interview feedback history joined with candidate and schedule details
 */
router.get('/feedback/history', requirePermission('recruitment:read') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const result = await query(
      `SELECT 
        fb.id,
        fb.interview_schedule_id,
        fb.technical_rating,
        fb.communication_rating,
        fb.problem_solving_rating,
        fb.overall_rating,
        fb.recommendation,
        fb.feedback,
        fb.submitted_at,
        fb.created_at,
        c.first_name || ' ' || c.last_name as candidate_name,
        c.email as candidate_email,
        jp.title as job_title,
        ir.round_name
      FROM hrms.interview_feedback fb
      LEFT JOIN hrms.interview_schedules ins ON ins.id = fb.interview_schedule_id
      LEFT JOIN hrms.job_applications ja ON ja.id = ins.application_id
      LEFT JOIN hrms.candidates c ON c.id = ja.candidate_id
      LEFT JOIN hrms.job_postings jp ON jp.id = ja.job_posting_id
      LEFT JOIN hrms.job_interview_rounds ir ON ir.id = ins.job_interview_round_id
      WHERE fb.company_id = $1 OR $1 IS NULL
      ORDER BY fb.created_at DESC`,
      [companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching feedback history:', err);
    res.status(500).json({ error: 'Failed to fetch feedback history' });
  }
});

/**
 * @route   POST /api/v1/interviews/feedback
 * @desc    Submit interview feedback
 */
router.post('/feedback', requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { schedule_id, technical_rating, communication_rating, detailed_feedback, recommendation } = req.body;

    const result = await query(
      `INSERT INTO hrms.interview_feedback 
      (company_id, interview_schedule_id, interviewer_id, technical_rating, communication_rating, feedback, recommendation) 
      VALUES ($1, $2, (SELECT id FROM hrms.employees WHERE official_email = $3 AND (company_id = $1 OR $1 IS NULL) LIMIT 1), $4, $5, $6, $7) 
      RETURNING *`,
      [companyId, schedule_id, email, technical_rating, communication_rating, detailed_feedback, recommendation]
    );

    // Also update schedule status to COMPLETED
    await query(`UPDATE hrms.interview_schedules SET status = 'COMPLETED' WHERE id = $1`, [schedule_id]);

    enqueueActivityLog(companyId ?? null, email || '', 'FEEDBACK_SUBMITTED', 'interviews', `Submitted feedback for schedule ${schedule_id}`, req.ip || '', (req.headers['user-agent'] as string) || '');
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error submitting feedback:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

export default router;
