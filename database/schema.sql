-- Create the schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS hrms;

-- Set search path to hrms schema
SET search_path TO hrms, public;

-- 1. Companies Table (Tenants)
CREATE TABLE IF NOT EXISTS hrms.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE,
    domain VARCHAR(255),
    branding_logo TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Branches Table
CREATE TABLE IF NOT EXISTS hrms.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_company_branch UNIQUE (company_id, name)
);

-- 3. Departments Table
CREATE TABLE IF NOT EXISTS hrms.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES hrms.branches(id) ON DELETE SET NULL, -- Link department to a branch
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_company_branch_department UNIQUE (company_id, branch_id, name)
);

-- 4. Designations Table
CREATE TABLE IF NOT EXISTS hrms.designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES hrms.branches(id) ON DELETE SET NULL,      -- Link designation to a branch
    department_id UUID REFERENCES hrms.departments(id) ON DELETE SET NULL, -- Link designation to a department
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_company_branch_dept_designation UNIQUE (company_id, branch_id, department_id, name)
);

-- 5. Roles Table
CREATE TABLE IF NOT EXISTS hrms.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_company_role UNIQUE (company_id, name)
);

-- 6. Permissions Table (Global Reference Table)
CREATE TABLE IF NOT EXISTS hrms.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    module VARCHAR(100) NOT NULL, -- e.g., 'payroll', 'attendance', 'leave', 'employee'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Role Permissions Mapping Table
CREATE TABLE IF NOT EXISTS hrms.role_permissions (
    role_id UUID REFERENCES hrms.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES hrms.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 8. Employees Table (User Profiles)
CREATE TABLE IF NOT EXISTS hrms.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE,
    role_id UUID REFERENCES hrms.roles(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES hrms.branches(id) ON DELETE SET NULL,
    department_id UUID REFERENCES hrms.departments(id) ON DELETE SET NULL,
    designation_id UUID REFERENCES hrms.designations(id) ON DELETE SET NULL,
    emp_id_code VARCHAR(50) NOT NULL, -- e.g. 'EMP0001'
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PROBATION', 'TERMINATED', 'RESIGNED')),
    joining_date DATE NOT NULL,
    dob DATE,
    gender VARCHAR(20),
    marital_status VARCHAR(50),
    blood_group VARCHAR(10),
    personal_email VARCHAR(255),
    reporting_to_id UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
    employment_type VARCHAR(50),
    probation_period_months INTEGER,
    confirmation_date DATE,
    exit_date DATE,
    resignation_date DATE,
    pan_number VARCHAR(50),
    aadhar_number VARCHAR(50),
    esi_number VARCHAR(50),
    uan_number VARCHAR(100),
    bank_information JSONB DEFAULT '[]'::jsonb,
    current_address TEXT,
    permanent_address TEXT,
    emergency_contacts JSONB DEFAULT '[]'::jsonb,
    education JSONB DEFAULT '[]'::jsonb,
    experience JSONB DEFAULT '[]'::jsonb,
    skills JSONB DEFAULT '[]'::jsonb,
    emp_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_company_employee_code UNIQUE (company_id, emp_id_code),
    CONSTRAINT unique_company_employee_email UNIQUE (company_id, email)
);

-- 8b. Employee Documents Table (JSONB checklists)
CREATE TABLE IF NOT EXISTS hrms.employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES hrms.employees(id) ON DELETE CASCADE UNIQUE,
    documents JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Activity Logs Table (Audit Trail)
CREATE TABLE IF NOT EXISTS hrms.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE, -- NULL for SuperAdmin
    user_email VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'EMPLOYEE_CREATE'
    module VARCHAR(100) NOT NULL, -- e.g., 'auth', 'payroll', 'employee'
    details JSONB,                -- flexible data like device, IP, changes
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for Multi-Tenant performance query efficiency
CREATE INDEX IF NOT EXISTS idx_employees_company ON hrms.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_roles_company ON hrms.roles(company_id);
CREATE INDEX IF NOT EXISTS idx_branches_company ON hrms.branches(company_id);

-- Indexing for Hierarchical relationships
CREATE INDEX IF NOT EXISTS idx_departments_company ON hrms.departments(company_id);
CREATE INDEX IF NOT EXISTS idx_departments_branch ON hrms.departments(branch_id);
CREATE INDEX IF NOT EXISTS idx_designations_company ON hrms.designations(company_id);
CREATE INDEX IF NOT EXISTS idx_designations_branch ON hrms.designations(branch_id);
CREATE INDEX IF NOT EXISTS idx_designations_dept ON hrms.designations(department_id);

-- Indexing for Activity Logs queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON hrms.activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_email ON hrms.activity_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON hrms.activity_logs(created_at);

-- Seed default global permissions (handled dynamically by backend server)

-- =========================================================================
-- 1. SHIFT MASTER TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.shift_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    shift_name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INTEGER DEFAULT 0,
    grace_in_minutes INTEGER DEFAULT 0,
    grace_out_minutes INTEGER DEFAULT 0,
    min_half_day_minutes INTEGER DEFAULT 240,
    min_full_day_minutes INTEGER DEFAULT 480,
    allow_overtime BOOLEAN DEFAULT FALSE,
    ot_after_minutes INTEGER DEFAULT 0,
    is_night_shift BOOLEAN DEFAULT FALSE,
    is_flexible BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 2. EMPLOYEE SHIFTS HISTORICAL MAPPING TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.employee_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES hrms.shift_masters(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL,
    effective_to DATE, -- NULL means currently active/open-ended
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_shift_range UNIQUE (employee_id, shift_id, effective_from)
);

-- =========================================================================
-- 3. ATTENDANCE POLICIES TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.attendance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    policy_name VARCHAR(100) NOT NULL,
    late_allowed_per_month INTEGER DEFAULT 3,
    late_marks_deduction_rule VARCHAR(50) DEFAULT '3_LATES_1_HALF_DAY', -- e.g., 3_LATES_1_HALF_DAY, 5_LATES_1_LEAVE
    sandwich_rule BOOLEAN DEFAULT FALSE,
    max_permission_count_per_month INTEGER DEFAULT 3,
    max_permission_minutes_per_month INTEGER DEFAULT 360, -- e.g., 6 hours total
    max_single_permission_minutes INTEGER DEFAULT 120, -- max 2 hours per request
    permission_affects_late BOOLEAN DEFAULT TRUE,
    permission_affects_early_exit BOOLEAN DEFAULT TRUE,
    allow_mobile_punch BOOLEAN DEFAULT TRUE,
    allow_web_punch BOOLEAN DEFAULT TRUE,
    require_selfie BOOLEAN DEFAULT FALSE,
    require_gps BOOLEAN DEFAULT FALSE,
    enforce_device_binding BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_company_attendance_policy UNIQUE (company_id, policy_name)
);

-- =========================================================================
-- 4. WEEKOFF POLICIES TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.weekoff_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES hrms.branches(id) ON DELETE CASCADE, -- NULL = Applies globally to all branches
    sunday BOOLEAN DEFAULT TRUE,
    monday BOOLEAN DEFAULT FALSE,
    tuesday BOOLEAN DEFAULT FALSE,
    wednesday BOOLEAN DEFAULT FALSE,
    thursday BOOLEAN DEFAULT FALSE,
    friday BOOLEAN DEFAULT FALSE,
    saturday_rule VARCHAR(30) DEFAULT 'ALL', -- 'ALL', 'NONE', 'ALT_2_4', 'ALT_1_3_5'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 5. HOLIDAY MASTER TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.holiday_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES hrms.branches(id) ON DELETE SET NULL, -- NULL = national/company-wide holiday
    holiday_date DATE NOT NULL,
    holiday_name VARCHAR(150) NOT NULL,
    is_restricted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_company_branch_holiday UNIQUE (company_id, branch_id, holiday_date)
);

-- =========================================================================
-- 6. ATTENDANCE RAW PUNCHES TABLE (IMMUTABLE LOG)
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.attendance_raw_punches (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    punch_time TIMESTAMP WITH TIME ZONE NOT NULL,
    device_id VARCHAR(50),
    source VARCHAR(30) DEFAULT 'BIOMETRIC', -- 'BIOMETRIC', 'MOBILE_GPS', 'WEB', 'MANUAL'
    direction VARCHAR(10) CHECK (direction IN ('IN', 'OUT')),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    ip_address VARCHAR(50),
    image_url VARCHAR(255),
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 7. ATTENDANCE SUMMARY TABLE (DAILY COMPILED OUTPUT)
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.attendance_summary (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    shift_id UUID REFERENCES hrms.shift_masters(id) ON DELETE SET NULL,
    first_in TIMESTAMP WITH TIME ZONE,
    last_out TIMESTAMP WITH TIME ZONE,
    worked_minutes INTEGER DEFAULT 0,
    break_minutes INTEGER DEFAULT 0,
    overtime_minutes INTEGER DEFAULT 0,
    approved_overtime_minutes INTEGER DEFAULT 0,
    ot_status VARCHAR(20) DEFAULT 'PENDING' CHECK (ot_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    late_minutes INTEGER DEFAULT 0,
    early_exit_minutes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ABSENT' CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'HOLIDAY', 'WEEK_OFF', 'ON_LEAVE')),
    punch_count INTEGER DEFAULT 0,
    is_regularized BOOLEAN DEFAULT FALSE,
    regularized_by UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_attendance_date UNIQUE (employee_id, attendance_date)
);

-- =========================================================================
-- 8. ATTENDANCE REGULARIZATIONS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.attendance_regularizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    requested_in TIME,
    requested_out TIME,
    reason TEXT NOT NULL,
    attachment_url VARCHAR(255),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_regularization_date UNIQUE (employee_id, attendance_date)
);

-- =========================================================================
-- 9. PERMISSION REQUESTS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.permission_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    permission_type VARCHAR(30) NOT NULL CHECK (permission_type IN ('LATE_ARRIVALS', 'EARLY_EXIT', 'MID_DAY', 'ON_DUTY')),
    permission_date DATE NOT NULL,
    from_time TIME NOT NULL,
    to_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 10. ATTENDANCE LOCKS TABLE (FOR PAYROLL SAFEGUARD)
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.attendance_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    lock_year INTEGER NOT NULL,
    lock_month INTEGER NOT NULL,
    is_locked BOOLEAN DEFAULT TRUE,
    locked_by UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_company_month_lock UNIQUE (company_id, lock_year, lock_month)
);

-- =========================================================================
-- 11. LEAVE TYPES TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    accrual_type VARCHAR(30) DEFAULT 'YEARLY' CHECK (accrual_type IN ('MONTHLY', 'YEARLY')),
    allotted_per_year DECIMAL(5,2) NOT NULL,
    accrued_per_month DECIMAL(4,2) DEFAULT 0.00,
    does_carry_forward BOOLEAN DEFAULT FALSE,
    carry_forward_limit DECIMAL(5,2) DEFAULT 0.0,
    is_wfh BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_company_leave_type UNIQUE (company_id, name)
);

-- =========================================================================
-- 12. LEAVE BALANCES TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES hrms.leave_types(id) ON DELETE CASCADE,
    balance_year INTEGER NOT NULL,
    allotted DECIMAL(5,2) NOT NULL,
    used DECIMAL(5,2) DEFAULT 0.0,
    pending_approval DECIMAL(5,2) DEFAULT 0.0,
    remaining DECIMAL(5,2) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_leave_type_year UNIQUE (employee_id, leave_type_id, balance_year)
);

-- =========================================================================
-- 13. LEAVE REQUESTS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES hrms.leave_types(id) ON DELETE CASCADE,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    total_days DECIMAL(4,2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 14. LEAVE TRANSACTION LOGS (LEDGER LOG)
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.leave_transaction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES hrms.leave_types(id) ON DELETE CASCADE,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(5,2) NOT NULL, -- positive for credits (accrual), negative for debits (usage/cancellation)
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('ACCRUAL', 'USAGE', 'CANCELLATION', 'MANUAL_ADJUSTMENT', 'CARRY_FORWARD')),
    performed_by UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
    remarks TEXT
);

-- =========================================================================
-- 15. EMPLOYEE DEVICES TABLE (DEVICE BINDING)
-- =========================================================================
CREATE TABLE IF NOT EXISTS hrms.employee_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    device_identifier VARCHAR(255) NOT NULL,
    device_model VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING_APPROVAL')),
    approved_by UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_device UNIQUE (employee_id, device_identifier)
);

-- =========================================================================
-- INDEX STRATEGY FOR ATTENDANCE & LEAVES PERFORMANCE
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_raw_punches_processing ON hrms.attendance_raw_punches (company_id, employee_id, punch_time DESC);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_dates ON hrms.employee_shifts (employee_id, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_attendance_summary_payroll ON hrms.attendance_summary (company_id, attendance_date, status);
CREATE INDEX IF NOT EXISTS idx_leave_balances_lookup ON hrms.leave_balances (employee_id, balance_year);
CREATE INDEX IF NOT EXISTS idx_employee_devices_lookup ON hrms.employee_devices (employee_id, status);


 
 -- =========================================================================
-- RECRUITMENT & ATS MODULE SCHEMA
-- =========================================================================

-- 1. Recruitment Settings
CREATE TABLE IF NOT EXISTS hrms.recruitment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    auto_generate_application_code BOOLEAN DEFAULT TRUE,
    default_interview_duration INTEGER DEFAULT 30 CHECK (default_interview_duration > 0),
    offer_expiry_days INTEGER DEFAULT 7 CHECK (offer_expiry_days > 0),
    email_notifications_enabled BOOLEAN DEFAULT TRUE,
    whatsapp_notifications_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_company_recruitment_settings UNIQUE (company_id)
);

-- 2. Company Integrations (for Email, WhatsApp, etc)
CREATE TABLE IF NOT EXISTS hrms.company_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL, -- e.g. 'SMTP', 'WHATSAPP'
    integration_name VARCHAR(100) NOT NULL,
    credentials_encrypted TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_company_integration UNIQUE (company_id, integration_type, integration_name)
);

-- 3. Job Postings
CREATE TABLE IF NOT EXISTS hrms.job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    job_code VARCHAR(100) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    department_id UUID REFERENCES hrms.departments(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES hrms.branches(id) ON DELETE SET NULL,
    location_id UUID REFERENCES hrms.branches(id) ON DELETE SET NULL,
    openings_count INTEGER NOT NULL CHECK (openings_count > 0),
    employment_type VARCHAR(50) NOT NULL,
    work_mode VARCHAR(50) NOT NULL,
    minimum_experience_years NUMERIC(4,1) CHECK (minimum_experience_years >= 0),
    maximum_experience_years NUMERIC(4,1) CHECK (maximum_experience_years >= minimum_experience_years),
    min_salary NUMERIC CHECK (min_salary >= 0),
    max_salary NUMERIC CHECK (max_salary >= min_salary),
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(30) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED')),
    application_deadline TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    deleted_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_company_job_code UNIQUE (company_id, job_code),
    CONSTRAINT unique_company_job_slug UNIQUE (company_id, slug)
);

-- 4. Job Interview Rounds
CREATE TABLE IF NOT EXISTS hrms.job_interview_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    job_posting_id UUID NOT NULL REFERENCES hrms.job_postings(id) ON DELETE CASCADE,
    round_name VARCHAR(100) NOT NULL,
    round_type VARCHAR(50) NOT NULL,
    round_order INTEGER NOT NULL CHECK (round_order > 0),
    passing_score INTEGER CHECK (passing_score BETWEEN 0 AND 100),
    duration_minutes INTEGER CHECK (duration_minutes > 0),
    is_mandatory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_job_round_order UNIQUE (job_posting_id, round_order)
);

-- 5. Candidates Master Profile
CREATE TABLE IF NOT EXISTS hrms.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    email_normalized VARCHAR(255),
    phone VARCHAR(50),
    phone_normalized VARCHAR(50),
    current_ctc NUMERIC,
    expected_ctc NUMERIC,
    notice_period_days INTEGER,
    skills_summary TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    CONSTRAINT unique_company_candidate_email UNIQUE (company_id, email_normalized)
);

-- 6. Job Applications
CREATE TABLE IF NOT EXISTS hrms.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES hrms.candidates(id) ON DELETE CASCADE,
    job_posting_id UUID NOT NULL REFERENCES hrms.job_postings(id) ON DELETE CASCADE,
    application_code VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'APPLIED' CHECK (status IN ('APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEWING', 'SELECTED', 'OFFERED', 'JOINED', 'REJECTED', 'WITHDRAWN', 'ON_HOLD')),
    source VARCHAR(100),
    referred_by_employee_id UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    recruitment_agency_id UUID, -- For future extension
    rejection_reason TEXT,
    withdrawal_reason TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    CONSTRAINT unique_candidate_job UNIQUE (candidate_id, job_posting_id),
    CONSTRAINT unique_company_application_code UNIQUE (company_id, application_code)
);

-- 7. Candidate Stage History
CREATE TABLE IF NOT EXISTS hrms.candidate_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES hrms.job_applications(id) ON DELETE CASCADE,
    from_status VARCHAR(50) CHECK (from_status IS NULL OR from_status IN ('APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEWING', 'SELECTED', 'OFFERED', 'JOINED', 'REJECTED', 'WITHDRAWN', 'ON_HOLD')),
    to_status VARCHAR(50) NOT NULL CHECK (to_status IN ('APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEWING', 'SELECTED', 'OFFERED', 'JOINED', 'REJECTED', 'WITHDRAWN', 'ON_HOLD')),
    remarks TEXT,
    changed_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Recruitment Activity Logs (Polymorphic)
CREATE TABLE IF NOT EXISTS hrms.recruitment_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    activity_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    performed_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Interview Schedules
CREATE TABLE IF NOT EXISTS hrms.interview_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES hrms.job_applications(id) ON DELETE CASCADE,
    job_interview_round_id UUID NOT NULL REFERENCES hrms.job_interview_rounds(id) ON DELETE CASCADE,
    interview_mode VARCHAR(50),
    meeting_link VARCHAR(500),
    location VARCHAR(255),
    scheduled_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED')),
    scheduled_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT
);

-- 10. Interview Feedback
CREATE TABLE IF NOT EXISTS hrms.interview_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_schedule_id UUID NOT NULL REFERENCES hrms.interview_schedules(id) ON DELETE CASCADE,
    interviewer_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    technical_rating INTEGER CHECK (technical_rating BETWEEN 1 AND 5 OR technical_rating IS NULL),
    communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5 OR communication_rating IS NULL),
    problem_solving_rating INTEGER CHECK (problem_solving_rating BETWEEN 1 AND 5 OR problem_solving_rating IS NULL),
    overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5 OR overall_rating IS NULL),
    recommendation VARCHAR(50) DEFAULT 'PENDING' CHECK (recommendation IN ('PENDING', 'HIRE', 'STRONG_HIRE', 'NO_HIRE', 'MAYBE')),
    feedback TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_schedule_interviewer UNIQUE (interview_schedule_id, interviewer_id)
);

-- 11. Candidate Offers
CREATE TABLE IF NOT EXISTS hrms.candidate_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES hrms.candidates(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES hrms.job_applications(id) ON DELETE CASCADE,
    department_id UUID REFERENCES hrms.departments(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES hrms.branches(id) ON DELETE SET NULL,
    offer_number VARCHAR(100) NOT NULL,
    designation VARCHAR(150) NOT NULL,
    annual_ctc NUMERIC,
    monthly_gross NUMERIC,
    salary_structure JSONB DEFAULT '{}'::jsonb,
    joining_date DATE NOT NULL,
    offer_letter_url TEXT,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'GENERATED', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN')),
    sent_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    CONSTRAINT unique_company_offer_number UNIQUE (company_id, offer_number)
);

-- 12. Offer Negotiations
CREATE TABLE IF NOT EXISTS hrms.offer_negotiations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    offer_id UUID NOT NULL REFERENCES hrms.candidate_offers(id) ON DELETE CASCADE,
    proposed_by_type VARCHAR(50) NOT NULL CHECK (proposed_by_type IN ('CANDIDATE', 'RECRUITER', 'HIRING_MANAGER', 'HR')),
    proposed_by_employee_id UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    proposed_by_candidate_id UUID REFERENCES hrms.candidates(id) ON DELETE CASCADE,
    previous_ctc NUMERIC,
    proposed_ctc NUMERIC,
    previous_salary_structure JSONB,
    proposed_salary_structure JSONB,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Candidate Documents
CREATE TABLE IF NOT EXISTS hrms.candidate_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES hrms.candidates(id) ON DELETE CASCADE,
    application_id UUID REFERENCES hrms.job_applications(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('RESUME', 'COVER_LETTER', 'ID_PROOF', 'EDUCATION_CERTIFICATE', 'EXPERIENCE_LETTER', 'OTHER')),
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    mime_type VARCHAR(100),
    file_size BIGINT,
    storage_provider VARCHAR(50),
    storage_path TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    verified_at TIMESTAMP WITH TIME ZONE,
    uploaded_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT
);

-- 14. Candidate Notes
CREATE TABLE IF NOT EXISTS hrms.candidate_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES hrms.candidates(id) ON DELETE CASCADE,
    application_id UUID REFERENCES hrms.job_applications(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT
);

-- 15. Visitors Master
CREATE TABLE IF NOT EXISTS hrms.visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    visitor_name VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    company_name VARCHAR(255),
    id_proof_type VARCHAR(50),
    id_proof_number_encrypted TEXT,
    id_proof_last4 VARCHAR(4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Visitor Logs
CREATE TABLE IF NOT EXISTS hrms.visitor_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    visitor_id UUID NOT NULL REFERENCES hrms.visitors(id) ON DELETE CASCADE,
    visitor_type VARCHAR(50) NOT NULL CHECK (visitor_type IN ('CANDIDATE', 'VENDOR', 'CLIENT', 'GUEST', 'DELIVERY', 'OTHER')),
    purpose VARCHAR(255),
    host_employee_id UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    candidate_id UUID REFERENCES hrms.candidates(id) ON DELETE SET NULL,
    approval_status VARCHAR(50) DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED')),
    approved_by UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    visitor_photo_url TEXT,
    badge_number VARCHAR(100),
    check_in_method VARCHAR(50),
    check_out_method VARCHAR(50),
    security_guard_id UUID REFERENCES hrms.employees(id) ON DELETE RESTRICT,
    entry_time TIMESTAMP WITH TIME ZONE,
    exit_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_exit_time CHECK (exit_time IS NULL OR exit_time >= entry_time)
);

-- ============================================================================
-- 17. High-Performance Composite Indexes (Step 1 Optimization)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_employees_company_status ON hrms.employees (company_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_email_lower ON hrms.employees (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_raw_punches_emp_date ON hrms.attendance_raw_punches (company_id, employee_id, punch_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON hrms.attendance (employee_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_company_status ON hrms.leave_requests (company_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON hrms.leave_requests (employee_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created ON hrms.audit_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_company_status ON hrms.payroll_runs (company_id, status);
