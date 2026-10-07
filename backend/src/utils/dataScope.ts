import { query } from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth';

export interface DataScopeContext {
  employeeId: string | null;
  branchId: string | null;
  departmentId: string | null;
  companyId: string | null;
  roleId: string | null;
  dataScope: 'SELF' | 'REPORTING' | 'DEPARTMENT' | 'BRANCH' | 'ALL' | 'NONE';
  isSuperAdmin: boolean;
}

/**
 * Resolves logged-in employee context and the data_scope assigned to their role
 * for a specific module or permission.
 */
export async function getEmployeeDataScope(
  req: AuthenticatedRequest,
  moduleName?: string,
  permissionNameOrId?: string
): Promise<DataScopeContext> {
  const isSuper = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  if (isSuper) {
    return {
      employeeId: null,
      branchId: null,
      departmentId: null,
      companyId: req.user?.companyId || null,
      roleId: null,
      dataScope: 'ALL',
      isSuperAdmin: true,
    };
  }

  if (!req.user || !req.user.email) {
    return {
      employeeId: null,
      branchId: null,
      departmentId: null,
      companyId: req.user?.companyId || null,
      roleId: null,
      dataScope: 'NONE',
      isSuperAdmin: false,
    };
  }

  try {
    const userEmpId = req.user?.employeeId || null;
    const userEmail = (req.user?.email || '').trim();

    const empRes = await query(
      `SELECT e.id, e.branch_id, e.department_id, e.company_id, e.role_id, r.name as role_name
       FROM hrms.employees e 
       LEFT JOIN hrms.roles r ON e.role_id = r.id
       WHERE (
         ($1::uuid IS NOT NULL AND e.id = $1::uuid)
         OR LOWER(e.email) = LOWER($2)
       ) AND e.status = 'ACTIVE' 
       LIMIT 1`,
      [userEmpId, userEmail]
    );

    if (empRes.rows.length === 0) {
      return {
        employeeId: null,
        branchId: null,
        departmentId: null,
        companyId: req.user?.companyId || null,
        roleId: null,
        dataScope: 'NONE',
        isSuperAdmin: false,
      };
    }

    const emp = empRes.rows[0];
    let dataScope: 'SELF' | 'REPORTING' | 'DEPARTMENT' | 'BRANCH' | 'ALL' | 'NONE' = 'SELF';

    if (emp.role_id) {
      let permSql = `
        SELECT rp.data_scope, p.name 
        FROM hrms.role_permissions rp
        JOIN hrms.permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = $1
      `;
      const permParams: any[] = [emp.role_id];

      if (permissionNameOrId) {
        const cleanPerm = permissionNameOrId.toLowerCase().trim();
        const parts = cleanPerm.split('_');
        let altPerm = cleanPerm;
        if (parts.length === 2) {
          altPerm = `${parts[1]}_${parts[0]}`;
        }
        permSql += ` AND (p.id::text = $2 OR LOWER(p.name) = LOWER($2) OR LOWER(p.name) = LOWER($3) OR LOWER(p.name) = LOWER($2 || '_summary') OR LOWER(p.name) = LOWER($2 || '_view') OR LOWER(p.name) = LOWER('view_' || $2) OR p.name = '*')`;
        permParams.push(cleanPerm, altPerm);
      } else if (moduleName) {
        const cleanMod = moduleName.toLowerCase().trim();
        permSql += ` AND (LOWER(p.name) = LOWER($2) OR LOWER(p.name) = LOWER($2 || '_view') OR LOWER(p.name) = LOWER('view_' || $2) OR LOWER(p.module) = LOWER($2) OR LOWER(p.name) LIKE LOWER($3) OR p.name = '*')`;
        permParams.push(cleanMod, `%${cleanMod}%`);
      }

      permSql += ` ORDER BY 
        CASE 
          WHEN LOWER(p.name) LIKE '%view%' OR LOWER(p.name) LIKE 'view_%' THEN 1 
          WHEN LOWER(p.name) LIKE '%summary%' THEN 2 
          ELSE 3 
        END ASC LIMIT 1`;

      const permRes = await query(permSql, permParams);
      if (permRes.rows.length === 0) {
        dataScope = 'NONE';
      } else {
        const scopeVal = String(permRes.rows[0].data_scope || '').toUpperCase().trim();
        if (['SELF', 'S'].includes(scopeVal)) dataScope = 'SELF';
        else if (['REPORTING', 'TEAM', 'T'].includes(scopeVal)) dataScope = 'REPORTING';
        else if (['DEPARTMENT', 'DEPT', 'D'].includes(scopeVal)) dataScope = 'DEPARTMENT';
        else if (['BRANCH', 'B'].includes(scopeVal)) dataScope = 'BRANCH';
        else if (['ALL', 'A'].includes(scopeVal)) dataScope = 'ALL';
        else if (['NONE', 'N'].includes(scopeVal)) dataScope = 'NONE';
        else dataScope = 'SELF';
      }
    } else {
      dataScope = 'NONE';
    }

    return {
      employeeId: emp.id,
      branchId: emp.branch_id,
      departmentId: emp.department_id,
      companyId: emp.company_id,
      roleId: emp.role_id,
      dataScope,
      isSuperAdmin: false,
    };
  } catch (err) {
    console.error('[DataScope] Error resolving employee data scope:', err);
    return {
      employeeId: null,
      branchId: null,
      departmentId: null,
      companyId: req.user?.companyId || null,
      roleId: null,
      dataScope: 'NONE',
      isSuperAdmin: false,
    };
  }
}

/**
 * Builds dynamic SQL filter clause based on DataScopeContext.
 */
export function buildDataScopeCondition(
  scopeCtx: DataScopeContext,
  tableAlias: string = 'e',
  empIdCol: string = 'id',
  startingParamIdx: number = 1
): { whereSql: string; params: any[]; nextParamIdx: number } {
  if (scopeCtx.isSuperAdmin || scopeCtx.dataScope === 'ALL') {
    return { whereSql: '', params: [], nextParamIdx: startingParamIdx };
  }

  if (scopeCtx.dataScope === 'NONE') {
    return { whereSql: '1=0', params: [], nextParamIdx: startingParamIdx };
  }

  const cleanAlias = tableAlias ? tableAlias.replace(/\.$/, '') : '';
  const empCol = cleanAlias ? `${cleanAlias}.${empIdCol}` : empIdCol;

  if (scopeCtx.dataScope === 'SELF') {
    if (!scopeCtx.employeeId) {
      return { whereSql: '1=0', params: [], nextParamIdx: startingParamIdx };
    }
    return {
      whereSql: `${empCol} = $${startingParamIdx}`,
      params: [scopeCtx.employeeId],
      nextParamIdx: startingParamIdx + 1,
    };
  }

  if (scopeCtx.dataScope === 'REPORTING') {
    if (!scopeCtx.employeeId) {
      return { whereSql: '1=0', params: [], nextParamIdx: startingParamIdx };
    }
    if (empIdCol === 'id') {
      const aliasPrefix = cleanAlias ? `${cleanAlias}.` : '';
      return {
        whereSql: `(${aliasPrefix}id = $${startingParamIdx} OR ${aliasPrefix}reporting_to_id = $${startingParamIdx})`,
        params: [scopeCtx.employeeId],
        nextParamIdx: startingParamIdx + 1,
      };
    } else {
      return {
        whereSql: `${empCol} IN (SELECT id FROM hrms.employees WHERE id = $${startingParamIdx} OR reporting_to_id = $${startingParamIdx})`,
        params: [scopeCtx.employeeId],
        nextParamIdx: startingParamIdx + 1,
      };
    }
  }

  if (scopeCtx.dataScope === 'DEPARTMENT') {
    if (!scopeCtx.departmentId) {
      if (!scopeCtx.employeeId) return { whereSql: '1=0', params: [], nextParamIdx: startingParamIdx };
      return {
        whereSql: `${empCol} = $${startingParamIdx}`,
        params: [scopeCtx.employeeId],
        nextParamIdx: startingParamIdx + 1,
      };
    }
    if (empIdCol === 'id' && cleanAlias) {
      return {
        whereSql: `${cleanAlias}.department_id = $${startingParamIdx}`,
        params: [scopeCtx.departmentId],
        nextParamIdx: startingParamIdx + 1,
      };
    } else {
      return {
        whereSql: `${empCol} IN (SELECT id FROM hrms.employees WHERE department_id = $${startingParamIdx})`,
        params: [scopeCtx.departmentId],
        nextParamIdx: startingParamIdx + 1,
      };
    }
  }

  if (scopeCtx.dataScope === 'BRANCH') {
    if (!scopeCtx.branchId) {
      if (!scopeCtx.employeeId) return { whereSql: '1=0', params: [], nextParamIdx: startingParamIdx };
      return {
        whereSql: `${empCol} = $${startingParamIdx}`,
        params: [scopeCtx.employeeId],
        nextParamIdx: startingParamIdx + 1,
      };
    }
    if (empIdCol === 'id' && cleanAlias) {
      return {
        whereSql: `${cleanAlias}.branch_id = $${startingParamIdx}`,
        params: [scopeCtx.branchId],
        nextParamIdx: startingParamIdx + 1,
      };
    } else {
      return {
        whereSql: `${empCol} IN (SELECT id FROM hrms.employees WHERE branch_id = $${startingParamIdx})`,
        params: [scopeCtx.branchId],
        nextParamIdx: startingParamIdx + 1,
      };
    }
  }

  return { whereSql: '', params: [], nextParamIdx: startingParamIdx };
}
