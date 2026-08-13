const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const sql = `
-- 1. SMART HR SCHEDULES TABLE
CREATE TABLE IF NOT EXISTS hrms.smart_hr_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    frequency VARCHAR(50) NOT NULL DEFAULT 'DAILY',
    execution_time TIME NOT NULL DEFAULT '09:00:00',
    execution_day_of_month INTEGER,
    execution_day_of_week VARCHAR(20),
    recipient_type VARCHAR(100) NOT NULL DEFAULT 'ALL_EMPLOYEES',
    channel_type VARCHAR(50) NOT NULL DEFAULT 'BOTH',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SMART HR TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS hrms.smart_hr_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE,
    template_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    body_content TEXT NOT NULL,
    channel_type VARCHAR(50) NOT NULL DEFAULT 'BOTH',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SMART HR LOGS TABLE
CREATE TABLE IF NOT EXISTS hrms.smart_hr_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES hrms.smart_hr_schedules(id) ON DELETE SET NULL,
    task_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
    total_recipients INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    summary TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function runMigration() {
  try {
    console.log('🚀 Running Smart HR Tables Migration...');
    await pool.query(sql);
    console.log('✅ Tables created successfully!');

    // Seed default sample templates if empty
    const checkTpl = await pool.query('SELECT count(*) FROM hrms.smart_hr_templates');
    if (parseInt(checkTpl.rows[0].count, 10) === 0) {
      console.log('🌱 Seeding sample Smart HR templates...');
      await pool.query(`
        INSERT INTO hrms.smart_hr_templates (template_type, title, subject, body_content, channel_type, is_default) VALUES
        (
          'BIRTHDAY',
          'Standard Birthday Wish',
          '🎉 Happy Birthday {{employee_name}}!',
          'Dear {{employee_name}},\n\nWishing you a very Happy Birthday from all of us at {{company_name}}! May this year bring you great joy, health, and success.\n\nWarm regards,\nHR Team',
          'BOTH',
          true
        ),
        (
          'ANNIVERSARY',
          'Work Anniversary Congratulation',
          '⭐ Happy Work Anniversary {{employee_name}}!',
          'Dear {{employee_name}},\n\nCongratulations on completing {{years_count}} year(s) with {{company_name}}! Thank you for your dedication and valuable contributions.\n\nBest regards,\nHR Team',
          'BOTH',
          true
        ),
        (
          'ATTENDANCE_SUMMARY',
          'Weekly Attendance Digest',
          '📊 Weekly Team Attendance Summary Report',
          'Dear {{manager_name}},\n\nPlease find attached the weekly attendance summary for your team for the period ending {{current_date}}.\n\nRegards,\nSmart HR System',
          'EMAIL',
          true
        )
      `);
      console.log('🌱 Sample templates seeded!');
    }

    // Seed default sample schedules if empty
    const checkSched = await pool.query('SELECT count(*) FROM hrms.smart_hr_schedules');
    if (parseInt(checkSched.rows[0].count, 10) === 0) {
      console.log('🌱 Seeding sample Smart HR schedules...');
      await pool.query(`
        INSERT INTO hrms.smart_hr_schedules (title, task_type, frequency, execution_time, recipient_type, channel_type, status) VALUES
        ('Daily Employee Birthday Greetings', 'BIRTHDAY_WISHES', 'DAILY', '09:00:00', 'ALL_EMPLOYEES', 'BOTH', 'ACTIVE'),
        ('Daily Work Anniversary Wishes', 'ANNIVERSARY_WISHES', 'DAILY', '09:30:00', 'ALL_EMPLOYEES', 'BOTH', 'ACTIVE'),
        ('Weekly Manager Attendance Digest', 'ATTENDANCE_REPORT', 'WEEKLY', '08:30:00', 'DEPARTMENT_HEADS', 'EMAIL', 'ACTIVE'),
        ('Monthly Automated Payroll Run', 'PAYROLL_GENERATION', 'MONTHLY', '22:00:00', 'HR_MANAGERS', 'BOTH', 'PAUSED')
      `);
      console.log('🌱 Sample schedules seeded!');
    }

    // Seed sample log if empty
    const checkLogs = await pool.query('SELECT count(*) FROM hrms.smart_hr_logs');
    if (parseInt(checkLogs.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO hrms.smart_hr_logs (task_type, title, status, total_recipients, success_count, failed_count, summary) VALUES
        ('BIRTHDAY_WISHES', 'Daily Employee Birthday Greetings', 'SUCCESS', 2, 2, 0, 'Sent birthday wishes via Email & WhatsApp to 2 employees.'),
        ('ATTENDANCE_REPORT', 'Weekly Manager Attendance Digest', 'SUCCESS', 5, 5, 0, 'Delivered weekly attendance summary PDF to 5 department managers.')
      `);
    }

  } catch (err) {
    console.error('❌ Migration Error:', err);
  } finally {
    await pool.end();
  }
}

runMigration();
