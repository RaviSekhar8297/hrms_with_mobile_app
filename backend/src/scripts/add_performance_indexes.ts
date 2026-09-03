import { query } from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

const indexStatements = [
  // 1. Employees table composite indexes
  `CREATE INDEX IF NOT EXISTS idx_employees_company_status ON hrms.employees (company_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_employees_email_lower ON hrms.employees (LOWER(email));`,
  
  // 2. Attendance & Raw punches indexes
  `CREATE INDEX IF NOT EXISTS idx_raw_punches_emp_date ON hrms.attendance_raw_punches (company_id, employee_id, punch_time DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON hrms.attendance (employee_id, date);`,
  
  // 3. Leave Requests indexes
  `CREATE INDEX IF NOT EXISTS idx_leave_requests_company_status ON hrms.leave_requests (company_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON hrms.leave_requests (employee_id, status);`,
  
  // 4. Audit Logs indexes
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created ON hrms.audit_logs (company_id, created_at DESC);`,
  
  // 5. Payroll runs indexes
  `CREATE INDEX IF NOT EXISTS idx_payroll_runs_company_status ON hrms.payroll_runs (company_id, status);`
];

async function applyIndexes() {
  console.log('🚀 Starting Database Index Optimization (Step 1)...');
  let appliedCount = 0;

  for (const sql of indexStatements) {
    try {
      console.log(`[Executing] ${sql}`);
      await query(sql);
      appliedCount++;
      console.log(`✅ Success`);
    } catch (err: any) {
      console.error(`❌ Error executing index statement:`, err.message);
    }
  }

  console.log(`\n🎉 Completed Database Indexing! (${appliedCount}/${indexStatements.length} statements executed successfully)`);
  process.exit(0);
}

applyIndexes();
