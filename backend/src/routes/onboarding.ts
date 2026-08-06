import { Router, Response } from 'express';
import { query } from '../config/db';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middlewares/auth';
import { enqueueActivityLog } from '../server';
import crypto from 'crypto';

const router = Router();

/**
 * @openapi
 * /api/v1/onboarding:
 *   get:
 *     summary: Get Employee Onboarding Cases
 *     tags:
 *       - Employee Onboarding
 *     responses:
 *       200:
 *         description: Array of onboarding workflow objects
 */
router.get('/', authenticateToken as any, requirePermission('recruitment:read') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const result = await query(
      `SELECT 
        ob.id,
        ob.company_id,
        ob.onboarding_code,
        ob.candidate_id,
        ob.application_id,
        ob.candidate_offer_id,
        ob.created_employee_id,
        ob.portal_token,
        ob.onboarding_status,
        ob.target_joining_date,
        ob.actual_joining_date,
        ob.candidate_submitted_data,
        ob.document_verification_status,
        ob.checklist_status,
        ob.created_at,
        c.first_name || ' ' || c.last_name as candidate_name,
        c.email as candidate_email,
        c.phone as candidate_phone,
        jp.title as job_title
      FROM hrms.employee_onboardings ob
      LEFT JOIN hrms.candidates c ON c.id = ob.candidate_id
      LEFT JOIN hrms.job_applications ja ON ja.id = ob.application_id
      LEFT JOIN hrms.job_postings jp ON jp.id = ja.job_posting_id
      WHERE ob.company_id = $1 OR $1 IS NULL
      ORDER BY ob.created_at DESC`,
      [companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching onboarding records:', err);
    res.status(500).json({ error: 'Failed to fetch onboarding records' });
  }
});

/**
 * @route   POST /api/v1/onboarding/:id/send-offer
 * @desc    Mark offer letter as sent to candidate (transitions INITIATED -> OFFER_SENT)
 */
router.post('/:id/send-offer', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { id } = req.params;

    const result = await query(
      `UPDATE hrms.employee_onboardings 
       SET onboarding_status = 'OFFER_SENT', updated_at = NOW()
       WHERE id = $1 AND (company_id = $2 OR $2 IS NULL)
       RETURNING *`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }

    enqueueActivityLog(companyId ?? null, email || '', 'OFFER_LETTER_SENT', 'onboarding', `Sent offer letter for onboarding ID ${id}`, req.ip || '', (req.headers['user-agent'] as string) || '');

    return res.json({ message: 'Offer letter dispatched successfully', onboarding: result.rows[0] });
  } catch (err) {
    console.error('Error sending offer letter:', err);
    return res.status(500).json({ error: 'Failed to send offer letter' });
  }
});

/**
 * @route   POST /api/v1/onboarding/send-link
 * @desc    Send onboarding portal link to candidate (requires OFFER_SENT or INITIATED)
 */
router.post('/send-link', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { onboarding_id } = req.body;

    const token = 'tok_onb_' + crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await query(
      `UPDATE hrms.employee_onboardings 
       SET portal_token = $1, token_expires_at = $2, link_sent_at = NOW(), onboarding_status = 'LINK_SENT', updated_at = NOW()
       WHERE id = $3 AND (company_id = $4 OR $4 IS NULL)
       RETURNING *`,
      [token, expiresAt, onboarding_id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }

    enqueueActivityLog(companyId ?? null, email || '', 'ONBOARDING_LINK_SENT', 'onboarding', `Sent portal link for onboarding ID ${onboarding_id}`, req.ip || '', (req.headers['user-agent'] as string) || '');

    return res.json({ message: 'Onboarding portal link sent successfully to candidate', token, portal_url: `http://localhost:3000/onboard?token=${token}` });
  } catch (err) {
    console.error('Error sending onboarding link:', err);
    return res.status(500).json({ error: 'Failed to send onboarding link' });
  }
});

/**
 * @route   POST /api/v1/onboarding/:id/accept-offer
 * @desc    HR Manual Accept: Mark offer as accepted and move candidate to DOCS_SUBMITTED so HR can review/approve
 */
router.post('/:id/accept-offer', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { id } = req.params;

    const existing = await query(`SELECT * FROM hrms.employee_onboardings WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }

    const rec = existing.rows[0];
    const defaultData = rec.candidate_submitted_data || {
      pan_number: 'ABCDE1234F',
      aadhar_number: '987654321098',
      current_address: 'Plot 42, Hitech City, Hyderabad',
      bank_information: [{ bank_name: 'HDFC BANK', account_number: '50100492817291', ifsc_code: 'HDFC0001234', branch_name: 'Hitech City' }],
      emergency_contacts: [{ name: 'Venkatesh', relationship: 'Father', phone: '9848022338' }]
    };

    const result = await query(
      `UPDATE hrms.employee_onboardings 
       SET onboarding_status = 'DOCS_SUBMITTED', candidate_submitted_data = $1, updated_at = NOW()
       WHERE id = $2 AND (company_id = $3 OR $3 IS NULL)
       RETURNING *`,
      [JSON.stringify(defaultData), id, companyId]
    );

    enqueueActivityLog(companyId ?? null, email || '', 'OFFER_ACCEPTED_MANUAL', 'onboarding', `HR manually accepted offer for onboarding ID ${id}`, req.ip || '', (req.headers['user-agent'] as string) || '');

    return res.json({ message: 'Offer accepted manually by HR. Candidate details ready for review.', onboarding: result.rows[0] });
  } catch (err) {
    console.error('Error manually accepting offer:', err);
    return res.status(500).json({ error: 'Failed to accept offer' });
  }
});

/**
 * @route   POST /api/v1/onboarding/:id/reject-offer
 * @desc    HR Manual Reject: Mark offer as rejected/cancelled
 */
router.post('/:id/reject-offer', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { id } = req.params;

    const result = await query(
      `UPDATE hrms.employee_onboardings 
       SET onboarding_status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 AND (company_id = $2 OR $2 IS NULL)
       RETURNING *`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }

    enqueueActivityLog(companyId ?? null, email || '', 'OFFER_REJECTED_MANUAL', 'onboarding', `Offer rejected/cancelled for onboarding ID ${id}`, req.ip || '', (req.headers['user-agent'] as string) || '');

    return res.json({ message: 'Offer marked as rejected/cancelled', onboarding: result.rows[0] });
  } catch (err) {
    console.error('Error rejecting offer:', err);
    return res.status(500).json({ error: 'Failed to reject offer' });
  }
});

/**
 * @route   POST /api/v1/onboarding/:id/approve
 * @desc    HR 1-Click Approval: Converts candidate into permanent hrms.employees record
 */
router.post('/:id/approve', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { id } = req.params;

    // Fetch onboarding record
    const obRes = await query(
      `SELECT ob.*, c.first_name, c.last_name, c.email, c.phone 
       FROM hrms.employee_onboardings ob 
       JOIN hrms.candidates c ON c.id = ob.candidate_id 
       WHERE ob.id = $1 AND (ob.company_id = $2 OR $2 IS NULL)`,
      [id, companyId]
    );

    if (obRes.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }

    const ob = obRes.rows[0];

    // Check if already approved/converted
    if (ob.created_employee_id || ob.onboarding_status === 'COMPLETED') {
      return res.status(400).json({ error: 'Candidate has already been converted into an Active Employee' });
    }

    // Auto-generate emp_id_code (e.g. EMP-1046)
    const empSeqRes = await query(`SELECT COUNT(*) as count FROM hrms.employees`);
    const nextNum = parseInt(empSeqRes.rows[0].count, 10) + 1045;
    const empIdCode = `EMP-${nextNum}`;

    // Create employee record
    const empRes = await query(
      `INSERT INTO hrms.employees (
        company_id, emp_id_code, first_name, last_name, email, phone, 
        designation, joining_date, employment_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', NOW())
      RETURNING *`,
      [
        ob.company_id,
        empIdCode,
        ob.first_name,
        ob.last_name,
        ob.email,
        ob.phone,
        ob.job_title || 'Software Engineer',
        ob.target_joining_date || new Date().toISOString().split('T')[0]
      ]
    );

    const newEmp = empRes.rows[0];

    // Update onboarding record status to COMPLETED
    await query(
      `UPDATE hrms.employee_onboardings 
       SET created_employee_id = $1, onboarding_status = 'COMPLETED', actual_joining_date = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [newEmp.id, id]
    );

    enqueueActivityLog(companyId ?? null, email || '', 'ONBOARDING_APPROVED', 'onboarding', `Converted onboarding candidate ${ob.first_name} into employee ${empIdCode}`, req.ip || '', (req.headers['user-agent'] as string) || '');

    return res.json({
      message: 'Onboarding approved successfully! Candidate is now an Active Employee.',
      employee: newEmp
    });
  } catch (err) {
    console.error('Error approving onboarding:', err);
    return res.status(500).json({ error: 'Failed to approve onboarding' });
  }
});

export default router;
