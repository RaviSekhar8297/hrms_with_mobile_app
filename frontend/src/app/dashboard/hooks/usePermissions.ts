'use client';

import { useState, useEffect } from 'react';

interface UsePermissionsResult {
  hasPermission: (permissionName?: string) => boolean;
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

  useEffect(() => {
    const storedRoles = localStorage.getItem('roles');
    const storedPermissions = localStorage.getItem('permissions');
    if (storedRoles) {
      try { setRoles(JSON.parse(storedRoles)); } catch { setRoles([]); }
    }
    if (storedPermissions) {
      try { setPermissions(JSON.parse(storedPermissions)); } catch { setPermissions([]); }
    }
  }, []);

  const isSuperAdmin = roles.includes('SuperAdmin') || roles.includes('superadmin');

  const hasPermission = (permissionName?: string): boolean => {
    if (!permissionName) return true;   // no guard = always visible
    if (isSuperAdmin) return true;       // SuperAdmin sees everything
    return permissions.includes(permissionName);
  };

  return { hasPermission, isSuperAdmin, permissions, roles };
}
