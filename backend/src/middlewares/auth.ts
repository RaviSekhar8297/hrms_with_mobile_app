import { Request, Response, NextFunction } from 'express';
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import dotenv from 'dotenv';
import { query } from '../config/db';

dotenv.config();

const keycloakUrl = process.env.KEYCLOAK_AUTH_SERVER_URL;
const realm = process.env.KEYCLOAK_REALM;

if (!keycloakUrl || !realm) {
  throw new Error('Keycloak configuration missing in environment variables.');
}

// JWKS Client to fetch public keys from Keycloak dynamically
const jwksClientInstance = jwksRsa({
  jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

// Helper to retrieve public signing key
function getKey(header: JwtHeader, callback: SigningKeyCallback) {
  if (!header.kid) {
    return callback(new Error('JWT kid header is missing'));
  }
  jwksClientInstance.getSigningKey(header.kid, (err, key) => {
    if (err || !key) {
      return callback(err || new Error('Public key not found'));
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

export interface AuthenticatedRequest extends Request {
  user?: {
    keycloakId: string;
    email?: string;
    roles: string[];
    companyId?: string;
  };
}

// Middleware to authenticate JWT token from Keycloak
export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || token === 'undefined' || token === 'null') {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Ensure token has 3 dot-separated parts before calling jwt.verify
  if (token.split('.').length !== 3) {
    return res.status(401).json({ error: 'Invalid or malformed access token format' });
  }

  jwt.verify(token, getKey, { algorithms: ['RS256'], ignoreExpiration: true }, async (err, decoded) => {
    if (err || !decoded || typeof decoded === 'string') {
      console.error('JWT Verification Error:', err);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const payload = decoded as jwt.JwtPayload;

    // Enforce 1 Hour (3600 seconds) maximum token lifespan
    const nowInSec = Math.floor(Date.now() / 1000);
    const tokenIssuedAt = payload.iat || 0;
    if (tokenIssuedAt && (nowInSec - tokenIssuedAt > 3600)) {
      console.error(`JWT Verification Error: Token expired. Issued at: ${new Date(tokenIssuedAt * 1000).toISOString()}, Now: ${new Date().toISOString()}`);
      return res.status(401).json({ error: 'Token expired (1 hour limit reached)' });
    }

    const tokenRoles = payload.realm_access?.roles || [];
    const email = payload.email || payload.preferred_username || payload.sub || '';
    const preferredUsername = payload.preferred_username || payload.email || '';
    
    // Check if user is SuperAdmin
    const isSuper = tokenRoles.includes('SuperAdmin') || 
                    tokenRoles.includes('superadmin') || 
                    preferredUsername.toLowerCase() === 'superadmin' ||
                    preferredUsername.toLowerCase() === 'admin';

    const roles = [...tokenRoles];
    if (isSuper && !roles.includes('SuperAdmin')) {
      roles.push('SuperAdmin');
    }

    // Extract basic token details
    req.user = {
      keycloakId: payload.sub || '',
      email: email,
      roles: roles,
    };

    // If they are a SuperAdmin, they bypass company checks. 
    // Otherwise, we fetch their company_id and employee details from our DB using their email
    if (!isSuper && email) {
      try {
        const empQuery = await query(
          `SELECT company_id FROM hrms.employees 
           WHERE (LOWER(email) = LOWER($1) OR LOWER(emp_id_code) = LOWER($1))
             AND status = 'ACTIVE' LIMIT 1`,
          [email]
        );
        if (empQuery.rows.length > 0) {
          req.user.companyId = empQuery.rows[0].company_id;
        } else {
          return res.status(403).json({ error: 'User is not registered as an active employee in any company' });
        }
      } catch (dbErr) {
        console.error('Error fetching employee company details:', dbErr);
        return res.status(500).json({ error: 'Internal server authorization error' });
      }
    }

    return next();
  });
}

// Middleware to check if user has SuperAdmin role
export function requireSuperAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const isSuper = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  if (!isSuper) {
    return res.status(403).json({ error: 'Access denied: Requires SuperAdmin role' });
  }
  return next();
}

// Middleware to check if user has a specific dynamic permission
export function requirePermission(permissionName: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // 1. SuperAdmin has complete, unrestricted access to all endpoints
    const isSuper = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    if (isSuper) {
      return next();
    }

    if (!req.user || !req.user.email) {
      return res.status(403).json({ error: 'Access denied: User context missing' });
    }

    try {
      // 2. Fetch employee's assigned role_id from DB using exact email or emp_id_code lookup
      const empQuery = await query(
        `SELECT e.role_id 
         FROM hrms.employees e 
         WHERE (LOWER(e.email) = LOWER($1) OR LOWER(e.emp_id_code) = LOWER($1)) 
           AND e.status = 'ACTIVE' LIMIT 1`,
        [req.user.email]
      );

      if (empQuery.rows.length === 0 || !empQuery.rows[0].role_id) {
        return res.status(403).json({ error: 'Access denied: Active employee or assigned role not found' });
      }

      const roleId = empQuery.rows[0].role_id;

      // 3. Query PostgreSQL hrms.role_permissions dynamically for assigned permission by ID or Name
      const parts = permissionName.toLowerCase().trim().split('_');
      const reversed = parts.length >= 2 ? `${parts.slice(1).join('_')}_${parts[0]}` : permissionName;
      const pluralVariant = permissionName.endsWith('s') ? permissionName.slice(0, -1) : `${permissionName}s`;

      const permQuery = await query(
        `SELECT COUNT(*) as count 
         FROM hrms.role_permissions rp 
         JOIN hrms.permissions p ON rp.permission_id = p.id 
         WHERE rp.role_id = $1 
           AND (
             p.id::text = $2 
             OR LOWER(p.name) = LOWER($2) 
             OR LOWER(p.name) = LOWER($3)
             OR LOWER(p.name) = LOWER($4)
             OR LOWER(p.name) = LOWER($2 || '_masters')
             OR LOWER(p.name) = LOWER(REPLACE($2, '_masters', ''))
             OR LOWER(p.module) = LOWER(SPLIT_PART($2, ':', 1))
             OR p.name = '*'
           )`,
        [roleId, permissionName, reversed, pluralVariant]
      );

      if (parseInt(permQuery.rows[0].count, 10) === 0) {
        return res.status(403).json({ error: `Access denied: Role does not have permission "${permissionName}"` });
      }

      return next();
    } catch (dbErr) {
      console.error('Error verifying permission:', dbErr);
      return res.status(500).json({ error: 'Internal server authorization error' });
    }
  };
}

export { getEmployeeDataScope, buildDataScopeCondition, DataScopeContext } from '../utils/dataScope';

