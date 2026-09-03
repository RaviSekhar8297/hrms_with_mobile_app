import { query } from '../config/db';

async function runRawPunchesProcessing() {
  console.log('🚀 Truncating hrms.attendance_summary and re-processing raw punches with formatted strings...');

  try {
    // 1. Truncate existing summary data
    await query('TRUNCATE TABLE hrms.attendance_summary RESTART IDENTITY CASCADE');
    console.log('🧹 Cleaned hrms.attendance_summary table.');

    // 2. Fetch raw punches formatted as YYYY-MM-DD HH24:MI:SS
    const rawRes = await query(`
      SELECT company_id, employee_id, to_char(punch_time, 'YYYY-MM-DD HH24:MI:SS') as punch_time_str
      FROM hrms.attendance_raw_punches
      WHERE employee_id IS NOT NULL AND punch_time IS NOT NULL
      ORDER BY punch_time ASC
    `);

    console.log(`📊 Found ${rawRes.rows.length} total raw punch records to process.`);

    if (rawRes.rows.length === 0) {
      console.log('⚠️ No raw punches found. Exiting script.');
      process.exit(0);
    }

    // 3. Fetch shift masters for company thresholds & shift times
    const shiftRes = await query(`
      SELECT id, company_id, start_time, end_time, grace_in_minutes, min_half_day_minutes, min_full_day_minutes
      FROM hrms.shift_masters
      WHERE is_active = true OR is_active IS NULL
    `);

    const companyShiftMap = new Map<string, {
      id: string;
      startTime: string;
      endTime: string;
      graceMins: number;
      fullDayMins: number;
      halfDayMins: number;
    }>();

    for (const s of shiftRes.rows) {
      if (!companyShiftMap.has(s.company_id)) {
        companyShiftMap.set(s.company_id, {
          id: s.id,
          startTime: s.start_time || '09:30:00',
          endTime: s.end_time || '18:30:00',
          graceMins: parseInt(s.grace_in_minutes, 10) || 15,
          fullDayMins: parseInt(s.min_full_day_minutes, 10) || 420,
          halfDayMins: parseInt(s.min_half_day_minutes, 10) || 240
        });
      }
    }

    // Group punches by key: `companyId_empId_YYYY-MM-DD`
    const groupMap = new Map<string, {
      companyId: string;
      employeeId: string;
      dateStr: string;
      punches: Array<string>;
    }>();

    for (const r of rawRes.rows) {
      const pStr = r.punch_time_str;
      if (!pStr || !pStr.includes(' ')) continue;

      const dateStr = pStr.split(' ')[0];
      const key = `${r.company_id}_${r.employee_id}_${dateStr}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          companyId: r.company_id,
          employeeId: r.employee_id,
          dateStr,
          punches: []
        });
      }
      groupMap.get(key)!.punches.push(pStr);
    }

    console.log(`📦 Grouped raw punches into ${groupMap.size} unique employee-days.`);

    // Prepare rows for bulk insert
    const summaryRows: any[] = [];

    for (const [, group] of groupMap.entries()) {
      group.punches.sort(); // Lexicographical sort works for YYYY-MM-DD HH24:MI:SS

      const firstInStr = group.punches[0];
      const lastOutStr = group.punches.length > 1 ? group.punches[group.punches.length - 1] : firstInStr;

      const [, fTime] = firstInStr.split(' ');
      const [, lTime] = lastOutStr.split(' ');

      const [fh, fm] = fTime.split(':').map(Number);
      const [lh, lm] = lTime.split(':').map(Number);

      const firstInMins = fh * 60 + fm;
      const lastOutMins = lh * 60 + lm;

      const fDateObj = new Date(firstInStr.replace(' ', 'T') + 'Z');
      const lDateObj = new Date(lastOutStr.replace(' ', 'T') + 'Z');
      const workedMinutes = Math.round((lDateObj.getTime() - fDateObj.getTime()) / 60000);

      const shiftConfig = companyShiftMap.get(group.companyId) || {
        id: null,
        startTime: '09:30:00',
        endTime: '18:30:00',
        graceMins: 15,
        fullDayMins: 420,
        halfDayMins: 240
      };

      const [sh, sm] = (shiftConfig.startTime || '09:30:00').split(':').map(Number);
      const [eh, em] = (shiftConfig.endTime || '18:30:00').split(':').map(Number);

      const shiftStartMins = sh * 60 + sm;
      const shiftEndMins = eh * 60 + em;
      const graceLimitMins = shiftStartMins + (shiftConfig.graceMins || 15);

      // Late Minutes: Arrival past shift start + grace
      let lateMinutes = 0;
      if (firstInMins > graceLimitMins) {
        lateMinutes = firstInMins - shiftStartMins;
      }

      // Overtime Minutes: Early Arrival Overtime + Late Departure Overtime
      let overtimeMinutes = 0;

      // 1. Early Arrival Overtime (Punching in before shift start time e.g., 09:10 vs 09:30 = 20 mins)
      if (firstInMins < shiftStartMins) {
        overtimeMinutes += (shiftStartMins - firstInMins);
      }

      // 2. Late Departure Overtime (Punching out after shift end time e.g., 19:05 vs 18:30 = 35 mins)
      if (group.punches.length > 1 && lastOutMins > shiftEndMins) {
        overtimeMinutes += (lastOutMins - shiftEndMins);
      }

      // Determine Status
      let status = 'ABSENT';
      if (workedMinutes >= shiftConfig.fullDayMins) {
        status = 'PRESENT';
      } else if (workedMinutes >= shiftConfig.halfDayMins) {
        status = 'HALF_DAY';
      } else {
        status = 'ABSENT';
      }

      summaryRows.push([
        group.companyId,
        group.employeeId,
        group.dateStr,
        shiftConfig.id,
        fDateObj.toISOString(),
        lDateObj.toISOString(),
        status,
        workedMinutes,
        lateMinutes,
        overtimeMinutes,
        group.punches.length
      ]);
    }

    // High-speed Chunked Bulk UPSERT (500 rows per chunk)
    const chunkSize = 500;
    let insertedTotal = 0;

    for (let i = 0; i < summaryRows.length; i += chunkSize) {
      const chunk = summaryRows.slice(i, i + chunkSize);

      const valuesSql: string[] = [];
      const queryParams: any[] = [];
      let paramIdx = 1;

      for (const row of chunk) {
        valuesSql.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6}, $${paramIdx+7}, $${paramIdx+8}, $${paramIdx+9}, $${paramIdx+10}, NOW())`);
        queryParams.push(...row);
        paramIdx += 11;
      }

      const bulkQuery = `
        INSERT INTO hrms.attendance_summary (
          company_id, employee_id, attendance_date, shift_id,
          first_in, last_out, status, worked_minutes, late_minutes, overtime_minutes, punch_count, processed_at
        ) VALUES ${valuesSql.join(', ')}
        ON CONFLICT (employee_id, attendance_date)
        DO UPDATE SET
          first_in = EXCLUDED.first_in,
          last_out = EXCLUDED.last_out,
          status = EXCLUDED.status,
          worked_minutes = EXCLUDED.worked_minutes,
          late_minutes = EXCLUDED.late_minutes,
          overtime_minutes = EXCLUDED.overtime_minutes,
          punch_count = EXCLUDED.punch_count,
          processed_at = NOW()
      `;

      await query(bulkQuery, queryParams);
      insertedTotal += chunk.length;
      console.log(`⚡ Bulk processed ${insertedTotal} / ${summaryRows.length} employee-days...`);
    }

    console.log(`🎉 SUCCESS: Fully re-synced ${insertedTotal} attendance summary records into hrms.attendance_summary!`);
  } catch (err) {
    console.error('❌ Error in bulk raw punches processing:', err);
  } finally {
    process.exit(0);
  }
}

runRawPunchesProcessing();
