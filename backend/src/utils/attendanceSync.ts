import { query } from '../config/db';

/**
 * Recalculates and upserts employee daily attendance summary
 * taking into account timezone and shift rules.
 */
export async function updateEmployeeDailySummary(
  companyId: string,
  employeeId: string,
  dateStr: string,
  timezone: string = 'Asia/Kolkata'
) {
  try {
    if (!companyId || !employeeId || !dateStr) return;

    // 1. Fetch raw punches for this employee on this date
    const rawRes = await query(
      `SELECT company_id, employee_id, punch_time, raw_punch_time, direction, source
       FROM hrms.attendance_raw_punches
       WHERE company_id = $1 AND employee_id = $2 
         AND (
           raw_punch_time LIKE $3 || '%' 
           OR (punch_time AT TIME ZONE $4)::date = $3::date
         )
       ORDER BY punch_time ASC`,
      [companyId, employeeId, dateStr, timezone]
    );

    if (rawRes.rows.length === 0) return;

    // Sort punches chronologically
    const sortedPunches = rawRes.rows.sort(
      (a, b) => new Date(a.punch_time).getTime() - new Date(b.punch_time).getTime()
    );

    const firstInPunch = sortedPunches[0];
    const lastOutPunch = sortedPunches.length > 1 ? sortedPunches[sortedPunches.length - 1] : firstInPunch;

    const firstInTime = firstInPunch.punch_time;
    const lastOutTime = lastOutPunch.punch_time;

    const fDateObj = new Date(firstInTime);
    const lDateObj = new Date(lastOutTime);
    const workedMinutes = Math.max(0, Math.round((lDateObj.getTime() - fDateObj.getTime()) / 60000));

    // Fetch shift master for company
    const shiftRes = await query(
      `SELECT id, start_time, end_time, grace_in_minutes, min_half_day_minutes, min_full_day_minutes
       FROM hrms.shift_masters
       WHERE (company_id = $1 AND (is_active = true OR is_active IS NULL))
       ORDER BY is_active DESC LIMIT 1`,
      [companyId]
    );

    const shift = shiftRes.rows[0] || {
      id: null,
      start_time: '09:30:00',
      end_time: '18:30:00',
      grace_in_minutes: 15,
      min_full_day_minutes: 420,
      min_half_day_minutes: 240
    };

    const graceMins = parseInt(shift.grace_in_minutes || 15, 10);
    const fullDayMins = parseInt(shift.min_full_day_minutes || 420, 10);
    const halfDayMins = parseInt(shift.min_half_day_minutes || 240, 10);

    // Determine Status
    let status = 'PRESENT';
    if (workedMinutes >= fullDayMins) {
      status = 'PRESENT';
    } else if (workedMinutes >= halfDayMins) {
      status = 'HALF_DAY';
    } else {
      status = 'PRESENT';
    }

    // Calculate Late Minutes
    let lateMinutes = 0;
    try {
      const [sh, sm] = (shift.start_time || '09:30:00').split(':').map(Number);
      const firstInLocal = new Date(firstInTime).toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
      const [fh, fm] = firstInLocal.split(':').map(Number);
      const firstInMins = fh * 60 + fm;
      const shiftStartMins = sh * 60 + sm;

      if (firstInMins > shiftStartMins + graceMins) {
        lateMinutes = firstInMins - shiftStartMins;
      }
    } catch (e) {
      // Fallback if timezone string is invalid
    }

    // Upsert into hrms.attendance_summary
    await query(
      `INSERT INTO hrms.attendance_summary 
       (company_id, employee_id, attendance_date, shift_id, first_in, last_out, worked_minutes, late_minutes, status, punch_count, processed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (employee_id, attendance_date) 
       DO UPDATE SET
         first_in = EXCLUDED.first_in,
         last_out = EXCLUDED.last_out,
         worked_minutes = EXCLUDED.worked_minutes,
         late_minutes = EXCLUDED.late_minutes,
         status = EXCLUDED.status,
         punch_count = EXCLUDED.punch_count,
         processed_at = NOW()`,
      [
        companyId,
        employeeId,
        dateStr,
        shift.id,
        firstInTime,
        lastOutTime,
        workedMinutes,
        lateMinutes,
        status,
        sortedPunches.length
      ]
    );

    console.log(`✅ [SUMMARY UPDATED] Employee ${employeeId} on ${dateStr}: Status ${status}, Worked ${workedMinutes}m`);
  } catch (err) {
    console.error('Error updating employee daily summary:', err);
  }
}
