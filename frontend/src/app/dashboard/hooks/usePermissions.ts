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
    return permissions.includes(permissionName) || permissions.includes('*');
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
