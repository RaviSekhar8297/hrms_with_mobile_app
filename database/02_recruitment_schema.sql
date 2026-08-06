-- =========================================================================
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

-- 2. Email Integrations
CREATE TABLE IF NOT EXISTS hrms.email_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_username VARCHAR(255) NOT NULL,
    smtp_password_encrypted TEXT NOT NULL,
    encryption_type VARCHAR(20) NOT NULL DEFAULT 'TLS',
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_email_encryption_type CHECK (encryption_type IN ('NONE', 'SSL', 'TLS', 'STARTTLS')),
    CONSTRAINT chk_smtp_port CHECK (smtp_port > 0 AND smtp_port <= 65535),
    CONSTRAINT uq_email_integration_company UNIQUE (company_id)
);

-- 2.1 WhatsApp Integrations
CREATE TABLE IF NOT EXISTS hrms.whatsapp_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    api_url TEXT NOT NULL,
    api_key_encrypted TEXT,
    access_token_encrypted TEXT,
    phone_number_id VARCHAR(255),
    business_account_id VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_whatsapp_integration_company UNIQUE (company_id)
);

-- 2.2 WhatsApp Campaigns
CREATE TABLE IF NOT EXISTS hrms.whatsapp_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    whatsapp_integration_id UUID NOT NULL,
    campaign_name VARCHAR(255) NOT NULL,
    campaign_code VARCHAR(100) NOT NULL,
    provider_template_id VARCHAR(255),
    template_name VARCHAR(255) NOT NULL,
    language_code VARCHAR(20) NOT NULL DEFAULT 'en',
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_whatsapp_campaign_integration FOREIGN KEY (whatsapp_integration_id) REFERENCES hrms.whatsapp_integrations(id) ON DELETE CASCADE,
    CONSTRAINT uq_whatsapp_campaign_code UNIQUE (company_id, campaign_code),
    CONSTRAINT chk_campaign_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- 2.3 Notification Configurations
CREATE TABLE IF NOT EXISTS hrms.notification_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    module VARCHAR(100) NOT NULL,
    event_code VARCHAR(150) NOT NULL,
    email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    email_integration_id UUID,
    whatsapp_campaign_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_notification_email FOREIGN KEY (email_integration_id) REFERENCES hrms.email_integrations(id) ON DELETE SET NULL,
    CONSTRAINT fk_notification_whatsapp FOREIGN KEY (whatsapp_campaign_id) REFERENCES hrms.whatsapp_campaigns(id) ON DELETE SET NULL,
    CONSTRAINT uq_notification_event UNIQUE (company_id, module, event_code)
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
    round_name VARCHAR(100) NOT NULL,
    round_type VARCHAR(50) NOT NULL,
    round_order INTEGER NOT NULL CHECK (round_order > 0),
    passing_score INTEGER CHECK (passing_score BETWEEN 0 AND 100),
    duration_minutes INTEGER CHECK (duration_minutes > 0),
    is_mandatory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
