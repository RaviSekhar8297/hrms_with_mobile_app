const { Client } = require('pg');
require('dotenv').config();

async function createOnboardingTable() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL Supabase database.');

    const sqlScript = `
      CREATE TABLE IF NOT EXISTS hrms.employee_onboardings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
          onboarding_code VARCHAR(50) NOT NULL UNIQUE,

          candidate_id UUID NOT NULL REFERENCES hrms.candidates(id) ON DELETE CASCADE,
          application_id UUID REFERENCES hrms.job_applications(id) ON DELETE SET NULL,
          candidate_offer_id UUID REFERENCES hrms.candidate_offers(id) ON DELETE SET NULL,
          created_employee_id UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,

          portal_token VARCHAR(255) UNIQUE,
          token_expires_at TIMESTAMP WITH TIME ZONE,
          link_sent_at TIMESTAMP WITH TIME ZONE,
          form_submitted_at TIMESTAMP WITH TIME ZONE,

          onboarding_status VARCHAR(50) NOT NULL DEFAULT 'INITIATED',
          
          target_joining_date DATE NOT NULL,
          actual_joining_date DATE,
          assigned_hr_id UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
          assigned_buddy_id UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,

          candidate_submitted_data JSONB DEFAULT '{}'::jsonb,
          document_verification_status JSONB DEFAULT '{}'::jsonb,
          checklist_status JSONB DEFAULT '{}'::jsonb,

          cancellation_reason TEXT,
          notes TEXT,

          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by UUID,
          updated_by UUID
      );

      CREATE INDEX IF NOT EXISTS idx_onboarding_company ON hrms.employee_onboardings(company_id);
      CREATE INDEX IF NOT EXISTS idx_onboarding_candidate ON hrms.employee_onboardings(candidate_id);
      CREATE INDEX IF NOT EXISTS idx_onboarding_token ON hrms.employee_onboardings(portal_token);
      CREATE INDEX IF NOT EXISTS idx_onboarding_status ON hrms.employee_onboardings(onboarding_status);
    `;

    await client.query(sqlScript);
    console.log('Successfully created hrms.employee_onboardings table and indexes!');

  } catch (err) {
    console.error('Error creating onboarding table:', err.message);
  } finally {
    await client.end();
  }
}

createOnboardingTable();
