"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployeeDataScope = getEmployeeDataScope;
exports.buildDataScopeCondition = buildDataScopeCondition;
const db_1 = require("../config/db");
/**
 * Resolves logged-in employee context and the data_scope assigned to their role
 * for a specific module or permission.
 */
async function getEmployeeDataScope(req, moduleName, permissionName) {
    const isSuper = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    if (isSuper) {
        return {
            employeeId: null,
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
            departmentId: null,
            companyId: req.user?.companyId || null,
            roleId: null,
            dataScope: 'SELF',
            isSuperAdmin: false,
        };
    }
    try {
        const userEmail = (req.user.email || '').trim();
        const empRes = await (0, db_1.query)(`SELECT e.id, e.department_id, e.company_id, e.role_id, r.name as role_name
       FROM hrms.employees e 
       LEFT JOIN hrms.roles r ON e.role_id = r.id
       WHERE (LOWER(e.email) = LOWER($1) OR LOWER(e.emp_id_code) = LOWER($1))
         AND e.status = 'ACTIVE' 
       LIMIT 1`, [userEmail]);
        if (empRes.rows.length === 0) {
            return {
                employeeId: null,
                departmentId: null,
                companyId: req.user?.companyId || null,
                roleId: null,
                dataScope: 'SELF',
                isSuperAdmin: false,
            };
        }
        const emp = empRes.rows[0];
        let dataScope = 'ALL';
        if (emp.role_id) {
            let permSql = `
        SELECT rp.data_scope 
        FROM hrms.role_permissions rp
        JOIN hrms.permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = $1
      `;
            const permParams = [emp.role_id];
            if (permissionName) {
                permSql += ` AND (LOWER(p.name) = LOWER($2) OR LOWER(p.name) = LOWER($2 || '_summary'))`;
                permParams.push(permissionName);
            }
            else if (moduleName) {
                permSql += ` AND (LOWER(p.name) = LOWER($2) OR LOWER(p.name) = LOWER($2 || '_summary') OR LOWER(p.module) = LOWER($2) OR LOWER(p.name) LIKE LOWER($3))`;
                permParams.push(moduleName, `%${moduleName}%`);
            }
            permSql += ` ORDER BY CASE WHEN UPPER(p.name) LIKE '%SUMMARY' THEN 1 ELSE 2 END ASC LIMIT 1`;
            const permRes = await (0, db_1.query)(permSql, permParams);
            if (permRes.rows.length > 0 && permRes.rows[0].data_scope) {
                const scopeVal = String(permRes.rows[0].data_scope).toUpperCase().trim();
                if (['SELF', 'S'].includes(scopeVal))
                    dataScope = 'SELF';
                else if (['REPORTING', 'TEAM', 'T'].includes(scopeVal))
                    dataScope = 'REPORTING';
                else if (['DEPARTMENT', 'DEPT', 'D'].includes(scopeVal))
                    dataScope = 'DEPARTMENT';
                else if (['ALL', 'A'].includes(scopeVal))
                    dataScope = 'ALL';
            }
        }
        return {
            employeeId: emp.id,
            departmentId: emp.department_id,
            companyId: emp.company_id,
            roleId: emp.role_id,
            dataScope,
            isSuperAdmin: false,
        };
    }
    catch (err) {
        console.error('[DataScope] Error resolving employee data scope:', err);
        return {
            employeeId: null,
            departmentId: null,
            companyId: req.user?.companyId || null,
            roleId: null,
            dataScope: 'SELF',
            isSuperAdmin: false,
        };
    }
}
/**
 * Builds dynamic SQL filter clause based on DataScopeContext.
 */
function buildDataScopeCondition(scopeCtx, tableAlias = 'e', empIdCol = 'id', startingParamIdx = 1) {
    if (scopeCtx.isSuperAdmin || scopeCtx.dataScope === 'ALL') {
        return { whereSql: '', params: [], nextParamIdx: startingParamIdx };
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
        }
        else {
            return {
                whereSql: `${empCol} IN (SELECT id FROM hrms.employees WHERE id = $${startingParamIdx} OR reporting_to_id = $${startingParamIdx})`,
                params: [scopeCtx.employeeId],
                nextParamIdx: startingParamIdx + 1,
            };
        }
    }
    if (scopeCtx.dataScope === 'DEPARTMENT') {
        if (!scopeCtx.departmentId) {
            if (!scopeCtx.employeeId)
                return { whereSql: '1=0', params: [], nextParamIdx: startingParamIdx };
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
        }
        else {
            return {
                whereSql: `${empCol} IN (SELECT id FROM hrms.employees WHERE department_id = $${startingParamIdx})`,
                params: [scopeCtx.departmentId],
                nextParamIdx: startingParamIdx + 1,
            };
        }
    }
    return { whereSql: '', params: [], nextParamIdx: startingParamIdx };
}
