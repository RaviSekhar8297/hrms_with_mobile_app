// ============================================================================
// WORKBRIDGE: TASK MANAGEMENT MODULE - START
// ============================================================================

import { Router, Response } from 'express';
import { query } from '../config/db';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();

// Apply Authentication Middleware to all WorkBridge routes
router.use(authenticateToken as any);

// ----------------------------------------------------------------------------
// 1. PROJECTS API
// ----------------------------------------------------------------------------

// Helper to ensure hrms.project_members table exists
const ensureProjectMembersTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS hrms.project_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID,
        project_id UUID NOT NULL REFERENCES hrms.projects(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'MEMBER',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_project_member UNIQUE (project_id, employee_id)
      )
    `);
  } catch (e) {
    console.error('Error ensuring project_members table:', e);
  }
};
ensureProjectMembersTable();

const ensureProjectMilestoneColumn = async () => {
  try {
    await query(`ALTER TABLE hrms.projects ADD COLUMN IF NOT EXISTS milestone VARCHAR(255);`);
  } catch (e) {
    console.error('Error ensuring milestone column on hrms.projects:', e);
  }
};
ensureProjectMilestoneColumn();

// GET /api/v1/workbridge/projects - Fetch Projects List
router.get('/projects', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.query.company_id as string || req.user?.companyId;
    let sql = `
      SELECT p.*, 
             c.name as company_name,
             CONCAT(m.first_name, ' ', m.last_name) as manager_name,
             (SELECT COUNT(*) FROM hrms.project_tasks t WHERE t.project_id = p.id AND t.is_active = true) as total_tasks,
             (SELECT COUNT(*) FROM hrms.project_tasks t WHERE t.project_id = p.id AND t.is_active = true AND t.status = 'COMPLETED') as completed_tasks,
             COALESCE((
               SELECT json_agg(json_build_object(
                 'id', e.id,
                 'first_name', e.first_name,
                 'last_name', e.last_name,
                 'email', e.email,
                 'emp_id_code', e.emp_id_code,
                 'role', pm.role
               ))
               FROM hrms.project_members pm
               JOIN hrms.employees e ON pm.employee_id = e.id
               WHERE pm.project_id = p.id
             ), '[]'::json) as members
      FROM hrms.projects p
      LEFT JOIN hrms.companies c ON p.company_id = c.id
      LEFT JOIN hrms.employees m ON p.project_manager_id = m.id
      WHERE p.is_active = true
    `;
    const params: any[] = [];

    if (companyId && companyId !== 'all') {
      params.push(companyId);
      sql += ` AND p.company_id = $${params.length}`;
    }

    sql += ` ORDER BY p.created_at DESC`;
    const result = await query(sql, params);

    res.json({ success: true, projects: result.rows });
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch projects' });
  }
});

// GET /api/v1/workbridge/projects/:id - Fetch Single Project Detail
router.get('/projects/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT p.*, 
             c.name as company_name,
             CONCAT(m.first_name, ' ', m.last_name) as manager_name,
             (SELECT COUNT(*) FROM hrms.project_tasks t WHERE t.project_id = p.id AND t.is_active = true) as total_tasks,
             (SELECT COUNT(*) FROM hrms.project_tasks t WHERE t.project_id = p.id AND t.is_active = true AND t.status = 'COMPLETED') as completed_tasks,
             COALESCE((
               SELECT json_agg(json_build_object(
                 'id', e.id,
                 'first_name', e.first_name,
                 'last_name', e.last_name,
                 'email', e.email,
                 'emp_id_code', e.emp_id_code,
                 'role', pm.role
               ))
               FROM hrms.project_members pm
               JOIN hrms.employees e ON pm.employee_id = e.id
               WHERE pm.project_id = p.id
             ), '[]'::json) as members
      FROM hrms.projects p
      LEFT JOIN hrms.companies c ON p.company_id = c.id
      LEFT JOIN hrms.employees m ON p.project_manager_id = m.id
      WHERE p.id = $1 AND p.is_active = true
    `;
    const result = await query(sql, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ success: true, project: result.rows[0] });
  } catch (error: any) {
    console.error('Error fetching project detail:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch project detail' });
  }
});

// GET /api/v1/workbridge/projects/:id/members - Fetch Project Members
router.get('/projects/:id/members', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT pm.*, e.first_name, e.last_name, e.email, e.emp_id_code
      FROM hrms.project_members pm
      JOIN hrms.employees e ON pm.employee_id = e.id
      WHERE pm.project_id = $1
      ORDER BY pm.created_at ASC
    `;
    const result = await query(sql, [id]);
    res.json({ success: true, members: result.rows });
  } catch (error: any) {
    console.error('Error fetching project members:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch project members' });
  }
});

// POST /api/v1/workbridge/projects/:id/members - Add Member to Project
router.post('/projects/:id/members', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { employee_id, role } = req.body;
    if (!employee_id) {
      res.status(400).json({ error: 'Employee ID is required' });
      return;
    }

    const projRes = await query(`SELECT company_id FROM hrms.projects WHERE id = $1`, [id]);
    if (projRes.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const cid = projRes.rows[0].company_id;

    const sql = `
      INSERT INTO hrms.project_members (company_id, project_id, employee_id, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (project_id, employee_id) DO UPDATE SET role = EXCLUDED.role
      RETURNING *
    `;
    const result = await query(sql, [cid, id, employee_id, role || 'MEMBER']);
    res.status(201).json({ success: true, member: result.rows[0] });
  } catch (error: any) {
    console.error('Error adding project member:', error);
    res.status(500).json({ error: error.message || 'Failed to add project member' });
  }
});

// DELETE /api/v1/workbridge/projects/:id/members/:employeeId - Remove Member from Project
router.delete('/projects/:id/members/:employeeId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, employeeId } = req.params;
    const sql = `DELETE FROM hrms.project_members WHERE project_id = $1 AND employee_id = $2 RETURNING *`;
    const result = await query(sql, [id, employeeId]);
    res.json({ success: true, removed: result.rows[0] });
  } catch (error: any) {
    console.error('Error removing project member:', error);
    res.status(500).json({ error: error.message || 'Failed to remove project member' });
  }
});

// POST /api/v1/workbridge/projects - Create Project
router.post('/projects', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { company_id, project_code, project_name, client_name, description, priority, project_manager_id, start_date, end_date, milestone } = req.body;
    const cid = company_id || req.user?.companyId;

    if (!cid || !project_code || !project_name) {
      res.status(400).json({ error: 'Company, Project Code, and Project Name are required' });
      return;
    }

    // Resolve creator employee ID
    const creatorEmail = req.user?.email || '';
    const empRes = await query(`SELECT id FROM hrms.employees WHERE LOWER(email) = LOWER($1) LIMIT 1`, [creatorEmail]);
    const creatorId = empRes.rows.length > 0 ? empRes.rows[0].id : null;

    const sql = `
      INSERT INTO hrms.projects 
        (company_id, project_code, project_name, client_name, description, priority, project_manager_id, start_date, end_date, created_by, milestone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await query(sql, [
      cid,
      project_code.trim().toUpperCase(),
      project_name.trim(),
      client_name || null,
      description || null,
      priority || 'MEDIUM',
      project_manager_id || null,
      start_date || null,
      end_date || null,
      creatorId,
      milestone || null
    ]);

    res.status(201).json({ success: true, project: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating project:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Project Code already exists for this company' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to create project' });
  }
});

// PUT /api/v1/workbridge/projects/:id - Update Project
router.put('/projects/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { project_name, client_name, description, priority, status, project_manager_id, start_date, end_date, milestone } = req.body;

    const sql = `
      UPDATE hrms.projects
      SET project_name = COALESCE($1, project_name),
          client_name = $2,
          description = $3,
          priority = COALESCE($4, priority),
          status = COALESCE($5, status),
          project_manager_id = $6,
          start_date = $7,
          end_date = $8,
          milestone = $9,
          updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `;
    const result = await query(sql, [
      project_name ? project_name.trim() : null,
      client_name !== undefined ? client_name : null,
      description !== undefined ? description : null,
      priority || null,
      status || null,
      project_manager_id || null,
      start_date || null,
      end_date || null,
      milestone !== undefined ? milestone : null,
      id
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ success: true, project: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: error.message || 'Failed to update project' });
  }
});

// DELETE /api/v1/workbridge/projects/:id - Soft Delete Project
router.delete('/projects/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const sql = `UPDATE hrms.projects SET is_active = false, archived_at = NOW() WHERE id = $1 RETURNING *`;
    const result = await query(sql, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ success: true, message: 'Project archived successfully' });
  } catch (error: any) {
    console.error('Error archiving project:', error);
    res.status(500).json({ error: error.message || 'Failed to archive project' });
  }
});

// ----------------------------------------------------------------------------
// 2. MILESTONES API
// ----------------------------------------------------------------------------

// GET /api/v1/workbridge/milestones - Fetch Milestones
router.get('/milestones', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { company_id, project_id } = req.query;
    let sql = `
      SELECT m.*, m.milestone_name as title, p.project_name, p.project_code
      FROM hrms.project_milestones m
      JOIN hrms.projects p ON m.project_id = p.id
      WHERE p.is_active = true
    `;
    const params: any[] = [];

    if (project_id) {
      params.push(project_id);
      sql += ` AND m.project_id = $${params.length}`;
    } else if (company_id && company_id !== 'all') {
      params.push(company_id);
      sql += ` AND m.company_id = $${params.length}`;
    }

    sql += ` ORDER BY m.due_date ASC NULLS LAST`;
    const result = await query(sql, params);
    res.json({ success: true, milestones: result.rows });
  } catch (error: any) {
    console.error('Error fetching milestones:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch milestones' });
  }
});

// POST /api/v1/workbridge/milestones - Create Milestone
router.post('/milestones', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { company_id, project_id, title, description, target_date, is_completed } = req.body;
    const cid = company_id || req.user?.companyId;

    if (!cid || !project_id || !title) {
      res.status(400).json({ error: 'Company, Project, and Title are required' });
      return;
    }

    const sql = `
      INSERT INTO hrms.project_milestones (company_id, project_id, milestone_name, description, due_date, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *, milestone_name as title
    `;
    const result = await query(sql, [
      cid,
      project_id,
      title.trim(),
      description || null,
      target_date || null,
      is_completed ? 'COMPLETED' : 'IN_PROGRESS'
    ]);
    res.status(201).json({ success: true, milestone: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating milestone:', error);
    res.status(500).json({ error: error.message || 'Failed to create milestone' });
  }
});

// PUT /api/v1/workbridge/milestones/:id - Update Milestone
router.put('/milestones/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, target_date, is_completed } = req.body;

    const sql = `
      UPDATE hrms.project_milestones
      SET milestone_name = COALESCE($1, milestone_name),
          description = $2,
          due_date = $3,
          status = COALESCE($4, status),
          updated_at = NOW()
      WHERE id = $5
      RETURNING *, milestone_name as title
    `;
    const result = await query(sql, [
      title ? title.trim() : null,
      description !== undefined ? description : null,
      target_date || null,
      is_completed !== undefined ? (is_completed ? 'COMPLETED' : 'IN_PROGRESS') : null,
      id
    ]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }
    res.json({ success: true, milestone: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating milestone:', error);
    res.status(500).json({ error: error.message || 'Failed to update milestone' });
  }
});

// DELETE /api/v1/workbridge/milestones/:id - Delete Milestone
router.delete('/milestones/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(`DELETE FROM hrms.project_milestones WHERE id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }
    res.json({ success: true, message: 'Milestone deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting milestone:', error);
    res.status(500).json({ error: error.message || 'Failed to delete milestone' });
  }
});

// ----------------------------------------------------------------------------
// 3. DEPARTMENT / COMPANY WORKFLOWS API
// ----------------------------------------------------------------------------

router.get('/workflows', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { company_id, department_id } = req.query;
    const cid = company_id || req.user?.companyId;

    let sql = `
      SELECT w.*, d.name as department_name
      FROM hrms.department_workflows w
      LEFT JOIN hrms.departments d ON w.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (cid && cid !== 'all') {
      params.push(cid);
      sql += ` AND w.company_id = $${params.length}`;
    }
    if (department_id && department_id !== 'ALL') {
      params.push(department_id);
      sql += ` AND w.department_id = $${params.length}`;
    }

    sql += ` ORDER BY w.sort_order ASC`;
    const result = await query(sql, params);

    res.json({ success: true, workflows: result.rows });
  } catch (error: any) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch workflows' });
  }
});

router.post('/workflows', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { company_id, department_id, stages } = req.body;
    const cid = company_id || req.user?.companyId;

    if (!cid || !Array.isArray(stages)) {
      res.status(400).json({ error: 'Company and Stages array are required' });
      return;
    }

    const deptId = department_id || null;

    // Clear old workflows
    if (deptId) {
      await query(`DELETE FROM hrms.department_workflows WHERE company_id = $1 AND department_id = $2`, [cid, deptId]);
    } else {
      await query(`DELETE FROM hrms.department_workflows WHERE company_id = $1 AND department_id IS NULL`, [cid]);
    }

    for (let idx = 0; idx < stages.length; idx++) {
      const s = stages[idx];
      const statusKey = s.id || `STAGE_${s.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      const stageDeptId = s.department_id || deptId || null;
      await query(
        `INSERT INTO hrms.department_workflows (company_id, department_id, status_key, status_label, status_color, sort_order, is_initial, is_final)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [cid, stageDeptId, statusKey, s.name, s.color_code || '#3b82f6', idx + 1, s.is_initial || false, s.is_final || false]
      );
    }

    res.json({ success: true, message: 'Workflow pipeline configured successfully' });
  } catch (error: any) {
    console.error('Error configuring workflows:', error);
    res.status(500).json({ error: error.message || 'Failed to configure workflows' });
  }
});

// ----------------------------------------------------------------------------
// 4. TASKS API (`hrms.project_tasks`)
// ----------------------------------------------------------------------------

router.get('/tasks', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { company_id, project_id, milestone_id, status, priority, search } = req.query;
    const cid = company_id || req.user?.companyId;

    let sql = `
      SELECT t.*, t.task_name as title,
             p.project_name, p.project_code,
             m.milestone_name as milestone_title,
             t.assigned_to,
             CONCAT(e.first_name, ' ', e.last_name) as assignee_name,
             e.emp_id_code as assignee_code,
             COALESCE((
               SELECT SUM(duration_minutes) 
               FROM hrms.task_timer_logs 
               WHERE task_id = t.id AND is_running = false
             ), 0) as total_logged_minutes,
             COALESCE((
               SELECT json_agg(json_build_object(
                 'id', l.id,
                 'name', l.label_name,
                 'color_code', l.label_color
               ))
               FROM hrms.task_label_assignments tla
               JOIN hrms.task_labels l ON tla.label_id = l.id
               WHERE tla.task_id = t.id
             ), '[]'::json) as labels
      FROM hrms.project_tasks t
      LEFT JOIN hrms.projects p ON t.project_id = p.id
      LEFT JOIN hrms.project_milestones m ON t.milestone_id = m.id
      LEFT JOIN hrms.employees e ON t.assigned_to = e.id
      WHERE t.is_active = true
    `;
    const params: any[] = [];

    if (cid && cid !== 'all') {
      params.push(cid);
      sql += ` AND t.company_id = $${params.length}`;
    }
    if (project_id) {
      params.push(project_id);
      sql += ` AND t.project_id = $${params.length}`;
    }
    if (milestone_id) {
      params.push(milestone_id);
      sql += ` AND t.milestone_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND t.status = $${params.length}`;
    }
    if (priority) {
      params.push(priority);
      sql += ` AND t.priority = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (t.task_name ILIKE $${params.length} OR t.task_code ILIKE $${params.length})`;
    }

    sql += ` ORDER BY t.created_at DESC`;
    const result = await query(sql, params);

    res.json({ success: true, tasks: result.rows });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch tasks' });
  }
});

router.get('/tasks/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const taskSql = `
      SELECT t.*, t.task_name as title,
             p.project_name, p.project_code,
             m.milestone_name as milestone_title
      FROM hrms.project_tasks t
      LEFT JOIN hrms.projects p ON t.project_id = p.id
      LEFT JOIN hrms.project_milestones m ON t.milestone_id = m.id
      WHERE t.id = $1 AND t.is_active = true
    `;
    const taskRes = await query(taskSql, [id]);

    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const task = taskRes.rows[0];

    // Fetch Checklists
    const subtaskRes = await query(
      `SELECT c.*, c.item_name as item_text,
              CONCAT(e.first_name, ' ', e.last_name) as completed_by_name
       FROM hrms.task_checklists c
       LEFT JOIN hrms.employees e ON c.completed_by = e.id
       WHERE c.task_id = $1 
       ORDER BY c.sort_order ASC, c.created_at ASC`,
      [id]
    );

    // Fetch Comments
    const commentRes = await query(
      `SELECT c.*, c.comment as comment_text,
              CONCAT(e.first_name, ' ', e.last_name) as author_name,
              e.emp_id_code as author_code
       FROM hrms.task_comments c
       LEFT JOIN hrms.employees e ON c.employee_id = e.id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [id]
    );

    task.subtasks = subtaskRes.rows;
    task.comments = commentRes.rows;

    res.json({ success: true, task });
  } catch (error: any) {
    console.error('Error fetching task detail:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch task detail' });
  }
});

router.post('/tasks', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      company_id,
      project_id,
      milestone_id,
      task_code,
      title,
      description,
      priority,
      estimated_hours,
      start_date,
      due_date,
      due_datetime,
      assigned_to
    } = req.body;

    const cid = company_id || req.user?.companyId;
    if (!cid || !title) {
      res.status(400).json({ error: 'Company and Task Title are required' });
      return;
    }

    const generatedCode = task_code || `TSK-${Math.floor(1000 + Math.random() * 9000)}`;

    const creatorEmail = req.user?.email || '';
    const empRes = await query(`SELECT id FROM hrms.employees WHERE LOWER(email) = LOWER($1) LIMIT 1`, [creatorEmail]);
    const creatorId = empRes.rows.length > 0 ? empRes.rows[0].id : null;
    const finalAssigneeId = assigned_to || creatorId;

    const finalDueDatetime = due_datetime || (due_date ? `${due_date}T18:00:00Z` : null);
    const finalDueDate = due_date || (due_datetime ? due_datetime.split('T')[0] : null);
    const finalStartDate = start_date || new Date().toISOString().split('T')[0];

    const sql = `
      INSERT INTO hrms.project_tasks
        (company_id, project_id, milestone_id, task_code, task_name, description, priority, estimated_minutes, start_date, due_date, due_datetime, created_by, assigned_to)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *, task_name as title
    `;
    const result = await query(sql, [
      cid,
      project_id || null,
      milestone_id || null,
      generatedCode.trim().toUpperCase(),
      title.trim(),
      description || null,
      priority || 'MEDIUM',
      Math.round((parseFloat(estimated_hours) || 0) * 60),
      finalStartDate,
      finalDueDate,
      finalDueDatetime,
      creatorId,
      finalAssigneeId
    ]);

    res.status(201).json({ success: true, task: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message || 'Failed to create task' });
  }
});

router.put('/tasks/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      milestone_id,
      title,
      description,
      priority,
      status,
      estimated_hours,
      start_date,
      due_date,
      due_datetime,
      assigned_to
    } = req.body;

    const finalDueDatetime = due_datetime || (due_date ? `${due_date}T18:00:00Z` : null);
    const finalDueDate = due_date || (due_datetime ? due_datetime.split('T')[0] : null);

    const sql = `
      UPDATE hrms.project_tasks
      SET milestone_id = $1,
          task_name = COALESCE($2, task_name),
          description = $3,
          priority = COALESCE($4, priority),
          status = COALESCE($5, status),
          estimated_minutes = COALESCE($6, estimated_minutes),
          start_date = COALESCE($7, start_date),
          due_date = COALESCE($8, due_date),
          due_datetime = COALESCE($9, due_datetime),
          assigned_to = COALESCE($10, assigned_to),
          updated_at = NOW()
      WHERE id = $11
      RETURNING *, task_name as title
    `;
    const result = await query(sql, [
      milestone_id || null,
      title ? title.trim() : null,
      description !== undefined ? description : null,
      priority || null,
      status || null,
      estimated_hours !== undefined ? Math.round((parseFloat(estimated_hours) || 0) * 60) : null,
      start_date || null,
      finalDueDate,
      finalDueDatetime,
      assigned_to || null,
      id
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json({ success: true, task: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message || 'Failed to update task' });
  }
});

router.delete('/tasks/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(`UPDATE hrms.project_tasks SET is_active = false WHERE id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message || 'Failed to delete task' });
  }
});

// ----------------------------------------------------------------------------
// 5. TASK CHECKLISTS & COMMENTS
// ----------------------------------------------------------------------------

router.post('/tasks/:id/checklists', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { item_text } = req.body;
    if (!item_text) {
      res.status(400).json({ error: 'Checklist item text is required' });
      return;
    }

    const taskRes = await query(`SELECT company_id FROM hrms.project_tasks WHERE id = $1`, [id]);
    const cid = taskRes.rows[0]?.company_id;

    const sql = `INSERT INTO hrms.task_checklists (company_id, task_id, item_name) VALUES ($1, $2, $3) RETURNING *, item_name as item_text`;
    const result = await query(sql, [cid, id, item_text.trim()]);
    res.status(201).json({ success: true, checklist: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/tasks/:id/checklists/:subtaskId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { subtaskId } = req.params;
    const { is_completed, item_text } = req.body;

    const creatorEmail = req.user?.email || '';
    const empRes = await query(`SELECT id FROM hrms.employees WHERE LOWER(email) = LOWER($1) LIMIT 1`, [creatorEmail]);
    const empId = empRes.rows[0]?.id || null;

    let sql = '';
    let params: any[] = [];

    if (is_completed !== undefined) {
      if (is_completed) {
        sql = `
          UPDATE hrms.task_checklists
          SET is_completed = true,
              completed_by = $1,
              completed_at = NOW(),
              item_name = COALESCE($2, item_name)
          WHERE id = $3
          RETURNING *, item_name as item_text
        `;
        params = [empId, item_text ? item_text.trim() : null, subtaskId];
      } else {
        sql = `
          UPDATE hrms.task_checklists
          SET is_completed = false,
              completed_by = NULL,
              completed_at = NULL,
              item_name = COALESCE($1, item_name)
          WHERE id = $2
          RETURNING *, item_name as item_text
        `;
        params = [item_text ? item_text.trim() : null, subtaskId];
      }
    } else {
      sql = `
        UPDATE hrms.task_checklists
        SET item_name = COALESCE($1, item_name)
        WHERE id = $2
        RETURNING *, item_name as item_text
      `;
      params = [item_text ? item_text.trim() : null, subtaskId];
    }

    const result = await query(sql, params);
    res.json({ success: true, checklist: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/tasks/:id/checklists/:subtaskId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { subtaskId } = req.params;
    await query(`DELETE FROM hrms.task_checklists WHERE id = $1`, [subtaskId]);
    res.json({ success: true, message: 'Checklist item deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tasks/:id/comments', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { comment_text } = req.body;
    if (!comment_text) {
      res.status(400).json({ error: 'Comment text is required' });
      return;
    }

    const creatorEmail = req.user?.email || '';
    const empRes = await query(`SELECT id, company_id FROM hrms.employees WHERE LOWER(email) = LOWER($1) LIMIT 1`, [creatorEmail]);
    const creatorId = empRes.rows.length > 0 ? empRes.rows[0].id : null;
    const cid = empRes.rows.length > 0 ? empRes.rows[0].company_id : null;

    const sql = `INSERT INTO hrms.task_comments (company_id, task_id, employee_id, comment) VALUES ($1, $2, $3, $4) RETURNING *, comment as comment_text`;
    const result = await query(sql, [cid, id, creatorId, comment_text.trim()]);
    res.status(201).json({ success: true, comment: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 6. LIVE TIMER API
// ----------------------------------------------------------------------------

router.post('/timer/start', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { task_id } = req.body;
    if (!task_id) {
      res.status(400).json({ error: 'Task ID required to start timer' });
      return;
    }

    const creatorEmail = req.user?.email || '';
    const empRes = await query(`SELECT id, company_id FROM hrms.employees WHERE LOWER(email) = LOWER($1) LIMIT 1`, [creatorEmail]);
    if (empRes.rows.length === 0) {
      res.status(400).json({ error: 'Employee record not found' });
      return;
    }
    const emp = empRes.rows[0];

    const activeRes = await query(
      `SELECT id FROM hrms.task_timer_logs WHERE employee_id = $1 AND is_running = true LIMIT 1`,
      [emp.id]
    );
    if (activeRes.rows.length > 0) {
      res.status(400).json({ error: 'You already have an active timer running' });
      return;
    }

    const ins = await query(
      `INSERT INTO hrms.task_timer_logs (company_id, task_id, employee_id, start_time, is_running) VALUES ($1, $2, $3, NOW(), true) RETURNING *`,
      [emp.company_id, task_id, emp.id]
    );

    res.status(201).json({ success: true, active_timer: ins.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/timer/stop', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const creatorEmail = req.user?.email || '';
    const empRes = await query(`SELECT id, company_id FROM hrms.employees WHERE LOWER(email) = LOWER($1) LIMIT 1`, [creatorEmail]);
    if (empRes.rows.length === 0) {
      res.status(400).json({ error: 'Employee record not found' });
      return;
    }
    const emp = empRes.rows[0];

    const timerRes = await query(`SELECT * FROM hrms.task_timer_logs WHERE employee_id = $1 AND is_running = true ORDER BY start_time DESC LIMIT 1`, [emp.id]);
    if (timerRes.rows.length === 0) {
      res.status(404).json({ error: 'No active timer found to stop' });
      return;
    }

    const timer = timerRes.rows[0];
    const startTime = new Date(timer.start_time).getTime();
    const durationMinutes = Math.max(1, Math.round((Date.now() - startTime) / (1000 * 60)));

    const updatedTimer = await query(
      `UPDATE hrms.task_timer_logs SET end_time = NOW(), duration_minutes = $1, is_running = false WHERE id = $2 RETURNING *`,
      [durationMinutes, timer.id]
    );

    // Sync timer log to weekly timesheet and entries
    await syncTimerLogsToTimesheets(emp.id);

    res.json({ success: true, message: 'Timer stopped!', timer: updatedTimer.rows[0], duration_minutes: durationMinutes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const syncTimerLogsToTimesheets = async (empId?: string) => {
  try {
    let timerQuery = `SELECT t.*, tk.project_id, tk.task_name FROM hrms.task_timer_logs t LEFT JOIN hrms.project_tasks tk ON t.task_id = tk.id WHERE t.is_running = false AND t.duration_minutes > 0`;
    const params: any[] = [];
    if (empId) {
      params.push(empId);
      timerQuery += ` AND t.employee_id = $1`;
    }
    const timerLogs = await query(timerQuery, params);

    for (const log of timerLogs.rows) {
      const logDate = new Date(log.start_time || log.created_at);
      const entryDateStr = logDate.toISOString().split('T')[0];

      const dayOfWeek = logDate.getDay();
      const diffToMon = logDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(logDate.setDate(diffToMon));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const startDateStr = monday.toISOString().split('T')[0];
      const endDateStr = sunday.toISOString().split('T')[0];

      const existingEntry = await query(
        `SELECT id FROM hrms.timesheet_entries WHERE employee_id = $1 AND task_id = $2 AND entry_date = $3 LIMIT 1`,
        [log.employee_id, log.task_id, entryDateStr]
      );

      let timesheetId: string;
      const tsRes = await query(
        `SELECT id FROM hrms.timesheets WHERE company_id = $1 AND employee_id = $2 AND week_start_date = $3 LIMIT 1`,
        [log.company_id, log.employee_id, startDateStr]
      );

      if (tsRes.rows.length === 0) {
        const insTs = await query(
          `INSERT INTO hrms.timesheets (company_id, employee_id, week_start_date, week_end_date, total_minutes, status)
           VALUES ($1, $2, $3, $4, $5, 'DRAFT') RETURNING id`,
          [log.company_id, log.employee_id, startDateStr, endDateStr, log.duration_minutes]
        );
        timesheetId = insTs.rows[0].id;
      } else {
        timesheetId = tsRes.rows[0].id;
      }

      if (existingEntry.rows.length === 0) {
        await query(
          `INSERT INTO hrms.timesheet_entries (company_id, timesheet_id, employee_id, project_id, task_id, entry_date, minutes, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            log.company_id,
            timesheetId,
            log.employee_id,
            log.project_id || null,
            log.task_id,
            entryDateStr,
            log.duration_minutes,
            `Timer log for ${log.task_name || 'task'}`
          ]
        );
      }

      // Recalculate total_minutes on timesheet
      await query(
        `UPDATE hrms.timesheets SET total_minutes = (
          SELECT COALESCE(SUM(minutes), 0) FROM hrms.timesheet_entries WHERE timesheet_id = $1
        ), updated_at = NOW() WHERE id = $1`,
        [timesheetId]
      );
    }
  } catch (err) {
    console.error('Error syncing timer logs to timesheets:', err);
  }
};

router.get('/timer/active', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const creatorEmail = req.user?.email || '';
    const empRes = await query(`SELECT id FROM hrms.employees WHERE LOWER(email) = LOWER($1) LIMIT 1`, [creatorEmail]);
    if (empRes.rows.length === 0) {
      res.json({ success: true, active_timer: null });
      return;
    }

    const timerRes = await query(
      `SELECT t.*, tk.task_name as task_title, tk.task_code
       FROM hrms.task_timer_logs t
       JOIN hrms.project_tasks tk ON t.task_id = tk.id
       WHERE t.employee_id = $1 AND t.is_running = true
       ORDER BY t.start_time DESC LIMIT 1`,
      [empRes.rows[0].id]
    );

    res.json({ success: true, active_timer: timerRes.rows.length > 0 ? timerRes.rows[0] : null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 7. TIMESHEETS API
// ----------------------------------------------------------------------------

router.get('/timesheets', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Auto-sync any completed timer logs to timesheets
    await syncTimerLogsToTimesheets();

    const { company_id, employee_id, status } = req.query;
    const cid = company_id || req.user?.companyId;

    let sql = `
      SELECT ts.*, ts.week_start_date as start_date, ts.week_end_date as end_date,
             CONCAT(e.first_name, ' ', e.last_name) as employee_name,
             e.email as employee_email
      FROM hrms.timesheets ts
      JOIN hrms.employees e ON ts.employee_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (cid && cid !== 'all') {
      params.push(cid);
      sql += ` AND ts.company_id = $${params.length}`;
    }
    if (employee_id && employee_id !== 'ALL') {
      params.push(employee_id);
      sql += ` AND ts.employee_id = $${params.length}`;
    }
    if (status && status !== 'ALL') {
      params.push(status);
      sql += ` AND ts.status = $${params.length}`;
    }

    sql += ` ORDER BY ts.week_start_date DESC`;
    const result = await query(sql, params);

    for (const ts of result.rows) {
      const entriesRes = await query(
        `SELECT te.*, te.minutes as duration_minutes, p.project_name, t.task_name as task_title, t.task_code
         FROM hrms.timesheet_entries te
         LEFT JOIN hrms.projects p ON te.project_id = p.id
         LEFT JOIN hrms.project_tasks t ON te.task_id = t.id
         WHERE te.timesheet_id = $1
         ORDER BY te.entry_date DESC`,
        [ts.id]
      );
      ts.entries = entriesRes.rows;
    }

    res.json({ success: true, timesheets: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/timesheets/entries', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { company_id, project_id, task_id, entry_date, duration_minutes, description } = req.body;
    const cid = company_id || req.user?.companyId;

    const creatorEmail = req.user?.email || '';
    const empRes = await query(`SELECT id FROM hrms.employees WHERE LOWER(email) = LOWER($1) LIMIT 1`, [creatorEmail]);
    if (empRes.rows.length === 0) {
      res.status(400).json({ error: 'Employee record not found' });
      return;
    }
    const empId = empRes.rows[0].id;

    const workDate = new Date(entry_date);
    const dayOfWeek = workDate.getDay();
    const diffToMon = workDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(workDate.setDate(diffToMon));
    const sunday = new Date(workDate.setDate(monday.getDate() + 6));

    const startDateStr = monday.toISOString().split('T')[0];
    const endDateStr = sunday.toISOString().split('T')[0];

    let tsRes = await query(
      `SELECT id FROM hrms.timesheets WHERE company_id = $1 AND employee_id = $2 AND week_start_date = $3 LIMIT 1`,
      [cid, empId, startDateStr]
    );

    let timesheetId: string;
    if (tsRes.rows.length === 0) {
      const insTs = await query(
        `INSERT INTO hrms.timesheets (company_id, employee_id, week_start_date, week_end_date, total_minutes, status)
         VALUES ($1, $2, $3, $4, $5, 'DRAFT') RETURNING id`,
        [cid, empId, startDateStr, endDateStr, duration_minutes]
      );
      timesheetId = insTs.rows[0].id;
    } else {
      timesheetId = tsRes.rows[0].id;
      await query(
        `UPDATE hrms.timesheets SET total_minutes = total_minutes + $1, updated_at = NOW() WHERE id = $2`,
        [duration_minutes, timesheetId]
      );
    }

    const insEntry = await query(
      `INSERT INTO hrms.timesheet_entries (company_id, timesheet_id, employee_id, project_id, task_id, entry_date, minutes, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [cid, timesheetId, empId, project_id, task_id || null, entry_date, duration_minutes, description || null]
    );

    res.status(201).json({ success: true, entry: insEntry.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/timesheets/:id/status', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ error: 'Invalid timesheet status' });
      return;
    }

    const result = await query(
      `UPDATE hrms.timesheets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    res.json({ success: true, timesheet: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 8. LABELS / TAGS API (`hrms.task_labels`)
// ----------------------------------------------------------------------------

router.get('/labels', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { company_id } = req.query;
    const cid = company_id || req.user?.companyId;

    let sql = `SELECT DISTINCT ON (LOWER(label_name)) *, label_name as name, label_color as color_code FROM hrms.task_labels WHERE 1=1`;
    const params: any[] = [];
    if (cid && cid !== 'all') {
      params.push(cid);
      sql += ` AND company_id = $${params.length}`;
    }
    sql += ` ORDER BY LOWER(label_name) ASC, created_at DESC`;

    const result = await query(sql, params);
    res.json({ success: true, labels: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/labels', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { company_id, name, color_code } = req.body;
    const cid = company_id || req.user?.companyId;

    if (!cid || !name) {
      res.status(400).json({ error: 'Company and Label Name are required' });
      return;
    }

    const sql = `INSERT INTO hrms.task_labels (company_id, label_name, label_color) VALUES ($1, $2, $3) RETURNING *, label_name as name, label_color as color_code`;
    const result = await query(sql, [cid, name.trim(), color_code || '#10b981']);
    res.status(201).json({ success: true, label: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/labels/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, color_code } = req.body;

    const sql = `UPDATE hrms.task_labels SET label_name = COALESCE($1, label_name), label_color = COALESCE($2, label_color) WHERE id = $3 RETURNING *, label_name as name, label_color as color_code`;
    const result = await query(sql, [name ? name.trim() : null, color_code || null, id]);
    res.json({ success: true, label: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/labels/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await query(`DELETE FROM hrms.task_labels WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Label deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 8B. TASK LABEL ASSIGNMENTS / MAPPINGS API (`hrms.task_label_assignments`)
// ----------------------------------------------------------------------------

// GET /api/v1/workbridge/tasks/:id/labels - Fetch labels mapped to a specific task
router.get('/tasks/:id/labels', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT tla.*, l.label_name as name, l.label_color as color_code, l.description
      FROM hrms.task_label_assignments tla
      JOIN hrms.task_labels l ON tla.label_id = l.id
      WHERE tla.task_id = $1
      ORDER BY l.label_name ASC
    `;
    const result = await query(sql, [id]);
    res.json({ success: true, labels: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/workbridge/tasks/:id/labels - Assign label(s) to a task
router.post('/tasks/:id/labels', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { label_id, label_ids } = req.body;
    const cid = req.user?.companyId;

    const idsToAssign = Array.isArray(label_ids) ? label_ids : (label_id ? [label_id] : []);
    if (idsToAssign.length === 0) {
      res.status(400).json({ error: 'At least one label_id is required' });
      return;
    }

    // Get company_id from task if not in req.user
    const taskRes = await query(`SELECT company_id FROM hrms.project_tasks WHERE id = $1`, [id]);
    const companyId = cid || taskRes.rows[0]?.company_id;

    for (const lid of idsToAssign) {
      await query(
        `INSERT INTO hrms.task_label_assignments (company_id, task_id, label_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (company_id, task_id, label_id) DO NOTHING`,
        [companyId, id, lid]
      );
    }

    res.status(201).json({ success: true, message: 'Labels assigned to task successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v1/workbridge/tasks/:id/labels/:labelId - Unassign a label from a task
router.delete('/tasks/:id/labels/:labelId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, labelId } = req.params;
    await query(`DELETE FROM hrms.task_label_assignments WHERE task_id = $1 AND label_id = $2`, [id, labelId]);
    res.json({ success: true, message: 'Label unassigned from task' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

// ============================================================================
// WORKBRIDGE: TASK MANAGEMENT MODULE - END
// ============================================================================
