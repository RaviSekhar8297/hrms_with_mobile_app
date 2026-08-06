const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=hrms';

async function runPayrollMigration() {
  console.log(`Connecting to database to run payroll migration...`);
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to database successfully!');

    // 1. Create tables
    const createTablesQuery = `
      -- 1. Salary Slabs Table
      CREATE TABLE IF NOT EXISTS hrms.salary_slabs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE, -- Nullable for global defaults
          slab_name VARCHAR(150) NOT NULL,
          min_gross DECIMAL(12, 2) NOT NULL,
          max_gross DECIMAL(12, 2) NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 2. Salary Components Table
      CREATE TABLE IF NOT EXISTS hrms.salary_components (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE, -- Nullable for global defaults
          component_code VARCHAR(50) NOT NULL, -- e.g. BASIC, HRA, PF
          component_name VARCHAR(150) NOT NULL,
          component_type VARCHAR(30) NOT NULL CHECK (component_type IN ('EARNINGS', 'DEDUCTION', 'REIMBURSEMENT')),
          is_statutory BOOLEAN DEFAULT FALSE,
          is_taxable BOOLEAN DEFAULT TRUE,
          display_order INTEGER DEFAULT 1,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_company_component UNIQUE (company_id, component_code)
      );

      -- 3. Calculation Types Table
      CREATE TABLE IF NOT EXISTS hrms.calculation_types (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type_name VARCHAR(100) UNIQUE NOT NULL, -- FixedAmount, PercentageOfGross, PercentageOfComponent, CustomFormula
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 4. Salary Component Configurations Table
      CREATE TABLE IF NOT EXISTS hrms.salary_component_configurations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES hrms.companies(id) ON DELETE CASCADE, -- Nullable for global defaults
          slab_id UUID NOT NULL REFERENCES hrms.salary_slabs(id) ON DELETE CASCADE,
          component_code VARCHAR(50) NOT NULL,
          calculation_type_id UUID NOT NULL REFERENCES hrms.calculation_types(id),
          calculation_value DECIMAL(12, 4) NOT NULL,
          depends_on_component VARCHAR(50),
          formula_expression TEXT,
          employee_type VARCHAR(50) DEFAULT 'ALL', -- ALL, Permanent, Temporary, Stipend
          is_prorata BOOLEAN DEFAULT TRUE,
          min_cap DECIMAL(12, 2) DEFAULT 0.00,
          max_cap DECIMAL(12, 2) DEFAULT NULL,
          effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
          effective_to DATE,
          display_order INTEGER DEFAULT 1,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    console.log('Creating payroll engine tables...');
    await client.query(createTablesQuery);
    console.log('Tables created successfully!');

    // 2. Seed Calculation Types
    console.log('Seeding Calculation Types...');
    const seedCalcTypes = `
      INSERT INTO hrms.calculation_types (type_name, description) VALUES
      ('FixedAmount', 'Fixed monthly currency value')
      ON CONFLICT (type_name) DO UPDATE SET description = EXCLUDED.description;

      INSERT INTO hrms.calculation_types (type_name, description) VALUES
      ('PercentageOfGross', 'Percentage value based on Gross Salary')
      ON CONFLICT (type_name) DO UPDATE SET description = EXCLUDED.description;

      INSERT INTO hrms.calculation_types (type_name, description) VALUES
      ('PercentageOfComponent', 'Percentage value based on another salary component')
      ON CONFLICT (type_name) DO UPDATE SET description = EXCLUDED.description;

      INSERT INTO hrms.calculation_types (type_name, description) VALUES
      ('CustomFormula', 'Custom math expression parsing')
      ON CONFLICT (type_name) DO UPDATE SET description = EXCLUDED.description;
    `;
    await client.query(seedCalcTypes);

    // 3. Seed Default Global Components (using NULL for company_id to make them global defaults)
    console.log('Seeding Global Default Components...');
    const seedComponents = `
      INSERT INTO hrms.salary_components (company_id, component_code, component_name, component_type, is_statutory, is_taxable, display_order, is_active) VALUES
      (NULL, 'BASIC', 'Basic Salary', 'EARNINGS', FALSE, TRUE, 1, TRUE),
      (NULL, 'HRA', 'House Rent Allowance', 'EARNINGS', FALSE, TRUE, 2, TRUE),
      (NULL, 'MA', 'Medical Allowance', 'EARNINGS', FALSE, TRUE, 3, TRUE),
      (NULL, 'CA', 'Conveyance Allowance', 'EARNINGS', FALSE, TRUE, 4, TRUE),
      (NULL, 'SA', 'Special Allowance', 'EARNINGS', FALSE, TRUE, 99, TRUE),
      (NULL, 'TDS', 'Tax Deducted at Source', 'DEDUCTION', TRUE, FALSE, 101, TRUE),
      (NULL, 'PF', 'Provident Fund (Employee)', 'DEDUCTION', TRUE, FALSE, 102, TRUE),
      (NULL, 'ESI', 'Employee State Insurance', 'DEDUCTION', TRUE, FALSE, 103, TRUE),
      (NULL, 'PT', 'Professional Tax', 'DEDUCTION', TRUE, FALSE, 104, TRUE)
      ON CONFLICT ON CONSTRAINT unique_company_component DO NOTHING;
    `;
    await client.query(seedComponents);

    // 4. Seed sample salary slabs and configurations if none exist
    const checkSlabs = await client.query('SELECT COUNT(*) FROM hrms.salary_slabs');
    if (parseInt(checkSlabs.rows[0].count) === 0) {
      console.log('Seeding Default Slabs and Configurations...');
      
      // Get the default company if it exists, to seed configs correctly, or leave as NULL
      const compRes = await client.query('SELECT id FROM hrms.companies LIMIT 1');
      const companyId = compRes.rows.length > 0 ? compRes.rows[0].id : null;

      // Create Slabs
      const slabsQuery = `
        INSERT INTO hrms.salary_slabs (company_id, slab_name, min_gross, max_gross, description) VALUES
        ($1, 'Semi-Skilled Slab', 10000, 25000, 'Standard slab for semi-skilled positions'),
        ($1, 'Skilled Slab', 25000, 50000, 'Standard slab for skilled positions'),
        ($1, 'Executive Slab', 50000, 200000, 'Standard slab for executive and management positions')
        RETURNING id, slab_name;
      `;
      const slabRows = await client.query(slabsQuery, [companyId]);

      // Resolve Calculation Type IDs
      const typeRes = await client.query('SELECT id, type_name FROM hrms.calculation_types');
      const calcTypes = {};
      typeRes.rows.forEach(r => {
        calcTypes[r.type_name] = r.id;
      });

      // Map configurations to Slabs
      for (const slab of slabRows.rows) {
        if (slab.slab_name === 'Semi-Skilled Slab') {
          // BASIC: 50% of Gross
          await client.query(
            `INSERT INTO hrms.salary_component_configurations (company_id, slab_id, component_code, calculation_type_id, calculation_value, display_order)
             VALUES ($1, $2, 'BASIC', $3, 50, 1)`,
            [companyId, slab.id, calcTypes['PercentageOfGross']]
          );
          // HRA: 40% of BASIC
          await client.query(
            `INSERT INTO hrms.salary_component_configurations (company_id, slab_id, component_code, calculation_type_id, calculation_value, depends_on_component, display_order)
             VALUES ($1, $2, 'HRA', $3, 40, 'BASIC', 2)`,
            [companyId, slab.id, calcTypes['PercentageOfComponent']]
          );
          // MA: 1250 Fixed
          await client.query(
            `INSERT INTO hrms.salary_component_configurations (company_id, slab_id, component_code, calculation_type_id, calculation_value, display_order)
             VALUES ($1, $2, 'MA', $3, 1250, 3)`,
            [companyId, slab.id, calcTypes['FixedAmount']]
          );
          // CA: 1600 Fixed
          await client.query(
            `INSERT INTO hrms.salary_component_configurations (company_id, slab_id, component_code, calculation_type_id, calculation_value, display_order)
             VALUES ($1, $2, 'CA', $3, 1600, 4)`,
            [companyId, slab.id, calcTypes['FixedAmount']]
          );
        } else if (slab.slab_name === 'Skilled Slab') {
          // BASIC: 50% of Gross
          await client.query(
            `INSERT INTO hrms.salary_component_configurations (company_id, slab_id, component_code, calculation_type_id, calculation_value, display_order)
             VALUES ($1, $2, 'BASIC', $3, 50, 1)`,
            [companyId, slab.id, calcTypes['PercentageOfGross']]
          );
          // HRA: 40% of BASIC
          await client.query(
            `INSERT INTO hrms.salary_component_configurations (company_id, slab_id, component_code, calculation_type_id, calculation_value, depends_on_component, display_order)
             VALUES ($1, $2, 'HRA', $3, 40, 'BASIC', 2)`,
            [companyId, slab.id, calcTypes['PercentageOfComponent']]
          );
          // MA: 1500 Fixed
          await client.query(
            `INSERT INTO hrms.salary_component_configurations (company_id, slab_id, component_code, calculation_type_id, calculation_value, display_order)
             VALUES ($1, $2, 'MA', $3, 1500, 3)`,
            [companyId, slab.id, calcTypes['FixedAmount']]
          );
          // CA: 2000 Fixed
          await client.query(
            `INSERT INTO hrms.salary_component_configurations (company_id, slab_id, component_code, calculation_type_id, calculation_value, display_order)
             VALUES ($1, $2, 'CA', $3, 2000, 4)`,
            [companyId, slab.id, calcTypes['FixedAmount']]
          );
        } else if (slab.slab_name === 'Executive Slab') {
          // BASIC: 50% of Gross
          await client.query(
            `INSERT INTO hrms.salary_component_configurations (company_id, slab_id, component_code, calculation_type_id, calculation_value, display_order)
             VALUES ($1, $2, 'BASIC', $3, 50, 1)`,
            [companyId, slab.id, calcTypes['PercentageOfGross']]
          );
          // HRA: 50% of BASIC
          await client.query(
            `INSERT INTO hrms.salary_component_configurations (company_id, slab_id, component_code, calculation_type_id, calculation_value, depends_on_component, display_order)
             VALUES ($1, $2, 'HRA', $3, 50, 'BASIC', 2)`,
            [companyId, slab.id, calcTypes['PercentageOfComponent']]
          );
          // MA: 2500 Fixed
          await client.query(
            `INSERT INTO hrms.salary_component_configurations (company_id, slab_id, component_code, calculation_type_id, calculation_value, display_order)
             VALUES ($1, $2, 'MA', $3, 2500, 3)`,
            [companyId, slab.id, calcTypes['FixedAmount']]
          );
          // CA: 3000 Fixed
          await client.query(
            `INSERT INTO hrms.salary_component_configurations (company_id, slab_id, component_code, calculation_type_id, calculation_value, display_order)
             VALUES ($1, $2, 'CA', $3, 3000, 4)`,
            [companyId, slab.id, calcTypes['FixedAmount']]
          );
        }
      }
    }

    console.log('\n✅ Payroll Engine migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration Failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await client.end();
  }
}

runPayrollMigration();
