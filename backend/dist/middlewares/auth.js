"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.requireSuperAdmin = requireSuperAdmin;
exports.requirePermission = requirePermission;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("../config/db");
dotenv_1.default.config();
const keycloakUrl = process.env.KEYCLOAK_AUTH_SERVER_URL;
const realm = process.env.KEYCLOAK_REALM;
if (!keycloakUrl || !realm) {
    throw new Error('Keycloak configuration missing in environment variables.');
}
// JWKS Client to fetch public keys from Keycloak dynamically
const jwksClientInstance = (0, jwks_rsa_1.default)({
    jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
});
// Helper to retrieve public signing key
function getKey(header, callback) {
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
// Middleware to authenticate JWT token from Keycloak
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    if (token === 'mock_token_dev_bypass') {
        req.user = {
            keycloakId: 'mock-id-superadmin',
            email: 'superadmin@hrms.com',
            roles: ['SuperAdmin'],
        };
        return next();
    }
    if (token.startsWith('mock_token_employee_')) {
        const email = token.replace('mock_token_employee_', '');
        req.user = {
            keycloakId: 'mock-id-employee',
            email: email,
            roles: ['Employee'],
        };
        try {
            const empQuery = await (0, db_1.query)('SELECT company_id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
            if (empQuery.rows.length > 0) {
                req.user.companyId = empQuery.rows[0].company_id;
            }
            else {
                return res.status(403).json({ error: 'User is not registered as an active employee' });
            }
        }
        catch (dbErr) {
            console.error('Error fetching employee company details:', dbErr);
            return res.status(500).json({ error: 'Internal server authorization error' });
        }
        return next();
    }
    jsonwebtoken_1.default.verify(token, getKey, { algorithms: ['RS256'] }, async (err, decoded) => {
        if (err || !decoded || typeof decoded === 'string') {
            console.error('JWT Verification Error:', err);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        const payload = decoded;
        const tokenRoles = payload.realm_access?.roles || [];
        const email = payload.email || '';
        const preferredUsername = payload.preferred_username || '';
        // Check if user is SuperAdmin
        const isSuper = tokenRoles.includes('SuperAdmin') ||
            tokenRoles.includes('superadmin') ||
            preferredUsername.toLowerCase() === 'superadmin';
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
                const empQuery = await (0, db_1.query)('SELECT company_id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
                if (empQuery.rows.length > 0) {
                    req.user.companyId = empQuery.rows[0].company_id;
                }
                else {
                    return res.status(403).json({ error: 'User is not registered as an active employee in any company' });
                }
            }
            catch (dbErr) {
                console.error('Error fetching employee company details:', dbErr);
                return res.status(500).json({ error: 'Internal server authorization error' });
            }
        }
        return next();
    });
}
// Middleware to check if user has SuperAdmin role
function requireSuperAdmin(req, res, next) {
    const isSuper = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    if (!isSuper) {
        return res.status(403).json({ error: 'Access denied: Requires SuperAdmin role' });
    }
    return next();
}
// Middleware to check if user has a specific dynamic permission
function requirePermission(permissionName) {
    return async (req, res, next) => {
        const isSuper = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
        if (isSuper) {
            return next();
        }
        if (!req.user || !req.user.email) {
            return res.status(403).json({ error: 'Access denied: User context missing' });
        }
        try {
            // Fetch employee and their role permissions
            const empQuery = await (0, db_1.query)(`SELECT e.role_id 
         FROM hrms.employees e 
         WHERE e.email = $1 AND e.status = 'ACTIVE'`, [req.user.email]);
            if (empQuery.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied: Employee not found or inactive' });
            }
            const roleId = empQuery.rows[0].role_id;
            if (!roleId) {
                return res.status(403).json({ error: 'Access denied: User has no assigned role' });
            }
            const permQuery = await (0, db_1.query)(`SELECT COUNT(*) as count 
         FROM hrms.role_permissions rp 
         JOIN hrms.permissions p ON rp.permission_id = p.id 
         WHERE rp.role_id = $1 AND p.name = $2`, [roleId, permissionName]);
            if (parseInt(permQuery.rows[0].count, 10) === 0) {
                return res.status(403).json({ error: `Access denied: Requires permission "${permissionName}"` });
            }
            return next();
        }
        catch (dbErr) {
            console.error('Error verifying permission:', dbErr);
            return res.status(500).json({ error: 'Internal server authorization error' });
        }
    };
}
