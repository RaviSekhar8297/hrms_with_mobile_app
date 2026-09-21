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

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  const hasPermission = (permissionNameOrId?: string): boolean => {
    if (!permissionNameOrId) return true;   // no guard = always visible
    if (isSuperAdmin) return true;       // SuperAdmin sees everything
    if (permissions.includes('*')) return true;

    // Direct match by Permission Name or Permission ID UUID
    if (permissions.includes(permissionNameOrId)) return true;

    // Dynamic matching for permission aliases
    const targetLower = permissionNameOrId.toLowerCase().trim();
    
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

      // Extract action and entity matching
      const isCreate = targetLower.includes('create');
      const isView = targetLower.includes('view') || targetLower.includes('read');
      const isEdit = targetLower.includes('edit') || targetLower.includes('update');
      const isDelete = targetLower.includes('delete') || targetLower.includes('remove');

      if (isCreate && pLower.includes('create')) {
        if (targetLower.split('_').some(part => part.length > 3 && pLower.includes(part))) return true;
      }

      if (isEdit && pLower.includes('edit')) {
        if (targetLower.split('_').some(part => part.length > 3 && pLower.includes(part))) return true;
      }

      if (isDelete && pLower.includes('delete')) {
        if (targetLower.split('_').some(part => part.length > 3 && pLower.includes(part))) return true;
      }

      if (isView && (pLower.includes('view') || pLower.includes('read'))) {
        if (targetLower.split('_').some(part => part.length > 3 && pLower.includes(part))) return true;
      }

      return false;
    });
  };

  const getPermissionScope = (permissionNameOrId?: string): DataScope => {
    if (isSuperAdmin) return 'ALL';
    if (permissionNameOrId) {
      if (scopes[permissionNameOrId]) {
        const sVal = String(scopes[permissionNameOrId]).toUpperCase();
        if (['DEPARTMENT', 'DEPT', 'D'].includes(sVal)) return 'DEPARTMENT';
        if (['REPORTING', 'TEAM', 'T'].includes(sVal)) return 'REPORTING';
        if (['ALL', 'A'].includes(sVal)) return 'ALL';
        return 'SELF';
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
