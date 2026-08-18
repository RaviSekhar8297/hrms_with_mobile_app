"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middlewares/auth");
const server_1 = require("../server");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
// Configure multer for memory storage (files stored in memory/database instead of disk folders)
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});
// Middleware to ensure authentication for all recruitment routes
router.use(auth_1.authenticateToken);
/**
 * @openapi
 * /api/v1/recruitment/jobs:
 *   get:
 *     summary: Get Active Job Postings
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: company_id
 *         schema:
 *           type: string
 *         description: Optional company ID filter for SuperAdmin
 *     responses:
 *       200:
 *         description: Array of job posting objects
 *       401:
 *         description: Unauthorized
 */
router.get('/jobs', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.query.company_id) {
            targetCompanyId = req.query.company_id;
        }
        let queryStr = `SELECT jp.*, 
        (SELECT COUNT(*)::int FROM hrms.job_applications ja WHERE ja.job_posting_id = jp.id) as applications_count,
        (SELECT name FROM hrms.departments d WHERE d.id = jp.department_id) as department_name
       FROM hrms.job_postings jp `;
        let queryParams = [];
        if (targetCompanyId) {
            queryStr += ` WHERE jp.company_id = $1 `;
            queryParams.push(targetCompanyId);
        }
        queryStr += ` ORDER BY jp.created_at DESC`;
        const result = await (0, db_1.query)(queryStr, queryParams);
        return res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching jobs:', err);
        return res.status(500).json({ error: 'Failed to fetch job postings' });
    }
});
/**
 * @openapi
 * /api/v1/recruitment/jobs/{id}:
 *   get:
 *     summary: Get Job Posting Details by ID
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job details object
 *       404:
 *         description: Job not found
 */
router.get('/jobs/:id', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await (0, db_1.query)(`SELECT jp.*, d.name as department_name 
       FROM hrms.job_postings jp 
       LEFT JOIN hrms.departments d ON jp.department_id = d.id 
       WHERE jp.id = $1`, [id]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Job not found' });
        return res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error fetching job:', err);
        return res.status(500).json({ error: 'Failed to fetch job' });
    }
});
/**
 * @openapi
 * /api/v1/recruitment/jobs/{id}/analytics:
 *   get:
 *     summary: Get Analytics & Candidate Breakdown for a Job
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application status counts and candidate summary
 */
router.get('/jobs/:id/analytics', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        const { id } = req.params;
        // Get summary counts
        const countsResult = await (0, db_1.query)(`SELECT 
        COUNT(*) as total_applicants,
        COUNT(*) FILTER (WHERE status IN ('APPLIED', 'SCREENING', 'INTERVIEWING')) as in_process,
        COUNT(*) FILTER (WHERE status IN ('SELECTED', 'OFFERED', 'HIRED')) as selected,
        COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected
       FROM hrms.job_applications 
       WHERE job_posting_id = $1`, [id]);
        // Get candidate lists grouped by their general status
        const candidatesResult = await (0, db_1.query)(`SELECT a.id, a.status, c.first_name, c.last_name, c.email
       FROM hrms.job_applications a
       JOIN hrms.candidates c ON a.candidate_id = c.id
       WHERE a.job_posting_id = $1
       ORDER BY a.updated_at DESC`, [id]);
        const stats = {
            summary: countsResult.rows[0],
            candidates: candidatesResult.rows
        };
        return res.json(stats);
    }
    catch (err) {
        console.error('Error fetching job analytics:', err);
        return res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});
/**
 * @openapi
 * /api/v1/recruitment/rounds:
 *   get:
 *     summary: List Master Interview Rounds
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of interview rounds
 */
router.get('/rounds', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.query.company_id)
            targetCompanyId = req.query.company_id;
        const result = await (0, db_1.query)(`SELECT * FROM hrms.job_interview_rounds WHERE company_id = $1 ORDER BY created_at ASC`, [targetCompanyId]);
        return res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching rounds:', err);
        return res.status(500).json({ error: 'Failed to fetch rounds' });
    }
});
/**
 * @openapi
 * /api/v1/recruitment/rounds:
 *   post:
 *     summary: Create Master Interview Round
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - round_name
 *             properties:
 *               round_name:
 *                 type: string
 *                 example: Technical Coding Round
 *               round_type:
 *                 type: string
 *                 example: Technical
 *     responses:
 *       201:
 *         description: Interview round created
 */
router.post('/rounds', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.body.company_id)
            targetCompanyId = req.body.company_id;
        const { round_name, round_type } = req.body;
        const result = await (0, db_1.query)(`INSERT INTO hrms.job_interview_rounds (company_id, round_name, round_type, round_order) 
       VALUES ($1, $2, $3, 1) RETURNING *`, [targetCompanyId, round_name, round_type || 'General']);
        return res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error creating round:', err);
        return res.status(500).json({ error: 'Failed to create round' });
    }
});
/**
 * @openapi
 * /api/v1/recruitment/rounds/{id}:
 *   put:
 *     summary: Update Master Interview Round
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               round_name:
 *                 type: string
 *               round_type:
 *                 type: string
 *     responses:
 *       200:
 *         description: Round updated
 *       404:
 *         description: Round not found
 */
router.put('/rounds/:id', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.body.company_id)
            targetCompanyId = req.body.company_id;
        if (isSuper && req.query.company_id)
            targetCompanyId = req.query.company_id;
        const { id } = req.params;
        const { round_name, round_type } = req.body;
        let result;
        if (targetCompanyId) {
            result = await (0, db_1.query)(`UPDATE hrms.job_interview_rounds SET round_name = $1, round_type = $2 WHERE id = $3 AND company_id = $4 RETURNING *`, [round_name, round_type || round_name, id, targetCompanyId]);
        }
        if (!result || result.rowCount === 0) {
            result = await (0, db_1.query)(`UPDATE hrms.job_interview_rounds SET round_name = $1, round_type = $2 WHERE id = $3 RETURNING *`, [round_name, round_type || round_name, id]);
        }
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Round not found' });
        return res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error updating round:', err);
        return res.status(500).json({ error: 'Failed to update round' });
    }
});
/**
 * @openapi
 * /api/v1/recruitment/rounds/{id}:
 *   delete:
 *     summary: Delete Master Interview Round
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Round deleted successfully
 *       404:
 *         description: Round not found
 */
router.delete('/rounds/:id', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.query.company_id)
            targetCompanyId = req.query.company_id;
        const { id } = req.params;
        let result;
        if (targetCompanyId) {
            result = await (0, db_1.query)(`DELETE FROM hrms.job_interview_rounds WHERE id = $1 AND company_id = $2 RETURNING *`, [id, targetCompanyId]);
        }
        if (!result || result.rowCount === 0) {
            result = await (0, db_1.query)(`DELETE FROM hrms.job_interview_rounds WHERE id = $1 RETURNING *`, [id]);
        }
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Round not found' });
        return res.json({ message: 'Round deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting round:', err);
        return res.status(500).json({ error: 'Failed to delete round' });
    }
});
/**
 * @route   POST /api/v1/recruitment/jobs/:id/apply
 * @desc    Apply for a job (Internal/Self)
 * @access  Private (Any authenticated user)
 */
router.post('/jobs/:id/apply', upload.single('resume'), async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, email, phone, company_id } = req.body;
        let targetCompanyId = req.user.companyId || company_id;
        // Check if candidate exists, if not create
        let candidateId;
        const existingCandidate = await (0, db_1.query)(`SELECT id FROM hrms.candidates WHERE company_id = $1 AND email = $2`, [targetCompanyId, email]);
        if (existingCandidate.rows.length > 0) {
            candidateId = existingCandidate.rows[0].id;
        }
        else {
            const newCandidate = await (0, db_1.query)(`INSERT INTO hrms.candidates (company_id, first_name, last_name, email, email_normalized, phone)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [targetCompanyId, first_name, last_name, email, email.toLowerCase(), phone]);
            candidateId = newCandidate.rows[0].id;
        }
        // Create job application
        const applicationCode = 'APP-' + Date.now();
        const appResult = await (0, db_1.query)(`INSERT INTO hrms.job_applications (company_id, candidate_id, job_posting_id, application_code, status)
       VALUES ($1, $2, $3, $4, 'APPLIED') RETURNING *`, [targetCompanyId, candidateId, id, applicationCode]);
        const applicationId = appResult.rows[0].id;
        // Save resume document directly into DB as Base64 Data URI if attached
        if (req.file) {
            const base64Data = req.file.buffer.toString('base64');
            const fileUrl = `data:${req.file.mimetype};base64,${base64Data}`;
            await (0, db_1.query)(`INSERT INTO hrms.candidate_documents (company_id, candidate_id, application_id, document_type, file_name, file_url, mime_type, file_size)
         VALUES ($1, $2, $3, 'RESUME', $4, $5, $6, $7)`, [targetCompanyId, candidateId, applicationId, req.file.originalname, fileUrl, req.file.mimetype, req.file.size]);
        }
        return res.status(201).json(appResult.rows[0]);
    }
    catch (err) {
        console.error('Error applying for job:', err);
        return res.status(500).json({ error: 'Failed to submit application' });
    }
});
/**
 * @openapi
 * /api/v1/recruitment/jobs:
 *   post:
 *     summary: Create New Job Posting
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: Senior Full Stack Developer
 *               location:
 *                 type: string
 *                 example: Hyderabad / Remote
 *               employment_type:
 *                 type: string
 *                 example: Full-Time
 *               headcount:
 *                 type: integer
 *                 example: 3
 *               salary_range:
 *                 type: string
 *                 example: 80k-120k
 *               description:
 *                 type: string
 *                 example: Looking for an experienced Node.js & React engineer.
 *     responses:
 *       201:
 *         description: Job posting created successfully
 *       500:
 *         description: Failed to create job posting
 */
router.post('/jobs', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { email } = req.user;
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.body.company_id) {
            targetCompanyId = req.body.company_id;
        }
        const { title, department_id, location, employment_type, headcount, salary_range, description, currency } = req.body;
        const jobCode = 'JOB-' + Date.now();
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-4);
        // Parse salary_range e.g. "50k-80k" -> min_salary = 50000, max_salary = 80000 (very naive parsing)
        let min_salary = null, max_salary = null;
        if (salary_range) {
            const parts = salary_range.split('-');
            if (parts.length >= 1)
                min_salary = parseFloat(parts[0].replace(/k/i, '000').replace(/[^0-9.]/g, '')) || null;
            if (parts.length >= 2)
                max_salary = parseFloat(parts[1].replace(/k/i, '000').replace(/[^0-9.]/g, '')) || null;
        }
        const result = await (0, db_1.query)(`INSERT INTO hrms.job_postings 
      (company_id, job_code, slug, title, department_id, work_mode, employment_type, openings_count, min_salary, max_salary, description, status, currency) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PUBLISHED', $12) 
      RETURNING *`, [
            targetCompanyId, jobCode, slug, title,
            department_id || null,
            location || 'On-site',
            employment_type || 'Full-Time',
            headcount || 1,
            min_salary, max_salary,
            description || '',
            currency || 'INR'
        ]);
        (0, server_1.enqueueActivityLog)(targetCompanyId || null, email || '', 'JOB_CREATED', 'recruitment', `Created job: ${title}`, req.ip || '', req.headers['user-agent'] || '');
        // Automatically insert optional interview rounds if specified
        if (Array.isArray(req.body.interview_rounds) && req.body.interview_rounds.length > 0) {
            for (let i = 0; i < req.body.interview_rounds.length; i++) {
                const roundName = String(req.body.interview_rounds[i]).trim();
                if (roundName) {
                    const existingRound = await (0, db_1.query)(`SELECT id FROM hrms.job_interview_rounds WHERE company_id = $1 AND round_name = $2`, [targetCompanyId, roundName]);
                    if (existingRound.rows.length === 0) {
                        await (0, db_1.query)(`INSERT INTO hrms.job_interview_rounds (company_id, round_name, round_type, round_order)
               VALUES ($1, $2, $3, $4)`, [targetCompanyId, roundName, roundName, i + 1]);
                    }
                }
            }
        }
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error('Error creating job:', err);
        res.status(500).json({ error: 'Failed to create job posting' });
    }
});
/**
 * @openapi
 * /api/v1/recruitment/jobs/{id}:
 *   put:
 *     summary: Update Job Posting Details
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               location:
 *                 type: string
 *               employment_type:
 *                 type: string
 *               headcount:
 *                 type: integer
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Job updated successfully
 *       404:
 *         description: Job not found
 */
router.put('/jobs/:id', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { email } = req.user;
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.body.company_id) {
            targetCompanyId = req.body.company_id;
        }
        const { id } = req.params;
        const { title, department_id, location, employment_type, headcount, salary_range, description, currency } = req.body;
        let min_salary = null, max_salary = null;
        if (salary_range) {
            const parts = salary_range.split('-');
            if (parts.length >= 1)
                min_salary = parseFloat(parts[0].replace(/k/i, '000').replace(/[^0-9.]/g, '')) || null;
            if (parts.length >= 2)
                max_salary = parseFloat(parts[1].replace(/k/i, '000').replace(/[^0-9.]/g, '')) || null;
        }
        const result = await (0, db_1.query)(`UPDATE hrms.job_postings 
       SET title = $1, department_id = $2, work_mode = $3, employment_type = $4, openings_count = $5, min_salary = $6, max_salary = $7, description = $8, currency = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 AND company_id = $11 
       RETURNING *`, [
            title, department_id || null, location || 'On-site', employment_type || 'Full-Time', headcount || 1, min_salary, max_salary, description || '', currency || 'INR',
            id, targetCompanyId
        ]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }
        (0, server_1.enqueueActivityLog)(targetCompanyId || null, email || '', 'JOB_UPDATED', 'recruitment', `Updated job: ${title}`, req.ip || '', req.headers['user-agent'] || '');
        return res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error updating job:', err);
        return res.status(500).json({ error: 'Failed to update job posting' });
    }
});
/**
 * @openapi
 * /api/v1/recruitment/jobs/{id}/status:
 *   put:
 *     summary: Update Job Status (e.g. PUBLISHED / CLOSED)
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 example: CLOSED
 *     responses:
 *       200:
 *         description: Status updated
 *       404:
 *         description: Job not found
 */
router.put('/jobs/:id/status', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { email } = req.user;
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.body.company_id)
            targetCompanyId = req.body.company_id;
        const { id } = req.params;
        const { status } = req.body;
        const result = await (0, db_1.query)(`UPDATE hrms.job_postings 
       SET status = $1, updated_at = CURRENT_TIMESTAMP, closed_at = CASE WHEN $1 = 'CLOSED' THEN CURRENT_TIMESTAMP ELSE closed_at END
       WHERE id = $2 AND company_id = $3 
       RETURNING *`, [status, id, targetCompanyId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }
        (0, server_1.enqueueActivityLog)(targetCompanyId || null, email || '', 'JOB_STATUS_UPDATED', 'recruitment', `Updated job status to ${status}`, req.ip || '', req.headers['user-agent'] || '');
        return res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error updating job status:', err);
        return res.status(500).json({ error: 'Failed to update job status' });
    }
});
/**
 * @openapi
 * /api/v1/recruitment/candidates:
 *   get:
 *     summary: List Candidates
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of candidate records
 */
router.get('/candidates', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.query.company_id) {
            targetCompanyId = req.query.company_id;
        }
        const result = await (0, db_1.query)(`SELECT * FROM hrms.candidates WHERE company_id = $1 ORDER BY created_at DESC`, [targetCompanyId]);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching candidates:', err);
        res.status(500).json({ error: 'Failed to fetch candidates' });
    }
});
/**
 * @openapi
 * /api/v1/recruitment/applications:
 *   get:
 *     summary: Get Job Applications
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: job_id
 *         schema:
 *           type: string
 *         description: Filter applications by specific Job ID
 *     responses:
 *       200:
 *         description: Array of job application records
 */
router.get('/applications', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.query.company_id)
            targetCompanyId = req.query.company_id;
        const { job_id } = req.query;
        let queryStr = `SELECT a.id as application_id, a.status, a.applied_at, 
              c.id as candidate_id, c.first_name, c.last_name, c.email, c.phone,
              (SELECT COUNT(*)::int FROM hrms.interview_schedules s WHERE s.application_id = a.id) as total_rounds,
              (SELECT COUNT(*)::int FROM hrms.interview_schedules s WHERE s.application_id = a.id AND s.status = 'COMPLETED') as completed_rounds,
              (SELECT r.round_name FROM hrms.interview_schedules s JOIN hrms.job_interview_rounds r ON s.job_interview_round_id = r.id WHERE s.application_id = a.id ORDER BY s.created_at DESC LIMIT 1) as current_round_name
       FROM hrms.job_applications a
       JOIN hrms.candidates c ON a.candidate_id = c.id
       WHERE a.company_id = $1`;
        let queryParams = [targetCompanyId];
        if (job_id && job_id !== 'all' && job_id !== '') {
            queryStr += ` AND a.job_posting_id = $2`;
            queryParams.push(job_id);
        }
        queryStr += ` ORDER BY a.applied_at DESC`;
        const result = await (0, db_1.query)(queryStr, queryParams);
        return res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching applications:', err);
        return res.status(500).json({ error: 'Failed to fetch applications' });
    }
});
/**
 * @openapi
 * /api/v1/recruitment/applications:
 *   post:
 *     summary: Submit Application & Candidate Profile
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - job_id
 *               - first_name
 *               - last_name
 *               - email
 *             properties:
 *               job_id:
 *                 type: string
 *               first_name:
 *                 type: string
 *                 example: Ananya
 *               last_name:
 *                 type: string
 *                 example: Reddy
 *               email:
 *                 type: string
 *                 example: ananya.reddy@example.com
 *               phone:
 *                 type: string
 *                 example: "9848012345"
 *     responses:
 *       201:
 *         description: Application submitted successfully
 *       500:
 *         description: Failed to submit application
 */
router.post('/applications', (0, auth_1.requirePermission)('recruitment:write'), upload.single('resume'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.body.company_id)
            targetCompanyId = req.body.company_id;
        const { job_id, first_name, last_name, email, phone } = req.body;
        // 1. Check if candidate exists, if not create
        let candidateId;
        const existingCandidate = await (0, db_1.query)(`SELECT id FROM hrms.candidates WHERE company_id = $1 AND email = $2`, [targetCompanyId, email]);
        if (existingCandidate.rows.length > 0) {
            candidateId = existingCandidate.rows[0].id;
        }
        else {
            const newCandidate = await (0, db_1.query)(`INSERT INTO hrms.candidates (company_id, first_name, last_name, email, email_normalized, phone)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [targetCompanyId, first_name, last_name, email, email.toLowerCase(), phone]);
            candidateId = newCandidate.rows[0].id;
        }
        // 2. Create job application
        const applicationCode = 'APP-' + Date.now();
        const appResult = await (0, db_1.query)(`INSERT INTO hrms.job_applications (company_id, candidate_id, job_posting_id, application_code, status)
       VALUES ($1, $2, $3, $4, 'APPLIED') RETURNING *`, [targetCompanyId, candidateId, job_id, applicationCode]);
        const applicationId = appResult.rows[0].id;
        // 3. Save resume document directly into DB as Base64 Data URI if attached
        if (req.file) {
            const base64Data = req.file.buffer.toString('base64');
            const fileUrl = `data:${req.file.mimetype};base64,${base64Data}`;
            await (0, db_1.query)(`INSERT INTO hrms.candidate_documents (company_id, candidate_id, application_id, document_type, file_name, file_url, mime_type, file_size)
         VALUES ($1, $2, $3, 'RESUME', $4, $5, $6, $7)`, [targetCompanyId, candidateId, applicationId, req.file.originalname, fileUrl, req.file.mimetype, req.file.size]);
        }
        (0, server_1.enqueueActivityLog)(targetCompanyId || null, req.user.email || '', 'CANDIDATE_ADDED', 'recruitment', `Added candidate ${first_name} ${last_name}`, req.ip || '', req.headers['user-agent'] || '');
        res.status(201).json(appResult.rows[0]);
    }
    catch (err) {
        console.error('Error adding application:', err);
        res.status(500).json({ error: 'Failed to add application' });
    }
});
/**
 * @openapi
 * /api/v1/recruitment/applications/{id}/stage:
 *   put:
 *     summary: Move Application to New Pipeline Stage
 *     tags:
 *       - Recruitment & ATS
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 example: INTERVIEWING
 *     responses:
 *       200:
 *         description: Application stage updated
 *       404:
 *         description: Application not found
 */
router.put('/applications/:id/stage', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.body.company_id)
            targetCompanyId = req.body.company_id;
        const { id } = req.params;
        const { status } = req.body;
        // Get current status
        const currentApp = await (0, db_1.query)(`SELECT status FROM hrms.job_applications WHERE id = $1 AND company_id = $2`, [id, targetCompanyId]);
        if (currentApp.rowCount === 0)
            return res.status(404).json({ error: 'Application not found' });
        const fromStatus = currentApp.rows[0].status;
        // Update status
        const appResult = await (0, db_1.query)(`UPDATE hrms.job_applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3 RETURNING *`, [status, id, targetCompanyId]);
        // Insert history
        await (0, db_1.query)(`INSERT INTO hrms.candidate_stage_history (company_id, application_id, from_status, to_status) VALUES ($1, $2, $3, $4)`, [targetCompanyId, id, fromStatus, status]);
        return res.json(appResult.rows[0]);
    }
    catch (err) {
        console.error('Error updating application stage:', err);
        return res.status(500).json({ error: 'Failed to update stage' });
    }
});
/**
 * @route   GET /api/recruitment/settings/email
 * @desc    Get email integrations
 * @access  Private
 */
router.get('/settings/email', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.query.company_id)
            targetCompanyId = req.query.company_id;
        let result;
        if (targetCompanyId) {
            result = await (0, db_1.query)(`SELECT * FROM hrms.email_integrations WHERE company_id = $1`, [targetCompanyId]);
        }
        else {
            result = await (0, db_1.query)(`SELECT * FROM hrms.email_integrations ORDER BY updated_at DESC LIMIT 1`);
        }
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        }
        else {
            res.json(null);
        }
    }
    catch (err) {
        console.error('Error fetching email integrations:', err);
        res.status(500).json({ error: 'Failed to fetch email integrations' });
    }
});
/**
 * @route   POST /api/recruitment/settings/email
 * @desc    Upsert email integration
 * @access  Private
 */
router.post('/settings/email', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { email } = req.user;
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.body.company_id)
            targetCompanyId = req.body.company_id;
        const { smtp_host, smtp_port, smtp_username, smtp_password_encrypted, encryption_type, from_email, from_name, is_active } = req.body;
        const result = await (0, db_1.query)(`INSERT INTO hrms.email_integrations 
        (company_id, smtp_host, smtp_port, smtp_username, smtp_password_encrypted, encryption_type, from_email, from_name, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (company_id) 
       DO UPDATE SET 
         smtp_host = EXCLUDED.smtp_host, 
         smtp_port = EXCLUDED.smtp_port, 
         smtp_username = EXCLUDED.smtp_username, 
         smtp_password_encrypted = EXCLUDED.smtp_password_encrypted, 
         encryption_type = EXCLUDED.encryption_type, 
         from_email = EXCLUDED.from_email, 
         from_name = EXCLUDED.from_name, 
         is_active = EXCLUDED.is_active, 
         updated_at = NOW()
       RETURNING *`, [targetCompanyId, smtp_host, smtp_port, smtp_username, smtp_password_encrypted, encryption_type, from_email, from_name, is_active]);
        (0, server_1.enqueueActivityLog)(targetCompanyId || null, email || '', 'INTEGRATION_UPDATED', 'recruitment', `Updated SMTP Email integration`, req.ip || '', req.headers['user-agent'] || '');
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error updating email integration:', err);
        res.status(500).json({ error: 'Failed to update email integration' });
    }
});
/**
 * @route   GET /api/recruitment/settings/whatsapp
 * @desc    Get whatsapp integration
 * @access  Private
 */
router.get('/settings/whatsapp', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.query.company_id)
            targetCompanyId = req.query.company_id;
        let result;
        if (targetCompanyId) {
            result = await (0, db_1.query)(`SELECT * FROM hrms.whatsapp_integrations WHERE company_id = $1`, [targetCompanyId]);
        }
        else {
            result = await (0, db_1.query)(`SELECT * FROM hrms.whatsapp_integrations ORDER BY updated_at DESC LIMIT 1`);
        }
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        }
        else {
            res.json(null);
        }
    }
    catch (err) {
        console.error('Error fetching whatsapp integrations:', err);
        res.status(500).json({ error: 'Failed to fetch whatsapp integrations' });
    }
});
/**
 * @route   POST /api/recruitment/settings/whatsapp
 * @desc    Upsert whatsapp integration
 * @access  Private
 */
router.post('/settings/whatsapp', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { email } = req.user;
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.body.company_id)
            targetCompanyId = req.body.company_id;
        const { provider, api_url, api_key_encrypted, access_token_encrypted, phone_number_id, business_account_id, is_active } = req.body;
        const result = await (0, db_1.query)(`INSERT INTO hrms.whatsapp_integrations 
        (company_id, provider, api_url, api_key_encrypted, access_token_encrypted, phone_number_id, business_account_id, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (company_id) 
       DO UPDATE SET 
         provider = EXCLUDED.provider, 
         api_url = EXCLUDED.api_url, 
         api_key_encrypted = EXCLUDED.api_key_encrypted, 
         access_token_encrypted = EXCLUDED.access_token_encrypted, 
         phone_number_id = EXCLUDED.phone_number_id, 
         business_account_id = EXCLUDED.business_account_id, 
         is_active = EXCLUDED.is_active, 
         updated_at = NOW()
       RETURNING *`, [targetCompanyId, provider || 'WHATSAPP', api_url, api_key_encrypted, access_token_encrypted, phone_number_id, business_account_id, is_active]);
        (0, server_1.enqueueActivityLog)(targetCompanyId || null, email || '', 'INTEGRATION_UPDATED', 'recruitment', `Updated WhatsApp integration`, req.ip || '', req.headers['user-agent'] || '');
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error updating whatsapp integration:', err);
        res.status(500).json({ error: 'Failed to update whatsapp integration' });
    }
});
/**
 * @route   DELETE /api/recruitment/settings/email
 * @desc    Delete email integration
 * @access  Private
 */
router.delete('/settings/email', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { email } = req.user;
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.query.company_id)
            targetCompanyId = req.query.company_id;
        await (0, db_1.query)(`DELETE FROM hrms.email_integrations WHERE company_id = $1`, [targetCompanyId]);
        (0, server_1.enqueueActivityLog)(targetCompanyId || null, email || '', 'INTEGRATION_DELETED', 'recruitment', `Deleted Email Integration`, req.ip || '', req.headers['user-agent'] || '');
        res.json({ message: 'Deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete email integration' });
    }
});
/**
 * @route   DELETE /api/recruitment/settings/whatsapp
 * @desc    Delete whatsapp integration
 * @access  Private
 */
router.delete('/settings/whatsapp', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { email } = req.user;
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.query.company_id)
            targetCompanyId = req.query.company_id;
        await (0, db_1.query)(`DELETE FROM hrms.whatsapp_integrations WHERE company_id = $1`, [targetCompanyId]);
        (0, server_1.enqueueActivityLog)(targetCompanyId || null, email || '', 'INTEGRATION_DELETED', 'recruitment', `Deleted WhatsApp Integration`, req.ip || '', req.headers['user-agent'] || '');
        res.json({ message: 'Deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete whatsapp integration' });
    }
});
/**
 * @route   GET /api/recruitment/settings/whatsapp-campaigns
 * @desc    Get whatsapp campaigns
 * @access  Private
 */
router.get('/settings/whatsapp-campaigns', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.query.company_id)
            targetCompanyId = req.query.company_id;
        let result;
        if (targetCompanyId) {
            result = await (0, db_1.query)(`SELECT * FROM hrms.whatsapp_campaigns WHERE company_id = $1 ORDER BY created_at DESC`, [targetCompanyId]);
        }
        else {
            result = await (0, db_1.query)(`SELECT * FROM hrms.whatsapp_campaigns ORDER BY created_at DESC`);
        }
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});
/**
 * @route   POST /api/recruitment/settings/whatsapp-campaigns
 * @desc    Create whatsapp campaign
 * @access  Private
 */
router.post('/settings/whatsapp-campaigns', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.body.company_id)
            targetCompanyId = req.body.company_id;
        const { campaign_name, campaign_code, template_name, parameters, status } = req.body;
        const result = await (0, db_1.query)(`INSERT INTO hrms.whatsapp_campaigns (company_id, campaign_name, campaign_code, template_name, parameters, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [targetCompanyId, campaign_name, campaign_code, template_name, JSON.stringify(parameters || {}), status || 'ACTIVE']);
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});
/**
 * @route   PUT /api/recruitment/settings/whatsapp-campaigns/:id
 * @desc    Update whatsapp campaign
 * @access  Private
 */
router.put('/settings/whatsapp-campaigns/:id', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { id } = req.params;
        const { campaign_name, campaign_code, template_name, parameters, status } = req.body;
        const result = await (0, db_1.query)(`UPDATE hrms.whatsapp_campaigns 
       SET campaign_name = $1, campaign_code = $2, template_name = $3, parameters = $4, status = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`, [campaign_name, campaign_code, template_name, JSON.stringify(parameters || {}), status || 'ACTIVE', id]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update campaign' });
    }
});
/**
 * @route   DELETE /api/recruitment/settings/whatsapp-campaigns/:id
 * @desc    Delete whatsapp campaign
 * @access  Private
 */
router.delete('/settings/whatsapp-campaigns/:id', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { id } = req.params;
        await (0, db_1.query)(`DELETE FROM hrms.whatsapp_campaigns WHERE id = $1`, [id]);
        res.json({ message: 'Deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
});
/**
 * @route   GET /api/recruitment/settings/notification-rules
 * @desc    Get notification rules
 * @access  Private
 */
router.get('/settings/notification-rules', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.query.company_id)
            targetCompanyId = req.query.company_id;
        let result;
        if (targetCompanyId) {
            result = await (0, db_1.query)(`SELECT * FROM hrms.notification_configurations WHERE company_id = $1 ORDER BY created_at DESC`, [targetCompanyId]);
        }
        else {
            result = await (0, db_1.query)(`SELECT * FROM hrms.notification_configurations ORDER BY created_at DESC`);
        }
        res.json(result.rows);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch notification rules' });
    }
});
/**
 * @route   POST /api/recruitment/settings/notification-rules
 * @desc    Create notification rule
 * @access  Private
 */
router.post('/settings/notification-rules', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.body.company_id)
            targetCompanyId = req.body.company_id;
        const { module, event_code, email_enabled, whatsapp_enabled, email_integration_id, whatsapp_campaign_id } = req.body;
        const result = await (0, db_1.query)(`INSERT INTO hrms.notification_configurations 
      (company_id, module, event_code, email_enabled, whatsapp_enabled, email_integration_id, whatsapp_campaign_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [targetCompanyId, module, event_code, email_enabled, whatsapp_enabled, email_integration_id || null, whatsapp_campaign_id || null]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create rule' });
    }
});
/**
 * @route   PUT /api/recruitment/settings/notification-rules/:id
 * @desc    Update notification rule
 * @access  Private
 */
router.put('/settings/notification-rules/:id', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { id } = req.params;
        const { module, event_code, email_enabled, whatsapp_enabled, email_integration_id, whatsapp_campaign_id } = req.body;
        const result = await (0, db_1.query)(`UPDATE hrms.notification_configurations SET 
       module = $1, event_code = $2, email_enabled = $3, whatsapp_enabled = $4, email_integration_id = $5, whatsapp_campaign_id = $6, updated_at = NOW() 
       WHERE id = $7 RETURNING *`, [module, event_code, email_enabled, whatsapp_enabled, email_integration_id || null, whatsapp_campaign_id || null, id]);
        res.json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update rule' });
    }
});
/**
 * @route   DELETE /api/recruitment/settings/notification-rules/:id
 * @desc    Delete notification rule
 * @access  Private
 */
router.delete('/settings/notification-rules/:id', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { id } = req.params;
        await (0, db_1.query)(`DELETE FROM hrms.notification_configurations WHERE id = $1`, [id]);
        res.json({ message: 'Deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete rule' });
    }
});
// =========================================================
// INTERVIEW TRACKING APIs
// =========================================================
/**
 * @route   GET /api/v1/recruitment/jobs/:id/rounds
 * @desc    Get interview rounds for a specific job
 * @access  Private
 */
router.get('/jobs/:id/rounds', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await (0, db_1.query)(`SELECT * FROM hrms.job_interview_rounds WHERE job_posting_id = $1 ORDER BY round_order ASC`, [id]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch rounds' });
    }
});
/**
 * @route   POST /api/v1/recruitment/jobs/:id/rounds
 * @desc    Create a new interview round for a specific job
 * @access  Private
 */
router.post('/jobs/:id/rounds', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { id } = req.params; // job_posting_id
        const { round_name, round_type } = req.body;
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.body.company_id)
            targetCompanyId = req.body.company_id;
        // Get max round_order
        const maxOrderRes = await (0, db_1.query)(`SELECT MAX(round_order) as max_order FROM hrms.job_interview_rounds WHERE job_posting_id = $1`, [id]);
        const nextOrder = (maxOrderRes.rows[0].max_order || 0) + 1;
        const result = await (0, db_1.query)(`INSERT INTO hrms.job_interview_rounds 
      (company_id, job_posting_id, round_name, round_type, round_order) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *`, [targetCompanyId, id, round_name || 'New Round', round_type || 'Technical', nextOrder]);
        return res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to create round' });
    }
});
/**
 * @route   GET /api/v1/recruitment/applications/:id/interviews
 * @desc    Get scheduled interviews and feedback for an application
 * @access  Private
 */
router.get('/applications/:id/interviews', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await (0, db_1.query)(`SELECT s.*, r.round_name, r.round_type,
              f.technical_rating, f.communication_rating, f.problem_solving_rating, f.overall_rating, f.recommendation, f.feedback, f.submitted_at,
              e.first_name as interviewer_first_name, e.last_name as interviewer_last_name, e.email as interviewer_email
       FROM hrms.interview_schedules s
       JOIN hrms.job_interview_rounds r ON s.job_interview_round_id = r.id
       LEFT JOIN hrms.interview_feedback f ON f.interview_schedule_id = s.id
       LEFT JOIN hrms.employees e ON s.interviewer_id = e.id
       WHERE s.application_id = $1
       ORDER BY s.created_at ASC`, [id]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch interviews' });
    }
});
/**
 * @route   POST /api/v1/recruitment/applications/:id/interviews
 * @desc    Schedule an interview
 * @access  Private
 */
router.post('/applications/:id/interviews', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { id } = req.params; // application_id
        const { round_id, mode, date, interviewer_id } = req.body;
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.body.company_id)
            targetCompanyId = req.body.company_id;
        const result = await (0, db_1.query)(`INSERT INTO hrms.interview_schedules 
      (company_id, application_id, job_interview_round_id, interview_mode, scheduled_start_time, scheduled_end_time, status, interviewer_id) 
      VALUES ($1, $2, $3, $4, $5, $6, 'SCHEDULED', $7) RETURNING *`, [targetCompanyId, id, round_id, mode, date, date, interviewer_id || null]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to schedule interview' });
    }
});
/**
 * @route   POST /api/v1/recruitment/interviews/:id/feedback
 * @desc    Submit feedback for an interview
 * @access  Private
 */
router.post('/interviews/:id/feedback', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { id } = req.params; // interview_schedule_id
        const { technical, communication, problem_solving, overall, recommendation, notes } = req.body;
        // Get employee ID from email, fallback to schedule interviewer_id
        let employeeId = null;
        if (req.user?.email) {
            const employeeRes = await (0, db_1.query)(`SELECT id FROM hrms.employees WHERE email = $1`, [req.user.email]);
            if (employeeRes.rows.length > 0) {
                employeeId = employeeRes.rows[0].id;
            }
        }
        if (!employeeId) {
            const scheduleRes = await (0, db_1.query)(`SELECT interviewer_id FROM hrms.interview_schedules WHERE id = $1`, [id]);
            if (scheduleRes.rows.length > 0 && scheduleRes.rows[0].interviewer_id) {
                employeeId = scheduleRes.rows[0].interviewer_id;
            }
        }
        const techVal = Math.min(5, Math.max(1, Math.round(Number(technical) || 3)));
        const commVal = Math.min(5, Math.max(1, Math.round(Number(communication) || 3)));
        const psVal = (problem_solving && Number(problem_solving) >= 1) ? Math.min(5, Math.max(1, Math.round(Number(problem_solving)))) : null;
        const overallVal = Math.min(5, Math.max(1, Math.round(Number(overall) || (techVal + commVal) / 2)));
        // Check if feedback already exists
        const existing = await (0, db_1.query)(`SELECT id FROM hrms.interview_feedback WHERE interview_schedule_id = $1 AND interviewer_id = $2`, [id, employeeId]);
        if (existing.rows.length > 0) {
            await (0, db_1.query)(`UPDATE hrms.interview_feedback 
         SET technical_rating = $1, communication_rating = $2, problem_solving_rating = $3, overall_rating = $4, recommendation = $5, feedback = $6, submitted_at = NOW()
         WHERE id = $7`, [techVal, commVal, psVal, overallVal, recommendation, notes, existing.rows[0].id]);
        }
        else {
            await (0, db_1.query)(`INSERT INTO hrms.interview_feedback 
        (interview_schedule_id, interviewer_id, technical_rating, communication_rating, problem_solving_rating, overall_rating, recommendation, feedback, submitted_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`, [id, employeeId, techVal, commVal, psVal, overallVal, recommendation, notes]);
        }
        // Mark schedule as COMPLETED
        await (0, db_1.query)(`UPDATE hrms.interview_schedules SET status = 'COMPLETED' WHERE id = $1`, [id]);
        return res.json({ success: true });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to save feedback' });
    }
});
/**
 * @route   GET /api/v1/recruitment/jobs/:id/rounds
 * @desc    Get interview rounds for a job
 * @access  Private
 */
router.get('/jobs/:id/rounds', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await (0, db_1.query)(`SELECT * FROM hrms.job_interview_rounds WHERE job_posting_id = $1 ORDER BY round_order ASC`, [id]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch rounds' });
    }
});
/**
 * @route   POST /api/v1/recruitment/jobs/:id/rounds
 * @desc    Create an interview round
 * @access  Private
 */
router.post('/jobs/:id/rounds', (0, auth_1.requirePermission)('recruitment:write'), async (req, res) => {
    try {
        const { id } = req.params;
        const { round_name, round_type, company_id } = req.body;
        let targetCompanyId = req.user.companyId || company_id;
        // Get max round order
        const maxOrderRes = await (0, db_1.query)(`SELECT MAX(round_order) as max_order FROM hrms.job_interview_rounds WHERE job_posting_id = $1`, [id]);
        const nextOrder = (maxOrderRes.rows[0].max_order || 0) + 1;
        const result = await (0, db_1.query)(`INSERT INTO hrms.job_interview_rounds (company_id, job_posting_id, round_name, round_type, round_order) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [targetCompanyId, id, round_name, round_type || 'General', nextOrder]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create round' });
    }
});
/**
 * @route   GET /api/v1/recruitment/applications/:id/documents
 * @desc    Get documents for an application (like resume)
 * @access  Private
 */
router.get('/applications/:id/documents', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await (0, db_1.query)(`SELECT * FROM hrms.candidate_documents WHERE application_id = $1`, [id]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});
/**
 * @route   GET /api/v1/recruitment/employees
 * @desc    Get all employees for assigning interviews
 * @access  Private
 */
router.get('/employees', (0, auth_1.requirePermission)('recruitment:read'), async (req, res) => {
    try {
        let targetCompanyId = req.user.companyId;
        const isSuper = req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin');
        if (isSuper && req.query.company_id) {
            targetCompanyId = req.query.company_id;
        }
        let result;
        if (targetCompanyId) {
            result = await (0, db_1.query)(`SELECT e.id, e.first_name, e.last_name, e.email, d.name as designation 
         FROM hrms.employees e 
         LEFT JOIN hrms.designations d ON e.designation_id = d.id 
         WHERE e.company_id = $1 
         ORDER BY e.first_name ASC`, [targetCompanyId]);
        }
        else {
            result = await (0, db_1.query)(`SELECT e.id, e.first_name, e.last_name, e.email, d.name as designation 
         FROM hrms.employees e 
         LEFT JOIN hrms.designations d ON e.designation_id = d.id 
         ORDER BY e.first_name ASC`);
        }
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching recruitment employees:', err);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
});
exports.default = router;
