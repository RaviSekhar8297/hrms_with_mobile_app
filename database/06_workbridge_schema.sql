-- ============================================================================
-- ENTERPRISE HRMS: WORKBRIDGE TASK, PROJECT & TIMESHEET SCHEMA
-- Schema: hrms
-- Compatible with: PostgreSQL 13+
-- Total Tables: 20 Tables (Idempotent & Safe Execution)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS hrms;
SET search_path TO hrms, public;

-- 0. EMPLOYEES COMPOSITE UNIQUE KEY (Safe Idempotent Block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_employees_company_id'
    ) THEN
        ALTER TABLE hrms.employees ADD CONSTRAINT uq_employees_company_id UNIQUE (company_id, id);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. PROJECTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.projects (
    id UUID DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    project_code VARCHAR(50) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    description TEXT,
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    project_manager_id UUID,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    archived_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, id),
    CONSTRAINT uq_projects_id UNIQUE (id),
    CONSTRAINT uq_project_code UNIQUE (company_id, project_code),
    CONSTRAINT chk_project_status CHECK (status IN ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT chk_project_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT chk_project_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
    CONSTRAINT fk_projects_manager FOREIGN KEY (company_id, project_manager_id) REFERENCES hrms.employees(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_projects_creator FOREIGN KEY (company_id, created_by) REFERENCES hrms.employees(company_id, id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 2. PROJECT MILESTONES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.project_milestones (
    id UUID DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    project_id UUID NOT NULL,
    milestone_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PLANNED',
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, id),
    CONSTRAINT uq_milestones_id UNIQUE (id),
    CONSTRAINT uq_milestone_comp_proj UNIQUE (company_id, project_id, id),
    CONSTRAINT chk_milestone_status CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED')),
    CONSTRAINT fk_milestone_project FOREIGN KEY (company_id, project_id) REFERENCES hrms.projects(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_milestone_creator FOREIGN KEY (company_id, created_by) REFERENCES hrms.employees(company_id, id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 3. DEPARTMENT / PROJECT WORKFLOW STATUSES TABLE (Dynamic Status Definitions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.department_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    department_id UUID REFERENCES hrms.departments(id) ON DELETE CASCADE,
    project_id UUID,
    status_key VARCHAR(50) NOT NULL,
    status_label VARCHAR(100) NOT NULL,
    status_color VARCHAR(20) NOT NULL DEFAULT '#6B7280',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_initial BOOLEAN NOT NULL DEFAULT FALSE,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_workflow_project FOREIGN KEY (company_id, project_id) REFERENCES hrms.projects(company_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_company_default_workflow 
ON hrms.department_workflows (company_id, status_key) 
WHERE department_id IS NULL AND project_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_dept_default_workflow 
ON hrms.department_workflows (company_id, department_id, status_key) 
WHERE department_id IS NOT NULL AND project_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_project_override_workflow 
ON hrms.department_workflows (company_id, project_id, status_key) 
WHERE project_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. WORKFLOW TRANSITIONS TABLE (ID-Based Transition Rules)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.workflow_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    department_id UUID REFERENCES hrms.departments(id) ON DELETE CASCADE,
    project_id UUID,
    from_status_id UUID NOT NULL REFERENCES hrms.department_workflows(id) ON DELETE CASCADE,
    to_status_id UUID NOT NULL REFERENCES hrms.department_workflows(id) ON DELETE CASCADE,
    allowed_role VARCHAR(100) DEFAULT 'ALL',
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_no_self_transition CHECK (from_status_id <> to_status_id),
    CONSTRAINT fk_transition_project FOREIGN KEY (company_id, project_id) REFERENCES hrms.projects(company_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_transition_rule UNIQUE (company_id, from_status_id, to_status_id, allowed_role)
);

-- ----------------------------------------------------------------------------
-- 5. PROJECT TASKS TABLE (Main Tasks & Subtasks)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.project_tasks (
    id UUID DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    project_id UUID,
    milestone_id UUID,
    parent_task_id UUID,
    task_code VARCHAR(50) NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'TODO',
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    task_type VARCHAR(50) NOT NULL DEFAULT 'PROJECT_TASK',
    approval_status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
    start_date DATE,
    due_date DATE,
    due_datetime TIMESTAMPTZ,
    estimated_minutes INTEGER NOT NULL DEFAULT 0,
    actual_minutes INTEGER NOT NULL DEFAULT 0,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID,
    completed_by UUID,
    completed_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, id),
    CONSTRAINT uq_tasks_id UNIQUE (id),
    CONSTRAINT uq_tasks_company_project_id UNIQUE (company_id, project_id, id),
    CONSTRAINT uq_task_code UNIQUE (company_id, task_code),
    CONSTRAINT chk_task_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT chk_task_approval CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    CONSTRAINT chk_task_type CHECK (task_type IN ('PROJECT_TASK', 'GENERAL_TASK', 'SELF_TASK')),
    CONSTRAINT chk_task_estimated_minutes CHECK (estimated_minutes >= 0),
    CONSTRAINT chk_task_actual_minutes CHECK (actual_minutes >= 0),
    CONSTRAINT chk_task_dates CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date),
    CONSTRAINT chk_milestone_project_null CHECK (milestone_id IS NULL OR project_id IS NOT NULL),
    CONSTRAINT fk_tasks_project FOREIGN KEY (company_id, project_id) REFERENCES hrms.projects(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_tasks_milestone FOREIGN KEY (company_id, project_id, milestone_id) REFERENCES hrms.project_milestones(company_id, project_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_parent FOREIGN KEY (company_id, project_id, parent_task_id) REFERENCES hrms.project_tasks(company_id, project_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_creator FOREIGN KEY (company_id, created_by) REFERENCES hrms.employees(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_completer FOREIGN KEY (company_id, completed_by) REFERENCES hrms.employees(company_id, id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 6. PROJECT EMPLOYEE ASSIGNMENTS TABLE (Project Team)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.project_employee_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    project_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    role_in_project VARCHAR(100) NOT NULL DEFAULT 'MEMBER',
    allocation_percentage INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_proj_assign_project FOREIGN KEY (company_id, project_id) REFERENCES hrms.projects(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_proj_assign_employee FOREIGN KEY (company_id, employee_id) REFERENCES hrms.employees(company_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_project_employee_assignment UNIQUE (company_id, project_id, employee_id),
    CONSTRAINT chk_allocation_pct CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100)
);

-- ----------------------------------------------------------------------------
-- 7. TASK ASSIGNEES TABLE (Multiple Assignees & Reviewers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.task_assignees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    task_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    assignment_role VARCHAR(50) NOT NULL DEFAULT 'ASSIGNEE',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_assignee_role CHECK (assignment_role IN ('ASSIGNEE', 'REVIEWER', 'QA', 'OBSERVER')),
    CONSTRAINT fk_task_assignee_task FOREIGN KEY (company_id, task_id) REFERENCES hrms.project_tasks(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_task_assignee_emp FOREIGN KEY (company_id, employee_id) REFERENCES hrms.employees(company_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_task_employee_assignment UNIQUE (company_id, task_id, employee_id)
);

-- ----------------------------------------------------------------------------
-- 8. TASK CHECKLISTS TABLE (Sub-step Checkboxes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.task_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    task_id UUID NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_by UUID,
    completed_at TIMESTAMPTZ,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_checklist_task FOREIGN KEY (company_id, task_id) REFERENCES hrms.project_tasks(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_checklist_completer FOREIGN KEY (company_id, completed_by) REFERENCES hrms.employees(company_id, id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 9. TASK LABELS MASTER TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.task_labels (
    id UUID DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    label_name VARCHAR(100) NOT NULL,
    label_color VARCHAR(20) NOT NULL DEFAULT '#6B7280',
    description TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, id),
    CONSTRAINT uq_task_labels_id UNIQUE (id),
    CONSTRAINT uq_company_label_name UNIQUE (company_id, label_name)
);

-- ----------------------------------------------------------------------------
-- 10. TASK LABEL ASSIGNMENTS TABLE (Task <-> Label Junction)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.task_label_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    task_id UUID NOT NULL,
    label_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_label_assign_task FOREIGN KEY (company_id, task_id) REFERENCES hrms.project_tasks(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_label_assign_label FOREIGN KEY (company_id, label_id) REFERENCES hrms.task_labels(company_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_task_label_assignment UNIQUE (company_id, task_id, label_id)
);

-- ----------------------------------------------------------------------------
-- 11. TASK DEPENDENCIES TABLE (Workflows & Blockers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    task_id UUID NOT NULL,
    depends_on_task_id UUID NOT NULL,
    dependency_type VARCHAR(50) NOT NULL DEFAULT 'BLOCKS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_dep_type CHECK (dependency_type IN ('BLOCKS', 'RELATES_TO')),
    CONSTRAINT fk_dep_task FOREIGN KEY (company_id, task_id) REFERENCES hrms.project_tasks(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_dep_depends FOREIGN KEY (company_id, depends_on_task_id) REFERENCES hrms.project_tasks(company_id, id) ON DELETE CASCADE,
    CONSTRAINT chk_no_self_dep CHECK (task_id <> depends_on_task_id),
    CONSTRAINT uq_task_dependency UNIQUE (company_id, task_id, depends_on_task_id)
);

-- ----------------------------------------------------------------------------
-- 12. TASK RECURRENCES TABLE (Automated Repeated Tasks)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.task_recurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    task_id UUID NOT NULL,
    recurrence_type VARCHAR(50) NOT NULL,
    interval_value INTEGER NOT NULL DEFAULT 1,
    days_of_week VARCHAR(50),
    day_of_month INTEGER,
    start_date DATE NOT NULL,
    end_date DATE,
    next_run_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_recurrence_type CHECK (recurrence_type IN ('DAILY', 'WEEKLY', 'MONTHLY')),
    CONSTRAINT chk_recurrence_interval CHECK (interval_value >= 1),
    CONSTRAINT chk_recurrence_day_of_month CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
    CONSTRAINT chk_recurrence_dates CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT fk_recurrence_task FOREIGN KEY (company_id, task_id) REFERENCES hrms.project_tasks(company_id, id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 13. TASK STATUS HISTORY TABLE (Audit Trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.task_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    task_id UUID NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID,
    comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_status_hist_task FOREIGN KEY (company_id, task_id) REFERENCES hrms.project_tasks(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_status_hist_changer FOREIGN KEY (company_id, changed_by) REFERENCES hrms.employees(company_id, id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 14. TASK COMMENTS TABLE (Task Discussions & Threaded Replies)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    task_id UUID NOT NULL,
    parent_comment_id UUID,
    employee_id UUID,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT fk_comment_task FOREIGN KEY (company_id, task_id) REFERENCES hrms.project_tasks(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_parent FOREIGN KEY (parent_comment_id) REFERENCES hrms.task_comments(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_author FOREIGN KEY (company_id, employee_id) REFERENCES hrms.employees(company_id, id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 15. TASK TIMER LOGS TABLE (Live Work Timers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.task_timer_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    task_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 0,
    is_running BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_timer_task FOREIGN KEY (company_id, task_id) REFERENCES hrms.project_tasks(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_timer_employee FOREIGN KEY (company_id, employee_id) REFERENCES hrms.employees(company_id, id) ON DELETE CASCADE,
    CONSTRAINT uq_timer_log_comp_emp_id UNIQUE (company_id, employee_id, id)
);

-- ----------------------------------------------------------------------------
-- 16. TIMESHEETS TABLE (Weekly Header)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.timesheets (
    id UUID DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    total_minutes INTEGER NOT NULL DEFAULT 0,
    billable_minutes INTEGER NOT NULL DEFAULT 0,
    non_billable_minutes INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    submitted_at TIMESTAMPTZ,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, id),
    CONSTRAINT uq_timesheets_id UNIQUE (id),
    CONSTRAINT uq_timesheet_comp_id_emp UNIQUE (company_id, id, employee_id),
    CONSTRAINT fk_timesheets_employee FOREIGN KEY (company_id, employee_id) REFERENCES hrms.employees(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_timesheets_approver FOREIGN KEY (company_id, approved_by) REFERENCES hrms.employees(company_id, id) ON DELETE SET NULL,
    CONSTRAINT uq_employee_weekly_timesheet UNIQUE (company_id, employee_id, week_start_date),
    CONSTRAINT chk_timesheet_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'REJECTED', 'APPROVED', 'LOCKED', 'CANCELLED')),
    CONSTRAINT chk_timesheet_dates CHECK (week_end_date >= week_start_date)
);

-- ----------------------------------------------------------------------------
-- 17. TIMESHEET ENTRIES TABLE (Daily Time Logs with Employee Consistency)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.timesheet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    timesheet_id UUID NOT NULL,
    employee_id UUID,
    project_id UUID,
    task_id UUID,
    timer_log_id UUID,
    entry_date DATE NOT NULL,
    minutes INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    is_billable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_entry_timesheet_emp FOREIGN KEY (company_id, timesheet_id, employee_id) REFERENCES hrms.timesheets(company_id, id, employee_id) ON DELETE CASCADE,
    CONSTRAINT fk_entry_timer_log_emp FOREIGN KEY (company_id, employee_id, timer_log_id) REFERENCES hrms.task_timer_logs(company_id, employee_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_entry_project FOREIGN KEY (company_id, project_id) REFERENCES hrms.projects(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_entry_task FOREIGN KEY (company_id, project_id, task_id) REFERENCES hrms.project_tasks(company_id, project_id, id) ON DELETE SET NULL,
    CONSTRAINT chk_entry_minutes CHECK (minutes >= 0 AND minutes <= 1440)
);

-- ----------------------------------------------------------------------------
-- 18. TIMESHEET APPROVAL HISTORY TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.timesheet_approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    timesheet_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    action_by UUID,
    comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_approval_action CHECK (action IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'RESUBMITTED', 'CANCELLED')),
    CONSTRAINT fk_timesheet_history FOREIGN KEY (company_id, timesheet_id) REFERENCES hrms.timesheets(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_history_action_by FOREIGN KEY (company_id, action_by) REFERENCES hrms.employees(company_id, id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 19. ATTACHMENTS TABLE (File Metadata)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(255),
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    storage_provider VARCHAR(50) DEFAULT 'LOCAL',
    storage_bucket VARCHAR(255),
    storage_key TEXT,
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_attachment_entity CHECK (entity_type IN ('PROJECT', 'TASK', 'TIMESHEET', 'TIMESHEET_ENTRY')),
    CONSTRAINT fk_attachment_uploader FOREIGN KEY (company_id, uploaded_by) REFERENCES hrms.employees(company_id, id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 20. TASK ACTIVITY LOG TABLE (System Audit Log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.task_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    task_id UUID NOT NULL,
    actor_id UUID,
    action VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_activity_task FOREIGN KEY (company_id, task_id) REFERENCES hrms.project_tasks(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_actor FOREIGN KEY (company_id, actor_id) REFERENCES hrms.employees(company_id, id) ON DELETE SET NULL
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_projects_comp_status ON hrms.projects(company_id, status);
CREATE INDEX IF NOT EXISTS idx_milestones_comp_proj ON hrms.project_milestones(company_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_dept_workflows ON hrms.department_workflows(company_id, department_id, project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions ON hrms.workflow_transitions(company_id, from_status_id, to_status_id);
CREATE INDEX IF NOT EXISTS idx_tasks_comp_proj ON hrms.project_tasks(company_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_due ON hrms.project_tasks(company_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_task_assignees_emp ON hrms.task_assignees(employee_id);
CREATE INDEX IF NOT EXISTS idx_task_checklists_task ON hrms.task_checklists(task_id);
CREATE INDEX IF NOT EXISTS idx_task_timer_running ON hrms.task_timer_logs(employee_id, is_running);
CREATE INDEX IF NOT EXISTS idx_timesheets_comp_emp_week ON hrms.timesheets(company_id, employee_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_ts_date ON hrms.timesheet_entries(timesheet_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON hrms.attachments(company_id, entity_type, entity_id);
