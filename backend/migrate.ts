import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const sql = `
DROP TABLE IF EXISTS hrms.company_integrations CASCADE;

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
    CONSTRAINT chk_smtp_port CHECK (smtp_port > 0 AND smtp_port <= 65535)
);

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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_notifications_recipient 
ON hrms.notifications (recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_company 
ON hrms.notifications (company_id);

CREATE INDEX IF NOT EXISTS idx_notifications_reference 
ON hrms.notifications (reference_type, reference_id);
`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        await pool.query(sql);
        console.log('Migration successful!');
    } catch(err) {
        console.error('Migration failed', err);
    } finally {
        await pool.end();
    }
}

run();
