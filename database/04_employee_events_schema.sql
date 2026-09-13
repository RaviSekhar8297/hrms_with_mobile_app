-- Schema for Employee Events, Wishes, and Reactions (Birthday & Anniversary Celebrations)
SET search_path TO hrms, public;

CREATE TABLE IF NOT EXISTS hrms.employee_events (
    id BIGSERIAL PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('BIRTHDAY', 'ANNIVERSARY')),
    event_date DATE NOT NULL,
    event_year INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_company_employee_event UNIQUE (company_id, employee_id, event_type, event_year)
);

CREATE INDEX IF NOT EXISTS idx_employee_events_company_date ON hrms.employee_events (company_id, event_date);
CREATE INDEX IF NOT EXISTS idx_employee_events_year_type ON hrms.employee_events (event_year, event_type);

CREATE TABLE IF NOT EXISTS hrms.event_wishes (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES hrms.employee_events(id) ON DELETE CASCADE,
    sender_employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_event_wishes_event ON hrms.event_wishes (event_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_event_wishes_sender ON hrms.event_wishes (sender_employee_id);

CREATE TABLE IF NOT EXISTS hrms.event_reactions (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES hrms.employee_events(id) ON DELETE CASCADE,
    sender_employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL DEFAULT 'LIKE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_event_employee_reaction UNIQUE (event_id, sender_employee_id)
);

CREATE INDEX IF NOT EXISTS idx_event_reactions_event ON hrms.event_reactions (event_id);
