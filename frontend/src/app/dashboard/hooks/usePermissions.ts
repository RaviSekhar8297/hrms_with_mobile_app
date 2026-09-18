'use client';

import { useState, useEffect } from 'react';

export type DataScope = 'SELF' | 'REPORTING' | 'TEAM' | 'DEPARTMENT' | 'ALL';

interface UsePermissionsResult {
  hasPermission: (permissionName?: string) => boolean;
  getPermissionScope: (permissionName?: string) => DataScope;
  isSuperAdmin: boolean;
  permissions: string[];
  roles: string[];
}

/**
 * Shared permissions hook — reads roles & permissions from localStorage.
 * SuperAdmin always gets full access (hasPermission always returns true).
 * Other roles must have the specific permission string present.
 */
export const ORG_PERMISSIONS: Record<string, string> = {
  // Branches
  view_branches: '3ae40d74-efbc-40cb-aa1b-366fd680c345',
  create_branches: '5d99f7b6-85d0-4578-83cd-b01aadc0ddaf',
  edit_branches: 'bf7e6287-e951-4ceb-9289-b0daa8b68e03',
  delete_branches: '522133e2-66d1-4371-ad38-ed72cbd2464b',

  // Departments
  view_departments: 'ab84f994-6d74-4dc1-a371-e396c2e3a8c7',
  create_departments: '2796332c-4260-448c-a354-d2ec375de93c',
  edit_departments: '2bf652b9-6415-4051-b392-a7f29f7bd1cc',
  delete_departments: '5d3edbd5-ca42-42b7-ad8d-ec53891af5b6',

  // Designations
  view_designations: '430845c5-ff81-43b5-a95c-fd19a6ab0f85',
  create_designations: 'd9ce2700-b03f-46e9-8bda-25cf93313ad4',
  edit_designations: 'ace832d7-2831-4fa3-ae7d-f161ef892268',
  delete_designations: 'a598b104-a812-44ce-bcd2-8c6bdbf29557',

  // Companies
  view_companies: '59291778-9d6f-4cdb-8148-1f572e1b659d',
  create_companies: '71141dd4-fbf0-46ca-9d24-766fff7becf1',
  edit_companies: 'e3b9be92-380f-4609-aa64-15a450b631b2',
  delete_companies: 'f0362296-d064-4e4c-8849-b08c2edb7bbe',
};

const REVERSE_ORG_PERMISSIONS: Record<string, string> = Object.entries(ORG_PERMISSIONS).reduce(
  (acc, [name, id]) => {
    acc[id] = name;
    return acc;
  },
  {} as Record<string, string>
);

export function usePermissions(): UsePermissionsResult {
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [scopes, setScopes] = useState<Record<string, DataScope>>({});

  const loadPermissions = () => {
    const storedRoles = localStorage.getItem('roles');
    const storedPermissions = localStorage.getItem('permissions');
    const storedScopes = localStorage.getItem('permissionScopes') || localStorage.getItem('roleScopesState');
    if (storedRoles) {
      try { setRoles(JSON.parse(storedRoles)); } catch { setRoles([]); }
    }
    if (storedPermissions) {
      try { setPermissions(JSON.parse(storedPermissions)); } catch { setPermissions([]); }
    }
    if (storedScopes) {
      try { setScopes(JSON.parse(storedScopes)); } catch { setScopes({}); }
    }
  };

  useEffect(() => {
    loadPermissions();
    window.addEventListener('storage', loadPermissions);
    window.addEventListener('permissionsUpdated', loadPermissions);
    return () => {
      window.removeEventListener('storage', loadPermissions);
      window.removeEventListener('permissionsUpdated', loadPermissions);
    };
  }, []);

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  const hasPermission = (permissionName?: string): boolean => {
    if (!permissionName) return true;   // no guard = always visible
    if (isSuperAdmin) return true;       // SuperAdmin sees everything
    if (permissions.includes('*')) return true;

    // Direct match by Permission Name or Permission ID
    if (permissions.includes(permissionName)) return true;

    // Match by mapped UUID if name was passed, or mapped Name if UUID was passed
    const mappedId = ORG_PERMISSIONS[permissionName];
    if (mappedId && permissions.includes(mappedId)) return true;

    const mappedName = REVERSE_ORG_PERMISSIONS[permissionName];
    if (mappedName && permissions.includes(mappedName)) return true;

    // Intelligent matching for permission aliases (e.g. branch_create vs create_branches vs create_branch)
    const targetLower = (mappedName || permissionName).toLowerCase().trim();
    
    return permissions.some(p => {
      const pLower = p.toLowerCase().trim();
      if (pLower === targetLower) return true;

      // Check reversed words: e.g. branch_create <-> create_branches
      const parts = targetLower.split('_');
      if (parts.length === 2) {
        const reversed = `${parts[1]}_${parts[0]}`;
        if (pLower === reversed || pLower === `${reversed}s` || `${pLower}s` === reversed) return true;
        if (pLower === `${parts[0]}_${parts[1]}s` || `${pLower}s` === `${parts[0]}_${parts[1]}`) return true;
      }

      // Extract action (create/view/edit/delete) and entity (tasks, projects, etc.)
      const isCreate = targetLower.includes('create');
      const isView = targetLower.includes('view') || targetLower.includes('read');
      const isEdit = targetLower.includes('edit') || targetLower.includes('update');
      const isDelete = targetLower.includes('delete') || targetLower.includes('remove');

      if (isCreate && pLower.includes('create')) {
        if ((targetLower.includes('task') && pLower.includes('task')) ||
            (targetLower.includes('project') && pLower.includes('project')) ||
            (targetLower.includes('label') && pLower.includes('label')) ||
            (targetLower.includes('timesheet') && pLower.includes('timesheet')) ||
            (targetLower.includes('workflow') && pLower.includes('workflow'))) {
          return true;
        }
      }

      if (isEdit && pLower.includes('edit')) {
        if ((targetLower.includes('task') && pLower.includes('task')) ||
            (targetLower.includes('project') && pLower.includes('project')) ||
            (targetLower.includes('label') && pLower.includes('label')) ||
            (targetLower.includes('timesheet') && pLower.includes('timesheet')) ||
            (targetLower.includes('workflow') && pLower.includes('workflow'))) {
          return true;
        }
      }

      if (isDelete && pLower.includes('delete')) {
        if ((targetLower.includes('task') && pLower.includes('task')) ||
            (targetLower.includes('project') && pLower.includes('project')) ||
            (targetLower.includes('label') && pLower.includes('label')) ||
            (targetLower.includes('timesheet') && pLower.includes('timesheet')) ||
            (targetLower.includes('workflow') && pLower.includes('workflow'))) {
          return true;
        }
      }

      if (isView && (pLower.includes('view') || pLower.includes('read'))) {
        if ((targetLower.includes('task') && pLower.includes('task')) ||
            (targetLower.includes('project') && pLower.includes('project')) ||
            (targetLower.includes('label') && pLower.includes('label')) ||
            (targetLower.includes('timesheet') && pLower.includes('timesheet')) ||
            (targetLower.includes('workflow') && pLower.includes('workflow'))) {
          return true;
        }
      }

      return false;
    });
  };

  const getPermissionScope = (permissionName?: string): DataScope => {
    if (isSuperAdmin) return 'ALL';
    if (permissionName) {
      if (scopes[permissionName]) return scopes[permissionName];

      const targetLower = permissionName.toLowerCase();
      const matchedKey = Object.keys(scopes).find(k => {
        const kLower = k.toLowerCase();
        return kLower === targetLower || kLower.includes(targetLower) || targetLower.includes(kLower);
      });
      if (matchedKey && scopes[matchedKey]) {
        return scopes[matchedKey];
      }
    }
    // Check if user has manager/admin role
    const isManagerOrAdmin = roles.some(r =>
      ['admin', 'hr', 'manager', 'lead', 'head', 'md', 'director'].some(m => r.toLowerCase().includes(m))
    );
    return isManagerOrAdmin ? 'REPORTING' : 'SELF';
  };

  return { hasPermission, getPermissionScope, isSuperAdmin, permissions, roles };
}
