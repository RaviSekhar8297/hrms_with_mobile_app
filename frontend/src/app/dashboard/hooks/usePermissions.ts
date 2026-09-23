'use client';

import { useState, useEffect } from 'react';

export type DataScope = 'SELF' | 'REPORTING' | 'TEAM' | 'DEPARTMENT' | 'ALL';

interface UsePermissionsResult {
  hasPermission: (permissionNameOrId?: string) => boolean;
  getPermissionScope: (permissionNameOrId?: string) => DataScope;
  isSuperAdmin: boolean;
  permissions: string[];
  roles: string[];
}

const STANDARD_ACTIONS = ['view', 'create', 'edit', 'delete', 'manage', 'calculate', 'approve', 'read', 'update'];

/**
 * Generate all possible variations/aliases of a permission string:
 * e.g. "view_leave_requests" <-> "leave_requests_view", "view_leave_request", "leave_request_view"
 * e.g. "employees_create" <-> "create_employees", "employee_create", "create_employee"
 */
function getPermissionAliases(perm: string): string[] {
  if (!perm) return [];
  const clean = perm.toLowerCase().trim();
  const aliases = new Set<string>([clean]);

  for (const act of STANDARD_ACTIONS) {
    // 1. Starts with action: view_leave_requests -> leave_requests_view
    if (clean.startsWith(`${act}_`)) {
      const rest = clean.slice(act.length + 1);
      aliases.add(`${rest}_${act}`);
      if (rest.endsWith('s')) {
        const singular = rest.slice(0, -1);
        aliases.add(`${singular}_${act}`);
        aliases.add(`${act}_${singular}`);
      } else {
        aliases.add(`${rest}s_${act}`);
        aliases.add(`${act}_${rest}s`);
      }
    }
    // 2. Ends with action: leave_requests_view -> view_leave_requests
    if (clean.endsWith(`_${act}`)) {
      const rest = clean.slice(0, -act.length - 1);
      aliases.add(`${act}_${rest}`);
      if (rest.endsWith('s')) {
        const singular = rest.slice(0, -1);
        aliases.add(`${act}_${singular}`);
        aliases.add(`${singular}_${act}`);
      } else {
        aliases.add(`${act}_${rest}s`);
        aliases.add(`${rest}s_${act}`);
      }
    }
  }

  return Array.from(aliases);
}

/**
 * Shared permissions hook — reads roles, permissions & scopes dynamically from localStorage.
 * SuperAdmin always gets full access (hasPermission always returns true).
 * Other roles evaluate dynamic permission string or UUID matching.
 */
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

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin') || roles.includes('admin') || roles.includes('Admin');

  const hasPermission = (permissionNameOrId?: string): boolean => {
    if (!permissionNameOrId) return true;   // no guard = always visible
    if (isSuperAdmin) return true;       // SuperAdmin sees everything
    if (permissions.includes('*')) return true;

    // Direct match by Permission Name or Permission ID UUID
    if (permissions.includes(permissionNameOrId)) return true;

    // Generate all aliases for the target permission
    const targetAliases = getPermissionAliases(permissionNameOrId);

    // Check if any user permission matches any alias
    return permissions.some(p => {
      const userAliases = getPermissionAliases(p);
      return targetAliases.some(targetAlias => userAliases.includes(targetAlias));
    });
  };

  const getPermissionScope = (permissionNameOrId?: string): DataScope => {
    if (isSuperAdmin) return 'ALL';
    if (permissionNameOrId) {
      const targetAliases = getPermissionAliases(permissionNameOrId);
      for (const alias of targetAliases) {
        if (scopes[alias]) {
          const sVal = String(scopes[alias]).toUpperCase();
          if (['DEPARTMENT', 'DEPT', 'D'].includes(sVal)) return 'DEPARTMENT';
          if (['REPORTING', 'TEAM', 'T'].includes(sVal)) return 'REPORTING';
          if (['ALL', 'A'].includes(sVal)) return 'ALL';
          if (['NONE', 'N'].includes(sVal)) return 'SELF';
          return 'SELF';
        }
      }

      const targetLower = permissionNameOrId.toLowerCase();
      const matchedKey = Object.keys(scopes).find(k => {
        const kLower = k.toLowerCase();
        return kLower === targetLower || kLower.includes(targetLower) || targetLower.includes(kLower);
      });
      if (matchedKey && scopes[matchedKey]) {
        const sVal = String(scopes[matchedKey]).toUpperCase();
        if (['DEPARTMENT', 'DEPT', 'D'].includes(sVal)) return 'DEPARTMENT';
        if (['REPORTING', 'TEAM', 'T'].includes(sVal)) return 'REPORTING';
        if (['ALL', 'A'].includes(sVal)) return 'ALL';
        return 'SELF';
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
