-- Migration: Create hrms.attendance_location_tracking table
CREATE TABLE IF NOT EXISTS hrms.attendance_location_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location_name TEXT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes for instant querying by Employee and Date range
CREATE INDEX IF NOT EXISTS idx_atd_location_tracking_emp_time 
    ON hrms.attendance_location_tracking (employee_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_atd_location_tracking_comp_time 
    ON hrms.attendance_location_tracking (company_id, recorded_at DESC);
