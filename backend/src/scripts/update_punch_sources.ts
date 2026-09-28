import { query } from '../config/db';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    console.log('🔄 Updating punch sources and cleaning invalid location names in database...');

    // 1. Update punches with no image and no lat/long to 'BIOMETRIC'
    const res1 = await query(`
      UPDATE hrms.attendance_raw_punches
      SET source = 'BIOMETRIC'
      WHERE (image_url IS NULL OR TRIM(image_url) = '')
        AND (latitude IS NULL OR longitude IS NULL)
        AND (source ILIKE 'mobile%' OR source IS NULL OR source = '')
    `);
    console.log(`✅ Updated ${res1.rowCount || 0} punches to BIOMETRIC (no image & no GPS coordinates).`);

    // 2. Update punches with image OR lat/long to 'MobilePunched'
    const res2 = await query(`
      UPDATE hrms.attendance_raw_punches
      SET source = 'MobilePunched'
      WHERE ((image_url IS NOT NULL AND TRIM(image_url) <> '') OR (latitude IS NOT NULL AND longitude IS NOT NULL))
        AND (source IS NULL OR source = '' OR source ILIKE 'biometric%')
    `);
    console.log(`✅ Updated ${res2.rowCount || 0} punches to MobilePunched (has image or GPS coordinates).`);

    // 3. Clean invalid location_names like 'IN', 'OUT', 'AUTO'
    const res3 = await query(`
      UPDATE hrms.attendance_raw_punches
      SET location_name = NULL
      WHERE location_name IN ('IN', 'OUT', 'AUTO')
    `);
    console.log(`✅ Cleaned ${res3.rowCount || 0} invalid location_names.`);

    console.log('🎉 Database update completed successfully!');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error updating punch sources:', e);
    process.exit(1);
  }
}

run();
