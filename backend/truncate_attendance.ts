import { query } from './src/config/db';

async function truncateAttendanceTables() {
  console.log('🧹 Starting truncate process for attendance tables...');
  try {
    const tableRes = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'hrms' AND table_name LIKE '%attendance%'
    `);
    console.log('Found attendance tables:', tableRes.rows.map(r => r.table_name));

    await query('TRUNCATE TABLE hrms.attendance_raw_punches RESTART IDENTITY CASCADE');
    console.log('✅ hrms.attendance_raw_punches truncated successfully.');

    await query('TRUNCATE TABLE hrms.attendance_summary RESTART IDENTITY CASCADE');
    console.log('✅ hrms.attendance_summary truncated successfully.');

    console.log('🎉 Attendance data truncation complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error truncating attendance tables:', err);
    process.exit(1);
  }
}

truncateAttendanceTables();
