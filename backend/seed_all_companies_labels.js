const { Client } = require('pg');
require('dotenv').config();

const labelsToInsert = [
  // 1. ● CIRCLE — General Work / Task
  { name: 'New Task', color: '#2563eb', category: 'General Work / Task' },
  { name: 'In Progress', color: '#16a34a', category: 'General Work / Task' },
  { name: 'Pending', color: '#eab308', category: 'General Work / Task' },
  { name: 'Urgent Task', color: '#f97316', category: 'General Work / Task' },
  { name: 'Critical Task', color: '#dc2626', category: 'General Work / Task' },
  { name: 'Improvement', color: '#9333ea', category: 'General Work / Task' },
  { name: 'Blocked', color: '#18181b', category: 'General Work / Task' },

  // 2. ♥ HEART — People / Employee / Customer
  { name: 'Employee Request', color: '#2563eb', category: 'People / Employee / Customer' },
  { name: 'Employee Support', color: '#16a34a', category: 'People / Employee / Customer' },
  { name: 'Employee Feedback', color: '#eab308', category: 'People / Employee / Customer' },
  { name: 'Employee Escalation', color: '#f97316', category: 'People / Employee / Customer' },
  { name: 'Employee Issue', color: '#dc2626', category: 'People / Employee / Customer' },
  { name: 'Employee Engagement', color: '#9333ea', category: 'People / Employee / Customer' },
  { name: 'Customer / Client', color: '#ec4899', category: 'People / Employee / Customer' },

  // 3. ★ STAR — Priority / Important
  { name: 'Normal Priority', color: '#16a34a', category: 'Priority / Important' },
  { name: 'Important', color: '#2563eb', category: 'Priority / Important' },
  { name: 'High Priority', color: '#eab308', category: 'Priority / Important' },
  { name: 'Urgent Priority', color: '#f97316', category: 'Priority / Important' },
  { name: 'Critical Priority', color: '#dc2626', category: 'Priority / Important' },
  { name: 'Management Priority', color: '#9333ea', category: 'Priority / Important' },
  { name: 'Featured', color: '#ec4899', category: 'Priority / Important' },

  // 4. ◆ DIAMOND — Project / Planning
  { name: 'Project', color: '#2563eb', category: 'Project / Planning' },
  { name: 'Milestone', color: '#16a34a', category: 'Project / Planning' },
  { name: 'Planning', color: '#eab308', category: 'Project / Planning' },
  { name: 'Deliverable', color: '#f97316', category: 'Project / Planning' },
  { name: 'Project Risk', color: '#dc2626', category: 'Project / Planning' },
  { name: 'Requirement', color: '#9333ea', category: 'Project / Planning' },
  { name: 'Dependency', color: '#06b6d4', category: 'Project / Planning' },

  // 5. 🛡 SHIELD — Security / Control / Compliance
  { name: 'Security', color: '#16a34a', category: 'Security / Control / Compliance' },
  { name: 'Access Control', color: '#2563eb', category: 'Security / Control / Compliance' },
  { name: 'Compliance', color: '#eab308', category: 'Security / Control / Compliance' },
  { name: 'Risk', color: '#f97316', category: 'Security / Control / Compliance' },
  { name: 'Security Critical', color: '#dc2626', category: 'Security / Control / Compliance' },
  { name: 'Policy', color: '#9333ea', category: 'Security / Control / Compliance' },
  { name: 'Confidential', color: '#18181b', category: 'Security / Control / Compliance' },
];

async function seedAllCompanies() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to DB...');

    const compRes = await client.query(`SELECT id, name FROM hrms.companies`);
    const companies = compRes.rows;

    for (const comp of companies) {
      console.log(`Seeding labels for company: ${comp.name} (${comp.id})`);
      for (const item of labelsToInsert) {
        await client.query(
          `INSERT INTO hrms.task_labels (company_id, label_name, label_color, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (company_id, label_name) 
           DO UPDATE SET label_color = EXCLUDED.label_color, description = EXCLUDED.description, updated_at = NOW()`,
          [comp.id, item.name, item.color, item.category]
        );
      }
    }

    console.log('SUCCESSFULLY SEEDED LABELS FOR ALL COMPANIES!');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

seedAllCompanies();
