-- ====================================================================
-- 🏢 ENTERPRISE HRMS - PRODUCTION NOTIFICATIONS TABLE SCHEMA
-- ====================================================================

CREATE TABLE IF NOT EXISTS hrms.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
    module VARCHAR(50) NOT NULL,
    event_code VARCHAR(100) NOT NULL,
    reference_type VARCHAR(50),
    reference_id VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'INFO',
    action_url VARCHAR(500),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notification_type CHECK (type IN ('INFO', 'SUCCESS', 'WARNING', 'DANGER'))
);

-- Indexes for rapid fetching
CREATE INDEX IF NOT EXISTS idx_notifications_recipient 
ON hrms.notifications (recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_company 
ON hrms.notifications (company_id);

CREATE INDEX IF NOT EXISTS idx_notifications_reference 
ON hrms.notifications (reference_type, reference_id);
