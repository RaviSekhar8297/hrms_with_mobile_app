"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUserAction = void 0;
exports.enqueueActivityLog = enqueueActivityLog;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const morgan_1 = __importDefault(require("morgan"));
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = require("./config/db");
const auth_1 = require("./middlewares/auth");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// 1. Helmet Security Headers (Secures HTTP headers)
app.use((0, helmet_1.default)());
// 2. HTTP Request Logger (Prints requests in a structured format in the console)
app.use((0, morgan_1.default)('dev'));
// 3. Rate Limiter to prevent brute-force attacks on login
const loginRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 login requests per windowMs
    message: { error: 'Too many login attempts from this IP, please try again after 15 minutes.' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
// 4. Background Schedulers (Cron Jobs)
// Runs a daily background task at midnight (00:00) to verify uptime/log health
node_cron_1.default.schedule('0 0 * * *', async () => {
    console.log('[CRON WORKER] Running daily system health check...');
    try {
        const dbCheck = await (0, db_1.query)('SELECT NOW()');
        console.log(`[CRON WORKER] Database connection healthy. Server timestamp: ${dbCheck.rows[0].now}`);
    }
    catch (err) {
        console.error('[CRON WORKER] Background database check failed:', err);
    }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
// Background Queue implementation for non-blocking asynchronous database writes (e.g. Audit/Activity logging)
class TaskQueue {
    queue = [];
    processing = false;
    enqueue(task) {
        this.queue.push(task);
        this.processNext();
    }
    async processNext() {
        if (this.processing || this.queue.length === 0)
            return;
        this.processing = true;
        const task = this.queue.shift();
        if (task) {
            try {
                await task();
            }
            catch (err) {
                console.error('Error executing queued background task:', err);
            }
        }
        this.processing = false;
        this.processNext();
    }
}
const backgroundQueue = new TaskQueue();
function enqueueActivityLog(companyId, userEmail, action, module, details, ipAddress, userAgent) {
    backgroundQueue.enqueue(async () => {
        try {
            await (0, db_1.query)(`INSERT INTO hrms.activity_logs (company_id, user_email, action, module, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [companyId, userEmail, action, module, details, ipAddress, userAgent]);
        }
        catch (err) {
            console.error('Failed to write activity log via background queue:', err);
        }
    });
}
const logUserAction = (req, action, moduleName, details) => {
    try {
        const companyId = resolveCompanyId(req);
        const userEmail = req.user?.email || req.user?.preferred_username || 'system@hrms.com';
        const ipAddress = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '');
        const userAgent = (req.headers['user-agent'] || '');
        enqueueActivityLog(companyId, userEmail, action, moduleName, details, ipAddress, userAgent);
    }
    catch (err) {
        console.error('Non-blocking audit log error:', err);
    }
};
exports.logUserAction = logUserAction;
// Uptime Check
app.get('/health', (_req, res) => {
    res.json({ status: 'UP', timestamp: new Date() });
});
/**
 * 🔑 USER LOGIN
 * Authenticates user credentials with Keycloak, writes an audit log to Supabase PostgreSQL,
 * and returns the access token to the client.
 */
app.post('/api/v1/auth/login', loginRateLimiter, async (req, res) => {
    const { username, password } = req.body;
    const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '');
    const userAgent = req.headers['user-agent'] || '';
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    // 1. Verify if username/email exists in DB (or is a known superadmin username)
    const isSuperAdminDev = username.toLowerCase() === 'superadmin' ||
        username.toLowerCase() === 'admin@hrms.com' ||
        username.toLowerCase() === 'superadmin@hrms.com';
    let userExists = isSuperAdminDev;
    try {
        const empCheck = await (0, db_1.query)("SELECT email FROM hrms.employees WHERE email = $1 AND status = 'ACTIVE'", [username]);
        if (empCheck.rows.length > 0) {
            userExists = true;
        }
    }
    catch (dbErr) {
        console.error('Pre-login DB user check error:', dbErr);
        // Keep userExists as true to prevent blocking if database query fails transiently
        userExists = true;
    }
    if (!userExists) {
        return res.status(401).json({ error: 'Invalid email or username.' });
    }
    const tokenUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', process.env.KEYCLOAK_CLIENT_ID || 'hrms-backend-api');
    params.append('username', username);
    params.append('password', password);
    if (process.env.KEYCLOAK_CLIENT_SECRET && process.env.KEYCLOAK_CLIENT_SECRET !== 'your-keycloak-client-secret') {
        params.append('client_secret', process.env.KEYCLOAK_CLIENT_SECRET);
    }
    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        const data = await response.json();
        if (response.ok) {
            const accessToken = data.access_token;
            const decoded = jsonwebtoken_1.default.decode(accessToken);
            const email = decoded?.email || username;
            const preferredUsername = decoded?.preferred_username || username;
            const tokenRoles = decoded?.realm_access?.roles || [];
            // Check if user is SuperAdmin
            const isSuper = tokenRoles.includes('SuperAdmin') ||
                tokenRoles.includes('superadmin') ||
                preferredUsername.toLowerCase() === 'superadmin';
            const roles = [...tokenRoles];
            if (isSuper && !roles.includes('SuperAdmin')) {
                roles.push('SuperAdmin');
            }
            let companyId = null;
            let userPermissions = [];
            // Find company_id and permissions if user is not a global SuperAdmin
            if (!isSuper) {
                const empQuery = await (0, db_1.query)('SELECT company_id, role_id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
                if (empQuery.rows.length > 0) {
                    companyId = empQuery.rows[0].company_id;
                    const roleId = empQuery.rows[0].role_id;
                    if (roleId) {
                        const permQuery = await (0, db_1.query)(`SELECT p.name 
               FROM hrms.role_permissions rp 
               JOIN hrms.permissions p ON rp.permission_id = p.id 
               WHERE rp.role_id = $1`, [roleId]);
                        userPermissions = permQuery.rows.map(row => row.name);
                    }
                }
            }
            else {
                userPermissions = ['*'];
            }
            // Record successful login activity in audit logs using background task queue
            enqueueActivityLog(companyId, email, 'LOGIN_SUCCESS', 'auth', JSON.stringify({ roles, login_at: new Date() }), ipAddress, userAgent);
            return res.json({
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_in: data.expires_in,
                email,
                roles,
                permissions: userPermissions,
                companyId,
            });
        }
        else {
            // Record failed login attempt in audit logs using background task queue
            enqueueActivityLog(null, username, 'LOGIN_FAILED', 'auth', JSON.stringify({ error: data.error_description || 'Invalid credentials' }), ipAddress, userAgent);
            const errorMsg = data.error_description || 'Incorrect password.';
            return res.status(401).json({ error: errorMsg });
        }
    }
    catch (err) {
        console.error('CRITICAL ERROR: Keycloak authentication server connection failed. Keycloak may be OFFLINE or DOWN.', err);
        return res.status(500).json({ error: 'Authentication server connection failure' });
    }
});
/**
 * 🔍 VERIFY TEMPORARY PASSWORD
 * Verifies username and temporary credentials with Keycloak before proceeding with the password reset wizard.
 */
app.post('/api/v1/auth/verify-temporary-password', async (req, res) => {
    const { username, temporaryPassword } = req.body;
    if (!username || !temporaryPassword) {
        return res.status(400).json({ error: 'Username and temporary password are required' });
    }
    const tokenUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', process.env.KEYCLOAK_CLIENT_ID || 'hrms-backend-api');
    params.append('username', username);
    params.append('password', temporaryPassword);
    if (process.env.KEYCLOAK_CLIENT_SECRET && process.env.KEYCLOAK_CLIENT_SECRET !== 'your-keycloak-client-secret') {
        params.append('client_secret', process.env.KEYCLOAK_CLIENT_SECRET);
    }
    try {
        const keycloakRes = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        const data = await keycloakRes.json();
        const isValidCredentials = keycloakRes.ok ||
            (data.error === 'invalid_grant' && data.error_description === 'Account is not fully set up');
        if (isValidCredentials) {
            return res.json({ success: true, message: 'Temporary password verified.' });
        }
        else {
            return res.status(401).json({ error: data.error_description || 'Invalid credentials' });
        }
    }
    catch (err) {
        console.error('Offline development verify password bypass check...');
        // Development fallback if auth server is unreachable
        if (temporaryPassword === '123' || temporaryPassword === 'Dinesh@2023') {
            return res.json({ success: true, message: 'Offline dev bypass verification successful.' });
        }
        return res.status(500).json({ error: 'Authentication server connection failure' });
    }
});
/**
 * 🔒 RESET TEMPORARY PASSWORD
 * Authenticates with temporary password first to verify identity, then updates in Keycloak.
 */
app.post('/api/v1/auth/reset-temporary-password', async (req, res) => {
    const { username, temporaryPassword, newPassword } = req.body;
    if (!username || !temporaryPassword || !newPassword) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    // 1. Verify credentials by attempting a login with Keycloak
    const tokenUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', process.env.KEYCLOAK_CLIENT_ID || 'hrms-backend-api');
    params.append('username', username);
    params.append('password', temporaryPassword);
    if (process.env.KEYCLOAK_CLIENT_SECRET && process.env.KEYCLOAK_CLIENT_SECRET !== 'your-keycloak-client-secret') {
        params.append('client_secret', process.env.KEYCLOAK_CLIENT_SECRET);
    }
    try {
        const keycloakRes = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        const data = await keycloakRes.json();
        // A correct temporary password will return either 200 (if temporary check is not enforced somehow)
        // or 400/401 with error "invalid_grant" and description "Account is not fully set up"
        const isValidCredentials = keycloakRes.ok ||
            (data.error === 'invalid_grant' && data.error_description === 'Account is not fully set up');
        if (!isValidCredentials) {
            return res.status(401).json({ error: 'Invalid username/email or temporary password' });
        }
        // 2. Obtain Admin Access Token
        const adminToken = await getKeycloakAdminToken();
        if (!adminToken) {
            return res.status(500).json({ error: 'Failed to retrieve Keycloak admin access token' });
        }
        // 3. Find Keycloak User ID by username (email)
        const findUserUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users?username=${encodeURIComponent(username)}`;
        const findRes = await fetch(findUserUrl, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (!findRes.ok) {
            return res.status(500).json({ error: 'Failed to search for user in Keycloak' });
        }
        const users = await findRes.json();
        if (!users || users.length === 0) {
            return res.status(404).json({ error: 'User profile not found in Keycloak' });
        }
        const keycloakUserId = users[0].id;
        // 4. Update password (reset password to permanent)
        const resetPasswordUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${keycloakUserId}/reset-password`;
        const resetRes = await fetch(resetPasswordUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'password',
                value: newPassword,
                temporary: false
            })
        });
        if (!resetRes.ok) {
            const errText = await resetRes.text();
            return res.status(500).json({ error: errText || 'Failed to update password in Keycloak' });
        }
        // 5. Clear Required Actions (Remove UPDATE_PASSWORD if present)
        const updateUserUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${keycloakUserId}`;
        const userProfile = users[0];
        const requiredActions = userProfile.requiredActions || [];
        const updatedActions = requiredActions.filter((action) => action !== 'UPDATE_PASSWORD');
        await fetch(updateUserUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requiredActions: updatedActions
            })
        });
        return res.json({ success: true, message: 'Password updated successfully. You can now login with your new password.' });
    }
    catch (err) {
        console.error('Error during password reset:', err);
        return res.status(500).json({ error: 'Internal server connection error' });
    }
});
/**
 * 🔒 CHANGE LOGGED-IN USER PASSWORD
 * Updates the authenticated user's password directly in Keycloak.
 */
app.post('/api/v1/auth/change-password', auth_1.authenticateToken, async (req, res) => {
    const { newPassword } = req.body;
    const username = req.user?.email; // Keycloak username corresponds to email in our HRMS config
    if (!username) {
        return res.status(401).json({ error: 'Unauthorized: User email not found' });
    }
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '');
    const userAgent = req.headers['user-agent'] || '';
    // Check if Keycloak credentials are configured, if not, do offline mock update
    if (!process.env.KEYCLOAK_AUTH_SERVER_URL || !process.env.KEYCLOAK_REALM) {
        console.log(`[OFFLINE DEV MODE] Password updated successfully for user ${username}.`);
        // Log the audit event using the non-blocking background queue
        enqueueActivityLog(req.user?.companyId || null, username, 'PASSWORD_CHANGE', 'AUTH', 'User changed their password via profile dashboard (Offline Bypass)', ipAddress, userAgent);
        return res.json({ success: true, message: 'Password updated successfully (Offline Dev Mode bypass).' });
    }
    try {
        // 1. Obtain Admin Access Token
        const adminToken = await getKeycloakAdminToken();
        if (!adminToken) {
            return res.status(500).json({ error: 'Failed to retrieve Keycloak admin access token' });
        }
        // 2. Find Keycloak User ID by username (email)
        const findUserUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users?username=${encodeURIComponent(username)}`;
        const findRes = await fetch(findUserUrl, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (!findRes.ok) {
            return res.status(500).json({ error: 'Failed to search for user in Keycloak' });
        }
        const users = await findRes.json();
        if (!users || users.length === 0) {
            return res.status(404).json({ error: 'User profile not found in Keycloak' });
        }
        const keycloakUserId = users[0].id;
        // 3. Update password in Keycloak
        const resetPasswordUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${keycloakUserId}/reset-password`;
        const resetRes = await fetch(resetPasswordUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'password',
                value: newPassword,
                temporary: false
            })
        });
        if (!resetRes.ok) {
            const errText = await resetRes.text();
            return res.status(500).json({ error: errText || 'Failed to update password in Keycloak' });
        }
        // 4. Log the audit event using the non-blocking background queue
        enqueueActivityLog(req.user?.companyId || null, username, 'PASSWORD_CHANGE', 'AUTH', 'User changed their password via profile dashboard', ipAddress, userAgent);
        return res.json({ success: true, message: 'Password updated successfully in Keycloak.' });
    }
    catch (err) {
        console.error('Error changing password in Keycloak:', err);
        return res.status(500).json({ error: 'Internal server error while updating password' });
    }
});
/**
 * 📜 FETCH ACTIVITY LOGS
 * Fetches recent login and operation audits.
 */
app.get('/api/v1/auth/logs', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;
    const email = req.user?.email || '';
    try {
        let result;
        if (isSuperAdmin) {
            result = await (0, db_1.query)('SELECT id, company_id, user_email, action, module, details, ip_address, user_agent, created_at FROM hrms.activity_logs ORDER BY created_at DESC LIMIT 50');
        }
        else if (companyId) {
            result = await (0, db_1.query)('SELECT id, company_id, user_email, action, module, details, ip_address, user_agent, created_at FROM hrms.activity_logs WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50', [companyId]);
        }
        else {
            result = await (0, db_1.query)('SELECT id, company_id, user_email, action, module, details, ip_address, user_agent, created_at FROM hrms.activity_logs WHERE user_email = $1 ORDER BY created_at DESC LIMIT 50', [email]);
        }
        res.json({ logs: result.rows });
    }
    catch (err) {
        console.error('Error fetching logs:', err);
        res.status(500).json({ error: 'Internal database query failure' });
    }
});
/**
 * 🏢 CREATE COMPANY (SuperAdmin Only)
 */
/**
 * 🏢 CREATE COMPANY (SuperAdmin Only)
 */
app.post('/api/v1/companies', auth_1.authenticateToken, auth_1.requireSuperAdmin, async (req, res) => {
    const { name, subdomain, domain, branding_logo } = req.body;
    if (!name || !subdomain) {
        return res.status(400).json({ error: 'Name and subdomain are required' });
    }
    try {
        const result = await (0, db_1.query)('INSERT INTO hrms.companies (name, subdomain, domain, branding_logo) VALUES ($1, $2, $3, $4) RETURNING *', [name, subdomain, domain || null, branding_logo || null]);
        const newCompany = result.rows[0];
        const defaultRoles = ['Admin'];
        for (const roleName of defaultRoles) {
            await (0, db_1.query)('INSERT INTO hrms.roles (company_id, name, description) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [newCompany.id, roleName, `Default ${roleName} role for ${name}`]);
        }
        return res.status(201).json({
            message: 'Tenant company created successfully and Admin role seeded.',
            company: newCompany,
        });
    }
    catch (err) {
        console.error('Error creating company:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Subdomain already exists' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 🏢 GET COMPANIES (SuperAdmin gets all, Tenant users get their own company)
 */
app.get('/api/v1/companies', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    try {
        if (isSuperAdmin) {
            const result = await (0, db_1.query)('SELECT id, name, subdomain, domain, branding_logo, status, created_at FROM hrms.companies ORDER BY name ASC');
            return res.json({ companies: result.rows });
        }
        const userCompanyId = req.user?.companyId;
        if (!userCompanyId) {
            return res.status(403).json({ error: 'Access denied: No company assigned' });
        }
        const result = await (0, db_1.query)('SELECT id, name, subdomain, domain, branding_logo, status, created_at FROM hrms.companies WHERE id = $1', [userCompanyId]);
        return res.json({ companies: result.rows });
    }
    catch (err) {
        console.error('Error fetching companies:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 🏢 UPDATE COMPANY (SuperAdmin Only)
 */
app.put('/api/v1/companies/:id', auth_1.authenticateToken, auth_1.requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, subdomain, domain, branding_logo, status } = req.body;
    if (!name || !subdomain) {
        return res.status(400).json({ error: 'Name and subdomain are required' });
    }
    try {
        const result = await (0, db_1.query)('UPDATE hrms.companies SET name = $1, subdomain = $2, domain = $3, branding_logo = $4, status = $5, updated_at = NOW() WHERE id = $6 RETURNING *', [name, subdomain, domain || null, branding_logo || null, status || 'ACTIVE', id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }
        return res.json({
            message: 'Tenant company updated successfully.',
            company: result.rows[0],
        });
    }
    catch (err) {
        console.error('Error updating company:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Subdomain already exists' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 🏢 DELETE COMPANY (SuperAdmin Only)
 */
app.delete('/api/v1/companies/:id', auth_1.authenticateToken, auth_1.requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await (0, db_1.query)('DELETE FROM hrms.companies WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }
        return res.json({ message: 'Tenant company deleted successfully.' });
    }
    catch (err) {
        console.error('Error deleting company:', err);
        return res.status(500).json({ error: 'Internal server database error. Ensure no dependent items exist.' });
    }
});
/**
 * 👥 GET EMPLOYEES (Multi-Tenant)
 */
app.get('/api/v1/employees', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyIdRaw = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    const companyId = (companyIdRaw === 'all' || companyIdRaw === 'undefined' || companyIdRaw === 'null' || !companyIdRaw) ? null : companyIdRaw;
    if (!companyId) {
        if (isSuperAdmin) {
            try {
                const result = await (0, db_1.query)(`SELECT e.id, e.company_id, e.emp_id_code, e.first_name, e.last_name, e.email, e.phone, e.status, e.joining_date,
                    e.branch_id, b.name as branch_name,
                    e.department_id, d.name as department_name,
                    e.designation_id, des.name as designation_name,
                    e.role_id, r.name as role_name,
                    es.shift_id, sm.shift_name as shift_name,
                    e.dob, e.gender, e.marital_status, e.blood_group, e.personal_email,
                    e.reporting_to_id, m.first_name as manager_first_name, m.last_name as manager_last_name,
                    e.employment_type, e.probation_period_months, e.confirmation_date, e.exit_date, e.resignation_date,
                    e.pan_number, e.aadhar_number, e.esi_number, e.uan_number, e.bank_information,
                    e.current_address, e.permanent_address, e.emergency_contacts, e.education, e.experience, e.skills,
                    e.emp_image
             FROM hrms.employees e
             LEFT JOIN hrms.branches b ON e.branch_id = b.id
             LEFT JOIN hrms.departments d ON e.department_id = d.id
             LEFT JOIN hrms.designations des ON e.designation_id = des.id
             LEFT JOIN hrms.roles r ON e.role_id = r.id
             LEFT JOIN hrms.employees m ON e.reporting_to_id = m.id
             LEFT JOIN LATERAL (
               SELECT shift_id FROM hrms.employee_shifts
               WHERE employee_id = e.id
               ORDER BY effective_from DESC LIMIT 1
             ) es ON true
             LEFT JOIN hrms.shift_masters sm ON es.shift_id = sm.id
             ORDER BY e.emp_id_code ASC`);
                return res.json({
                    count: result.rows.length,
                    employees: result.rows,
                });
            }
            catch (err) {
                console.error('Error fetching all employees:', err);
                return res.status(500).json({ error: 'Internal database query failure' });
            }
        }
        return res.status(400).json({ error: 'Company ID could not be identified' });
    }
    try {
        const result = await (0, db_1.query)(`SELECT e.id, e.company_id, e.emp_id_code, e.first_name, e.last_name, e.email, e.phone, e.status, e.joining_date,
                e.branch_id, b.name as branch_name,
                e.department_id, d.name as department_name,
                e.designation_id, des.name as designation_name,
                e.role_id, r.name as role_name,
                es.shift_id, sm.shift_name as shift_name,
                e.dob, e.gender, e.marital_status, e.blood_group, e.personal_email,
                e.reporting_to_id, m.first_name as manager_first_name, m.last_name as manager_last_name,
                e.employment_type, e.probation_period_months, e.confirmation_date, e.exit_date, e.resignation_date,
                e.pan_number, e.aadhar_number, e.esi_number, e.uan_number, e.bank_information,
                e.current_address, e.permanent_address, e.emergency_contacts, e.education, e.experience, e.skills,
                e.emp_image
         FROM hrms.employees e
         LEFT JOIN hrms.branches b ON e.branch_id = b.id
         LEFT JOIN hrms.departments d ON e.department_id = d.id
         LEFT JOIN hrms.designations des ON e.designation_id = des.id
         LEFT JOIN hrms.roles r ON e.role_id = r.id
         LEFT JOIN hrms.employees m ON e.reporting_to_id = m.id
         LEFT JOIN LATERAL (
           SELECT shift_id FROM hrms.employee_shifts
           WHERE employee_id = e.id
           ORDER BY effective_from DESC LIMIT 1
         ) es ON true
         LEFT JOIN hrms.shift_masters sm ON es.shift_id = sm.id
         WHERE e.company_id = $1
         ORDER BY e.emp_id_code ASC`, [companyId]);
        return res.json({
            companyId,
            count: result.rows.length,
            employees: result.rows,
        });
    }
    catch (err) {
        console.error('Error fetching employees:', err);
        return res.status(500).json({ error: 'Internal database query failure' });
    }
});
async function getKeycloakAdminToken() {
    const tokenUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', process.env.KEYCLOAK_CLIENT_ID || 'hrms-backend-api');
    if (process.env.KEYCLOAK_CLIENT_SECRET && process.env.KEYCLOAK_CLIENT_SECRET !== 'your-keycloak-client-secret') {
        params.append('client_secret', process.env.KEYCLOAK_CLIENT_SECRET);
    }
    try {
        const res = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        if (!res.ok) {
            console.error('Failed to get Keycloak admin token:', await res.text());
            return null;
        }
        const data = await res.json();
        return data.access_token;
    }
    catch (err) {
        console.error('Error fetching admin token from Keycloak:', err);
        return null;
    }
}
async function createKeycloakUser(email, firstName, lastName, tempPassword) {
    if (!process.env.KEYCLOAK_AUTH_SERVER_URL || !process.env.KEYCLOAK_REALM) {
        console.warn('Keycloak environment variables are missing. Skipping user registration.');
        return { success: false, error: 'Keycloak server not configured' };
    }
    const adminToken = await getKeycloakAdminToken();
    if (!adminToken) {
        return { success: false, error: 'Failed to retrieve Keycloak admin access token' };
    }
    const createUserUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users`;
    const defaultPassword = tempPassword || 'Welcome@123';
    const userPayload = {
        username: email,
        email: email,
        enabled: true,
        emailVerified: true,
        firstName: firstName,
        lastName: lastName,
        credentials: [
            {
                type: 'password',
                value: defaultPassword,
                temporary: true
            }
        ]
    };
    try {
        const res = await fetch(createUserUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userPayload)
        });
        if (res.status === 201) {
            return { success: true, tempPassword: defaultPassword };
        }
        else {
            const errorText = await res.text();
            console.error('Keycloak user creation failed:', errorText);
            return { success: false, error: errorText || `Response status code ${res.status}` };
        }
    }
    catch (err) {
        console.error('Error contacting Keycloak server during user registration:', err);
        return { success: false, error: err.message || err };
    }
}
app.post('/api/v1/employees', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { emp_id_code, first_name, last_name, email, phone, branch_id, department_id, designation_id, role_id, joining_date, status, shift_id, dob, gender, marital_status, blood_group, personal_email, reporting_to_id, employment_type, probation_period_months, confirmation_date, exit_date, resignation_date, bank_information, pan_number, aadhar_number, esi_number, uan_number, current_address, permanent_address, emergency_contacts, education, experience, skills, emp_image } = req.body;
    if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!emp_id_code || !first_name || !last_name || !email || !joining_date) {
        return res.status(400).json({ error: 'Required fields missing' });
    }
    try {
        if (branch_id) {
            const check = await (0, db_1.query)('SELECT id FROM hrms.branches WHERE id = $1 AND company_id = $2', [branch_id, companyId]);
            if (check.rows.length === 0)
                return res.status(400).json({ error: 'Invalid Branch reference' });
        }
        if (department_id) {
            const check = await (0, db_1.query)('SELECT id FROM hrms.departments WHERE id = $1 AND company_id = $2', [department_id, companyId]);
            if (check.rows.length === 0)
                return res.status(400).json({ error: 'Invalid Department reference' });
        }
        if (designation_id) {
            const check = await (0, db_1.query)('SELECT id FROM hrms.designations WHERE id = $1 AND company_id = $2', [designation_id, companyId]);
            if (check.rows.length === 0)
                return res.status(400).json({ error: 'Invalid Designation reference' });
        }
        if (role_id) {
            const check = await (0, db_1.query)('SELECT id FROM hrms.roles WHERE id = $1 AND company_id = $2', [role_id, companyId]);
            if (check.rows.length === 0)
                return res.status(400).json({ error: 'Invalid Role reference' });
        }
        if (reporting_to_id) {
            const check = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE id = $1 AND company_id = $2', [reporting_to_id, companyId]);
            if (check.rows.length === 0)
                return res.status(400).json({ error: 'Invalid Reporting Manager reference' });
        }
        const result = await (0, db_1.query)(`INSERT INTO hrms.employees (
          company_id, role_id, branch_id, department_id, designation_id,
          emp_id_code, first_name, last_name, email, phone, status, joining_date,
          dob, gender, marital_status, blood_group, personal_email, reporting_to_id,
          employment_type, probation_period_months, confirmation_date, exit_date, resignation_date,
          pan_number, aadhar_number, esi_number, uan_number, bank_information,
          current_address, permanent_address, emergency_contacts, education, experience, skills,
          emp_image
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
          $24, $25, $26, $27, $28,
          $29, $30, $31, $32, $33, $34,
          $35
        ) RETURNING *`, [
            companyId,
            role_id || null,
            branch_id || null,
            department_id || null,
            designation_id || null,
            emp_id_code,
            first_name,
            last_name,
            email,
            phone || null,
            status || 'ACTIVE',
            joining_date,
            dob || null,
            gender || null,
            marital_status || null,
            blood_group || null,
            personal_email || null,
            reporting_to_id || null,
            employment_type || null,
            probation_period_months ? parseInt(probation_period_months) : null,
            confirmation_date || null,
            exit_date || null,
            resignation_date || null,
            pan_number || null,
            aadhar_number || null,
            esi_number || null,
            uan_number || null,
            bank_information ? (typeof bank_information === 'string' ? bank_information : JSON.stringify(bank_information)) : '[]',
            current_address || null,
            permanent_address || null,
            emergency_contacts ? (typeof emergency_contacts === 'string' ? emergency_contacts : JSON.stringify(emergency_contacts)) : '[]',
            education ? (typeof education === 'string' ? education : JSON.stringify(education)) : '[]',
            experience ? (typeof experience === 'string' ? experience : JSON.stringify(experience)) : '[]',
            skills ? (typeof skills === 'string' ? skills : JSON.stringify(skills)) : '[]',
            emp_image || null
        ]);
        const newEmployee = result.rows[0];
        // Auto-initialize documents record
        await (0, db_1.query)(`INSERT INTO hrms.employee_documents (company_id, employee_id, documents)
         VALUES ($1, $2, '[]'::jsonb)
         ON CONFLICT (employee_id) DO NOTHING`, [companyId, newEmployee.id]);
        // Auto-assign selected shift or default shift if one exists
        try {
            let assignedShiftId = shift_id;
            if (!assignedShiftId) {
                const defaultShiftRes = await (0, db_1.query)("SELECT id FROM hrms.shift_masters WHERE company_id = $1 AND is_active = true ORDER BY created_at ASC LIMIT 1", [companyId]);
                if (defaultShiftRes.rows.length > 0) {
                    assignedShiftId = defaultShiftRes.rows[0].id;
                }
            }
            if (assignedShiftId) {
                await (0, db_1.query)(`INSERT INTO hrms.employee_shifts (employee_id, shift_id, effective_from, is_default)
             VALUES ($1, $2, $3, true)`, [newEmployee.id, assignedShiftId, joining_date]);
            }
        }
        catch (shiftErr) {
            console.error('Error assigning default shift to new employee:', shiftErr);
        }
        // Initialize leave balances if hired directly as ACTIVE
        if (newEmployee.status === 'ACTIVE') {
            try {
                const leaveTypesRes = await (0, db_1.query)("SELECT id, allotted_per_year, accrual_type, name FROM hrms.leave_types WHERE company_id = $1 AND is_active = true", [companyId]);
                const joinDate = new Date(joining_date);
                const joiningMonth = joinDate.getMonth() + 1; // 1 to 12
                const remainingMonths = 12 - joiningMonth + 1;
                const currentYear = joinDate.getFullYear();
                for (const leaveType of leaveTypesRes.rows) {
                    const allottedPerYear = parseFloat(leaveType.allotted_per_year);
                    const proratedAllotted = parseFloat((allottedPerYear * (remainingMonths / 12)).toFixed(2));
                    // Insert initial prorated balance
                    await (0, db_1.query)(`INSERT INTO hrms.leave_balances (employee_id, leave_type_id, balance_year, allotted, remaining)
               VALUES ($1, $2, $3, $4, $4)
               ON CONFLICT (employee_id, leave_type_id, balance_year) DO NOTHING`, [newEmployee.id, leaveType.id, currentYear, proratedAllotted]);
                    // Log the transaction
                    await (0, db_1.query)(`INSERT INTO hrms.leave_transaction_logs (employee_id, leave_type_id, amount, transaction_type, remarks)
               VALUES ($1, $2, $3, 'ACCRUAL', $4)`, [newEmployee.id, leaveType.id, proratedAllotted, `Prorated initial allocation on direct onboarding (ACTIVE status)`]);
                }
            }
            catch (leaveErr) {
                console.error('Error initializing leave balances for active onboarding:', leaveErr);
            }
        }
        // Create Keycloak user
        const tempPassword = (first_name ? (first_name.charAt(0).toUpperCase() + first_name.slice(1).toLowerCase().replace(/[^a-zA-Z]/g, '')) : 'Welcome') + '@' + (joining_date ? new Date(joining_date).getFullYear() : '2026');
        const keycloakResult = await createKeycloakUser(email, first_name, last_name, tempPassword);
        const decodedTokenEmail = req.user?.email || 'unknown';
        enqueueActivityLog(companyId, decodedTokenEmail, 'EMPLOYEE_CREATE', 'employee', JSON.stringify({ emp_id_code, email, keycloakCreated: keycloakResult.success }), (req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''), req.headers['user-agent'] || '');
        return res.status(201).json({
            message: 'Employee registered successfully',
            employee: newEmployee,
            keycloakCreated: keycloakResult.success,
            keycloakTempPassword: keycloakResult.success ? tempPassword : null,
            keycloakError: keycloakResult.success ? null : keycloakResult.error
        });
    }
    catch (err) {
        console.error('Error creating employee:', err);
        if (err.code === '23505') {
            if (err.message.includes('email')) {
                return res.status(409).json({ error: 'An employee with this email already exists' });
            }
            return res.status(409).json({ error: 'An employee with this employee code already exists' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.put('/api/v1/employees/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { emp_id_code, first_name, last_name, email, phone, branch_id, department_id, designation_id, role_id, joining_date, status, shift_id, dob, gender, marital_status, blood_group, personal_email, reporting_to_id, employment_type, probation_period_months, confirmation_date, exit_date, resignation_date, bank_information, pan_number, aadhar_number, esi_number, uan_number, current_address, permanent_address, emergency_contacts, education, experience, skills, emp_image } = req.body;
    if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!emp_id_code || !first_name || !last_name || !email || !joining_date) {
        return res.status(400).json({ error: 'Required fields missing' });
    }
    try {
        // Fetch current status for transition checks
        const originalEmpQuery = await (0, db_1.query)('SELECT status FROM hrms.employees WHERE id = $1', [id]);
        const originalStatus = originalEmpQuery.rows.length > 0 ? originalEmpQuery.rows[0].status : null;
        if (!isSuperAdmin) {
            const empCheck = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE id = $1 AND company_id = $2', [id, companyId]);
            if (empCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied: employee not found in your company context' });
            }
        }
        if (branch_id) {
            const check = await (0, db_1.query)('SELECT id FROM hrms.branches WHERE id = $1 AND company_id = $2', [branch_id, companyId]);
            if (check.rows.length === 0)
                return res.status(400).json({ error: 'Invalid Branch reference' });
        }
        if (department_id) {
            const check = await (0, db_1.query)('SELECT id FROM hrms.departments WHERE id = $1 AND company_id = $2', [department_id, companyId]);
            if (check.rows.length === 0)
                return res.status(400).json({ error: 'Invalid Department reference' });
        }
        if (designation_id) {
            const check = await (0, db_1.query)('SELECT id FROM hrms.designations WHERE id = $1 AND company_id = $2', [designation_id, companyId]);
            if (check.rows.length === 0)
                return res.status(400).json({ error: 'Invalid Designation reference' });
        }
        if (role_id) {
            const check = await (0, db_1.query)('SELECT id FROM hrms.roles WHERE id = $1 AND company_id = $2', [role_id, companyId]);
            if (check.rows.length === 0)
                return res.status(400).json({ error: 'Invalid Role reference' });
        }
        if (reporting_to_id) {
            // Prevent setting reporting manager to self
            if (reporting_to_id === id) {
                return res.status(400).json({ error: 'Employee cannot report to themselves' });
            }
            const check = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE id = $1 AND company_id = $2', [reporting_to_id, companyId]);
            if (check.rows.length === 0)
                return res.status(400).json({ error: 'Invalid Reporting Manager reference' });
        }
        const result = await (0, db_1.query)(`UPDATE hrms.employees SET
          role_id = $1, branch_id = $2, department_id = $3, designation_id = $4,
          emp_id_code = $5, first_name = $6, last_name = $7, email = $8, phone = $9,
          status = $10, joining_date = $11,
          dob = $12, gender = $13, marital_status = $14, blood_group = $15, personal_email = $16,
          reporting_to_id = $17, employment_type = $18, probation_period_months = $19, confirmation_date = $20,
          exit_date = $21, resignation_date = $22,
          pan_number = $23, aadhar_number = $24, esi_number = $25, uan_number = $26, bank_information = $27,
          current_address = $28, permanent_address = $29,
          emergency_contacts = $30, education = $31, experience = $32, skills = $33,
          emp_image = $34,
          updated_at = NOW()
         WHERE id = $35 RETURNING *`, [
            role_id || null,
            branch_id || null,
            department_id || null,
            designation_id || null,
            emp_id_code,
            first_name,
            last_name,
            email,
            phone || null,
            status || 'ACTIVE',
            joining_date,
            dob || null,
            gender || null,
            marital_status || null,
            blood_group || null,
            personal_email || null,
            reporting_to_id || null,
            employment_type || null,
            probation_period_months ? parseInt(probation_period_months) : null,
            confirmation_date || null,
            exit_date || null,
            resignation_date || null,
            pan_number || null,
            aadhar_number || null,
            esi_number || null,
            uan_number || null,
            bank_information ? (typeof bank_information === 'string' ? bank_information : JSON.stringify(bank_information)) : '[]',
            current_address || null,
            permanent_address || null,
            emergency_contacts ? (typeof emergency_contacts === 'string' ? emergency_contacts : JSON.stringify(emergency_contacts)) : '[]',
            education ? (typeof education === 'string' ? education : JSON.stringify(education)) : '[]',
            experience ? (typeof experience === 'string' ? experience : JSON.stringify(experience)) : '[]',
            skills ? (typeof skills === 'string' ? skills : JSON.stringify(skills)) : '[]',
            emp_image || null,
            id
        ]);
        const updatedEmployee = result.rows[0];
        // Handle shift update if shift_id is provided
        if (shift_id) {
            try {
                const existingShiftCheck = await (0, db_1.query)("SELECT id FROM hrms.employee_shifts WHERE employee_id = $1 AND is_default = true", [id]);
                if (existingShiftCheck.rows.length > 0) {
                    await (0, db_1.query)("UPDATE hrms.employee_shifts SET shift_id = $1, effective_from = $2 WHERE employee_id = $3 AND is_default = true", [shift_id, joining_date, id]);
                }
                else {
                    await (0, db_1.query)("INSERT INTO hrms.employee_shifts (employee_id, shift_id, effective_from, is_default) VALUES ($1, $2, $3, true)", [id, shift_id, joining_date]);
                }
            }
            catch (shiftErr) {
                console.error('Error updating employee shift during update:', shiftErr);
            }
        }
        // If transitioning from PROBATION to ACTIVE, initialize leave balances
        if (originalStatus === 'PROBATION' && updatedEmployee.status === 'ACTIVE') {
            try {
                const leaveTypesRes = await (0, db_1.query)("SELECT id, allotted_per_year, accrual_type, name FROM hrms.leave_types WHERE company_id = $1 AND is_active = true", [companyId]);
                const refDate = updatedEmployee.confirmation_date ? new Date(updatedEmployee.confirmation_date) : new Date();
                const refMonth = refDate.getMonth() + 1; // 1 to 12
                const remainingMonths = 12 - refMonth + 1;
                const currentYear = refDate.getFullYear();
                for (const leaveType of leaveTypesRes.rows) {
                    const allottedPerYear = parseFloat(leaveType.allotted_per_year);
                    const proratedAllotted = parseFloat((allottedPerYear * (remainingMonths / 12)).toFixed(2));
                    // Insert initial prorated balance on confirmation
                    await (0, db_1.query)(`INSERT INTO hrms.leave_balances (employee_id, leave_type_id, balance_year, allotted, remaining)
               VALUES ($1, $2, $3, $4, $4)
               ON CONFLICT (employee_id, leave_type_id, balance_year) DO NOTHING`, [id, leaveType.id, currentYear, proratedAllotted]);
                    // Log the transaction
                    await (0, db_1.query)(`INSERT INTO hrms.leave_transaction_logs (employee_id, leave_type_id, amount, transaction_type, remarks)
               VALUES ($1, $2, $3, 'ACCRUAL', $4)`, [id, leaveType.id, proratedAllotted, `Prorated leaves allocated on confirmation from PROBATION to ACTIVE status`]);
                }
            }
            catch (leaveErr) {
                console.error('Error initializing leave balances on confirmation:', leaveErr);
            }
        }
        const decodedTokenEmail = req.user?.email || 'unknown';
        enqueueActivityLog(companyId, decodedTokenEmail, 'EMPLOYEE_UPDATE', 'employee', JSON.stringify({ emp_id_code, email }), (req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''), req.headers['user-agent'] || '');
        return res.json({ message: 'Employee updated successfully', employee: updatedEmployee });
    }
    catch (err) {
        console.error('Error updating employee:', err);
        if (err.code === '23505') {
            if (err.message.includes('email')) {
                return res.status(409).json({ error: 'An employee with this email already exists' });
            }
            return res.status(409).json({ error: 'An employee with this employee code already exists' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/employees/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;
    try {
        let targetCompanyId = companyId;
        if (!isSuperAdmin) {
            if (!companyId)
                return res.status(400).json({ error: 'Company context required' });
            const empCheck = await (0, db_1.query)('SELECT company_id FROM hrms.employees WHERE id = $1 AND company_id = $2', [id, companyId]);
            if (empCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied: employee not found in your company context' });
            }
        }
        else {
            const empInfo = await (0, db_1.query)('SELECT company_id FROM hrms.employees WHERE id = $1', [id]);
            if (empInfo.rows.length > 0) {
                targetCompanyId = empInfo.rows[0].company_id;
            }
        }
        const result = await (0, db_1.query)('DELETE FROM hrms.employees WHERE id = $1 RETURNING emp_id_code, email', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const { emp_id_code, email } = result.rows[0];
        const decodedTokenEmail = req.user?.email || 'unknown';
        enqueueActivityLog(targetCompanyId || null, decodedTokenEmail, 'EMPLOYEE_DELETE', 'employee', JSON.stringify({ emp_id_code, email }), (req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''), req.headers['user-agent'] || '');
        return res.json({ message: 'Employee profile deleted successfully.' });
    }
    catch (err) {
        console.error('Error deleting employee:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 📂 EMPLOYEE DOCUMENTS MANAGEMENT API
 */
app.get('/api/v1/employees/:id/documents', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;
    try {
        if (!isSuperAdmin) {
            if (!companyId)
                return res.status(400).json({ error: 'Company context required' });
            const check = await (0, db_1.query)('SELECT company_id FROM hrms.employees WHERE id = $1 AND company_id = $2', [id, companyId]);
            if (check.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied: Employee not found in your company context' });
            }
        }
        const docQuery = await (0, db_1.query)('SELECT documents FROM hrms.employee_documents WHERE employee_id = $1', [id]);
        if (docQuery.rows.length > 0) {
            return res.json({ documents: docQuery.rows[0].documents || [] });
        }
        else {
            return res.json({ documents: [] });
        }
    }
    catch (err) {
        console.error('Error fetching employee documents:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/employees/:id/documents', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;
    const { document_title, file_name, file_url, file_type } = req.body;
    if (!document_title || !file_name || !file_url || !file_type) {
        return res.status(400).json({ error: 'All document fields are required' });
    }
    try {
        const empQuery = await (0, db_1.query)('SELECT company_id FROM hrms.employees WHERE id = $1', [id]);
        if (empQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const empCompanyId = empQuery.rows[0].company_id;
        if (!isSuperAdmin && empCompanyId !== companyId) {
            return res.status(403).json({ error: 'Access denied: Employee is not in your company context' });
        }
        const docQuery = await (0, db_1.query)('SELECT id, documents FROM hrms.employee_documents WHERE employee_id = $1', [id]);
        const now = new Date().toISOString();
        const newDoc = {
            document_title,
            file_name,
            file_url,
            file_type,
            created_at: now,
            updated_at: now
        };
        if (docQuery.rows.length > 0) {
            const currentDocs = docQuery.rows[0].documents || [];
            currentDocs.push(newDoc);
            await (0, db_1.query)('UPDATE hrms.employee_documents SET documents = $1, updated_at = NOW() WHERE employee_id = $2', [JSON.stringify(currentDocs), id]);
        }
        else {
            const initialDocs = [newDoc];
            await (0, db_1.query)('INSERT INTO hrms.employee_documents (company_id, employee_id, documents) VALUES ($1, $2, $3)', [empCompanyId, id, JSON.stringify(initialDocs)]);
        }
        return res.status(201).json({ message: 'Document added successfully', document: newDoc });
    }
    catch (err) {
        console.error('Error adding employee document:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/employees/:id/documents/:docIndex', auth_1.authenticateToken, async (req, res) => {
    const { id, docIndex } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;
    try {
        const empQuery = await (0, db_1.query)('SELECT company_id FROM hrms.employees WHERE id = $1', [id]);
        if (empQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        const empCompanyId = empQuery.rows[0].company_id;
        if (!isSuperAdmin && empCompanyId !== companyId) {
            return res.status(403).json({ error: 'Access denied: Employee is not in your company context' });
        }
        const docQuery = await (0, db_1.query)('SELECT documents FROM hrms.employee_documents WHERE employee_id = $1', [id]);
        if (docQuery.rows.length === 0) {
            return res.status(404).json({ error: 'No documents found for this employee' });
        }
        const currentDocs = docQuery.rows[0].documents || [];
        const idx = parseInt(docIndex, 10);
        if (isNaN(idx) || idx < 0 || idx >= currentDocs.length) {
            return res.status(400).json({ error: 'Invalid document index' });
        }
        currentDocs.splice(idx, 1);
        await (0, db_1.query)('UPDATE hrms.employee_documents SET documents = $1, updated_at = NOW() WHERE employee_id = $2', [JSON.stringify(currentDocs), id]);
        return res.json({ message: 'Document deleted successfully', documents: currentDocs });
    }
    catch (err) {
        console.error('Error deleting employee document:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 📍 BRANCHES CRUD API
 */
app.get('/api/v1/branches', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    if (!companyId || companyId === 'all' || companyId === '') {
        if (isSuperAdmin) {
            try {
                const result = await (0, db_1.query)(`SELECT b.id, b.company_id, b.name, b.address, b.status, b.created_at, c.name as company_name 
             FROM hrms.branches b
             JOIN hrms.companies c ON b.company_id = c.id
             ORDER BY c.name ASC, b.name ASC`);
                return res.json({ branches: result.rows });
            }
            catch (err) {
                console.error('Error fetching all branches:', err);
                return res.status(500).json({ error: 'Internal server database error' });
            }
        }
        return res.status(400).json({ error: 'Company ID is required' });
    }
    try {
        const result = await (0, db_1.query)('SELECT id, company_id, name, address, status, created_at FROM hrms.branches WHERE company_id = $1 ORDER BY name ASC', [companyId]);
        return res.json({ branches: result.rows });
    }
    catch (err) {
        console.error('Error fetching branches:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/branches', auth_1.authenticateToken, (0, auth_1.requirePermission)('create_branches'), async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { name, address } = req.body;
    if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!name) {
        return res.status(400).json({ error: 'Branch name is required' });
    }
    try {
        const result = await (0, db_1.query)('INSERT INTO hrms.branches (company_id, name, address) VALUES ($1, $2, $3) RETURNING *', [companyId, name, address || '']);
        return res.status(201).json({ message: 'Branch created successfully', branch: result.rows[0] });
    }
    catch (err) {
        console.error('Error creating branch:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Branch with this name already exists' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.put('/api/v1/branches/:id', auth_1.authenticateToken, (0, auth_1.requirePermission)('edit_branches'), async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;
    const { name, address, status } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Branch name is required' });
    }
    try {
        if (!isSuperAdmin) {
            const branchCheck = await (0, db_1.query)('SELECT company_id FROM hrms.branches WHERE id = $1', [id]);
            if (branchCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Branch not found' });
            }
            if (branchCheck.rows[0].company_id !== companyId) {
                return res.status(403).json({ error: 'Access denied: Branch is not in your company context' });
            }
        }
        const result = await (0, db_1.query)('UPDATE hrms.branches SET name = $1, address = $2, status = $3 WHERE id = $4 RETURNING *', [name, address || '', status || 'ACTIVE', id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Branch not found' });
        }
        return res.json({ message: 'Branch updated successfully', branch: result.rows[0] });
    }
    catch (err) {
        console.error('Error updating branch:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Branch with this name already exists' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/branches/:id', auth_1.authenticateToken, (0, auth_1.requirePermission)('delete_branches'), async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;
    try {
        if (!isSuperAdmin) {
            const branchCheck = await (0, db_1.query)('SELECT company_id FROM hrms.branches WHERE id = $1', [id]);
            if (branchCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Branch not found' });
            }
            if (branchCheck.rows[0].company_id !== companyId) {
                return res.status(403).json({ error: 'Access denied: Branch is not in your company context' });
            }
        }
        const result = await (0, db_1.query)('DELETE FROM hrms.branches WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Branch not found' });
        }
        return res.json({ message: 'Branch deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting branch:', err);
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Cannot delete branch because it has active departments, designations, or employees linked to it' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 📁 DEPARTMENTS CRUD API
 */
app.get('/api/v1/departments', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    const { branchId } = req.query;
    if (!companyId) {
        if (isSuperAdmin) {
            try {
                let q = 'SELECT d.id, d.company_id, d.branch_id, b.name as branch_name, d.name, d.description, d.status FROM hrms.departments d LEFT JOIN hrms.branches b ON d.branch_id = b.id';
                const params = [];
                if (branchId) {
                    q += ' WHERE d.branch_id = $1';
                    params.push(branchId);
                }
                q += ' ORDER BY d.name ASC';
                const result = await (0, db_1.query)(q, params);
                return res.json({ departments: result.rows });
            }
            catch (err) {
                console.error('Error fetching all departments:', err);
                return res.status(500).json({ error: 'Internal server database error' });
            }
        }
        return res.status(400).json({ error: 'Company ID is required' });
    }
    try {
        let q = 'SELECT d.id, d.company_id, d.branch_id, b.name as branch_name, d.name, d.description, d.status FROM hrms.departments d LEFT JOIN hrms.branches b ON d.branch_id = b.id WHERE d.company_id = $1';
        const params = [companyId];
        if (branchId) {
            q += ' AND d.branch_id = $2';
            params.push(branchId);
        }
        q += ' ORDER BY d.name ASC';
        const result = await (0, db_1.query)(q, params);
        return res.json({ departments: result.rows });
    }
    catch (err) {
        console.error('Error fetching departments:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/departments', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { branch_id, name, description } = req.body;
    if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!branch_id) {
        return res.status(400).json({ error: 'Branch reference is required' });
    }
    if (!name) {
        return res.status(400).json({ error: 'Department name is required' });
    }
    try {
        const branchCheck = await (0, db_1.query)('SELECT id FROM hrms.branches WHERE id = $1 AND company_id = $2', [branch_id, companyId]);
        if (branchCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid Branch reference' });
        }
        const result = await (0, db_1.query)('INSERT INTO hrms.departments (company_id, branch_id, name, description) VALUES ($1, $2, $3, $4) RETURNING *', [companyId, branch_id, name, description || '']);
        return res.status(201).json({ message: 'Department created successfully', department: result.rows[0] });
    }
    catch (err) {
        console.error('Error creating department:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Department already exists under this branch' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.put('/api/v1/departments/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { branch_id, name, description, status } = req.body;
    if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!branch_id) {
        return res.status(400).json({ error: 'Branch reference is required' });
    }
    if (!name) {
        return res.status(400).json({ error: 'Department name is required' });
    }
    try {
        if (!isSuperAdmin) {
            const deptCheck = await (0, db_1.query)('SELECT company_id FROM hrms.departments WHERE id = $1', [id]);
            if (deptCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Department not found' });
            }
            if (deptCheck.rows[0].company_id !== companyId) {
                return res.status(403).json({ error: 'Access denied: Department is not in your company context' });
            }
        }
        const branchCheck = await (0, db_1.query)('SELECT id FROM hrms.branches WHERE id = $1 AND company_id = $2', [branch_id, companyId]);
        if (branchCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid Branch reference for this company' });
        }
        const result = await (0, db_1.query)('UPDATE hrms.departments SET branch_id = $1, name = $2, description = $3, status = $4 WHERE id = $5 RETURNING *', [branch_id, name, description || '', status || 'ACTIVE', id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Department not found' });
        }
        return res.json({ message: 'Department updated successfully', department: result.rows[0] });
    }
    catch (err) {
        console.error('Error updating department:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Department already exists under this branch' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/departments/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;
    try {
        if (!isSuperAdmin) {
            const deptCheck = await (0, db_1.query)('SELECT company_id FROM hrms.departments WHERE id = $1', [id]);
            if (deptCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Department not found' });
            }
            if (deptCheck.rows[0].company_id !== companyId) {
                return res.status(403).json({ error: 'Access denied: Department is not in your company context' });
            }
        }
        const result = await (0, db_1.query)('DELETE FROM hrms.departments WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Department not found' });
        }
        return res.json({ message: 'Department deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting department:', err);
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Cannot delete department because it has active designations or employees linked to it' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 🏷️ DESIGNATIONS CRUD API
 */
app.get('/api/v1/designations', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    const { branchId, departmentId } = req.query;
    if (!companyId) {
        if (isSuperAdmin) {
            try {
                let q = `SELECT d.id, d.company_id, d.branch_id, b.name as branch_name, 
                          d.department_id, dept.name as department_name, d.name, d.description, d.status 
                   FROM hrms.designations d 
                   LEFT JOIN hrms.branches b ON d.branch_id = b.id 
                   LEFT JOIN hrms.departments dept ON d.department_id = dept.id`;
                const params = [];
                let paramCount = 0;
                if (branchId) {
                    paramCount++;
                    q += ` WHERE d.branch_id = $${paramCount}`;
                    params.push(branchId);
                }
                if (departmentId) {
                    paramCount++;
                    q += paramCount === 1 ? ' WHERE' : ' AND';
                    q += ` d.department_id = $${paramCount}`;
                    params.push(departmentId);
                }
                q += ' ORDER BY d.name ASC';
                const result = await (0, db_1.query)(q, params);
                return res.json({ designations: result.rows });
            }
            catch (err) {
                console.error('Error fetching all designations:', err);
                return res.status(500).json({ error: 'Internal server database error' });
            }
        }
        return res.status(400).json({ error: 'Company ID is required' });
    }
    try {
        let q = `SELECT d.id, d.company_id, d.branch_id, b.name as branch_name, 
                      d.department_id, dept.name as department_name, d.name, d.description, d.status 
               FROM hrms.designations d 
               LEFT JOIN hrms.branches b ON d.branch_id = b.id 
               LEFT JOIN hrms.departments dept ON d.department_id = dept.id 
               WHERE d.company_id = $1`;
        const params = [companyId];
        let paramCount = 1;
        if (branchId) {
            paramCount++;
            q += ` AND d.branch_id = $${paramCount}`;
            params.push(branchId);
        }
        if (departmentId) {
            paramCount++;
            q += ` AND d.department_id = $${paramCount}`;
            params.push(departmentId);
        }
        q += ' ORDER BY d.name ASC';
        const result = await (0, db_1.query)(q, params);
        return res.json({ designations: result.rows });
    }
    catch (err) {
        console.error('Error fetching designations:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/designations', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { branch_id, department_id, name, description } = req.body;
    if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!branch_id || !department_id) {
        return res.status(400).json({ error: 'Branch and Department references are required' });
    }
    if (!name) {
        return res.status(400).json({ error: 'Designation name is required' });
    }
    try {
        const branchCheck = await (0, db_1.query)('SELECT id FROM hrms.branches WHERE id = $1 AND company_id = $2', [branch_id, companyId]);
        if (branchCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid Branch reference' });
        }
        const deptCheck = await (0, db_1.query)('SELECT id FROM hrms.departments WHERE id = $1 AND branch_id = $2 AND company_id = $3', [department_id, branch_id, companyId]);
        if (deptCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid Department reference' });
        }
        const result = await (0, db_1.query)('INSERT INTO hrms.designations (company_id, branch_id, department_id, name, description) VALUES ($1, $2, $3, $4, $5) RETURNING *', [companyId, branch_id, department_id, name, description || '']);
        return res.status(201).json({ message: 'Designation created successfully', designation: result.rows[0] });
    }
    catch (err) {
        console.error('Error creating designation:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Designation already exists in this hierarchy' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.put('/api/v1/designations/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { branch_id, department_id, name, description, status } = req.body;
    if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!branch_id || !department_id) {
        return res.status(400).json({ error: 'Branch and Department references are required' });
    }
    if (!name) {
        return res.status(400).json({ error: 'Designation name is required' });
    }
    try {
        if (!isSuperAdmin) {
            const desigCheck = await (0, db_1.query)('SELECT company_id FROM hrms.designations WHERE id = $1', [id]);
            if (desigCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Designation not found' });
            }
            if (desigCheck.rows[0].company_id !== companyId) {
                return res.status(403).json({ error: 'Access denied: Designation is not in your company context' });
            }
        }
        const branchCheck = await (0, db_1.query)('SELECT id FROM hrms.branches WHERE id = $1 AND company_id = $2', [branch_id, companyId]);
        if (branchCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid Branch reference' });
        }
        const deptCheck = await (0, db_1.query)('SELECT id FROM hrms.departments WHERE id = $1 AND branch_id = $2 AND company_id = $3', [department_id, branch_id, companyId]);
        if (deptCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid Department reference' });
        }
        const result = await (0, db_1.query)('UPDATE hrms.designations SET branch_id = $1, department_id = $2, name = $3, description = $4, status = $5 WHERE id = $6 RETURNING *', [branch_id, department_id, name, description || '', status || 'ACTIVE', id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Designation not found' });
        }
        return res.json({ message: 'Designation updated successfully', designation: result.rows[0] });
    }
    catch (err) {
        console.error('Error updating designation:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Designation already exists in this hierarchy' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/designations/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;
    try {
        if (!isSuperAdmin) {
            const desigCheck = await (0, db_1.query)('SELECT company_id FROM hrms.designations WHERE id = $1', [id]);
            if (desigCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Designation not found' });
            }
            if (desigCheck.rows[0].company_id !== companyId) {
                return res.status(403).json({ error: 'Access denied: Designation is not in your company context' });
            }
        }
        const result = await (0, db_1.query)('DELETE FROM hrms.designations WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Designation not found' });
        }
        return res.json({ message: 'Designation deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting designation:', err);
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Cannot delete designation because it has active employees linked to it' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 🔄 DYNAMIC DATABASE TABLE-BASED PERMISSIONS SYNCHRONIZATION
 */
async function syncDynamicPermissions() {
    try {
        // 1. Get all tables in hrms schema (excluding internal system/meta tables)
        const tablesResult = await (0, db_1.query)(`SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'hrms' 
         AND table_type = 'BASE TABLE'
         AND table_name NOT IN ('permissions', 'role_permissions', 'activity_logs')
       ORDER BY table_name`);
        const tables = tablesResult.rows.map(row => row.table_name);
        if (tables.length === 0)
            return;
        // 2. Define standard CRUD permissions for each table
        const requiredPermissions = [];
        tables.forEach(table => {
            const moduleName = table;
            requiredPermissions.push({
                name: `view_${table}`,
                description: `Allow viewing of ${table} records`,
                module: moduleName
            }, {
                name: `create_${table}`,
                description: `Allow creating new ${table} records`,
                module: moduleName
            }, {
                name: `edit_${table}`,
                description: `Allow modifying existing ${table} records`,
                module: moduleName
            }, {
                name: `delete_${table}`,
                description: `Allow deleting ${table} records`,
                module: moduleName
            });
        });
        // 3. Insert permissions using INSERT ... ON CONFLICT (name) DO UPDATE
        for (const perm of requiredPermissions) {
            await (0, db_1.query)(`INSERT INTO hrms.permissions (name, description, module) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (name) DO UPDATE 
         SET description = EXCLUDED.description, module = EXCLUDED.module`, [perm.name, perm.description, perm.module]);
        }
        // 4. Clean up permissions for tables that no longer exist
        const activeNames = requiredPermissions.map(p => p.name);
        const placeholders = activeNames.map((_, i) => '$' + (i + 1)).join(', ');
        await (0, db_1.query)(`DELETE FROM hrms.permissions 
       WHERE name NOT IN (${placeholders})`, activeNames);
    }
    catch (err) {
        console.error('[Permissions Sync] Error synchronizing permissions:', err);
    }
}
/**
 * 🔑 ROLES & PERMISSIONS API
 */
app.get('/api/v1/roles', auth_1.authenticateToken, async (req, res) => {
    await syncDynamicPermissions();
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    if (!companyId) {
        if (isSuperAdmin) {
            try {
                const result = await (0, db_1.query)(`SELECT r.id, r.company_id, r.name, r.description, r.created_at, c.name as company_name,
              COALESCE(
                json_agg(
                  json_build_object('id', p.id, 'name', p.name, 'module', p.module)
                ) FILTER (WHERE p.id IS NOT NULL), 
                '[]'
              ) as permissions
             FROM hrms.roles r
             LEFT JOIN hrms.companies c ON r.company_id = c.id
             LEFT JOIN hrms.role_permissions rp ON r.id = rp.role_id
             LEFT JOIN hrms.permissions p ON rp.permission_id = p.id
             GROUP BY r.id, c.name
             ORDER BY r.name ASC`);
                return res.json({ roles: result.rows });
            }
            catch (err) {
                console.error('Error fetching all roles:', err);
                return res.status(500).json({ error: 'Internal server database error' });
            }
        }
        return res.status(400).json({ error: 'Company ID is required' });
    }
    try {
        const result = await (0, db_1.query)(`SELECT r.id, r.company_id, r.name, r.description, r.created_at, c.name as company_name,
          COALESCE(
            json_agg(
              json_build_object('id', p.id, 'name', p.name, 'module', p.module)
            ) FILTER (WHERE p.id IS NOT NULL), 
            '[]'
          ) as permissions
         FROM hrms.roles r
         LEFT JOIN hrms.companies c ON r.company_id = c.id
         LEFT JOIN hrms.role_permissions rp ON r.id = rp.role_id
         LEFT JOIN hrms.permissions p ON rp.permission_id = p.id
         WHERE r.company_id = $1
         GROUP BY r.id, c.name
         ORDER BY r.name ASC`, [companyId]);
        return res.json({ roles: result.rows });
    }
    catch (err) {
        console.error('Error fetching roles:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/roles', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { name, description } = req.body;
    if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!name) {
        return res.status(400).json({ error: 'Role name is required' });
    }
    try {
        const result = await (0, db_1.query)('INSERT INTO hrms.roles (company_id, name, description) VALUES ($1, $2, $3) RETURNING *', [companyId, name, description || '']);
        return res.status(201).json({ message: 'Role created successfully', role: result.rows[0] });
    }
    catch (err) {
        console.error('Error creating role:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Role already exists' });
        }
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.get('/api/v1/permissions', auth_1.authenticateToken, async (_req, res) => {
    try {
        await syncDynamicPermissions();
        const result = await (0, db_1.query)('SELECT id, name, description, module FROM hrms.permissions ORDER BY module, name ASC');
        return res.json({ permissions: result.rows });
    }
    catch (err) {
        console.error('Error fetching permissions:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/roles/:roleId/permissions', auth_1.authenticateToken, async (req, res) => {
    const { roleId } = req.params;
    const { permissionIds } = req.body;
    if (!roleId || !Array.isArray(permissionIds)) {
        return res.status(400).json({ error: 'Invalid parameters' });
    }
    try {
        await (0, db_1.query)('BEGIN');
        const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
        const companyId = req.user?.companyId;
        if (!isSuperAdmin) {
            const roleCheck = await (0, db_1.query)('SELECT id FROM hrms.roles WHERE id = $1 AND company_id = $2', [roleId, companyId]);
            if (roleCheck.rows.length === 0) {
                await (0, db_1.query)('ROLLBACK');
                return res.status(403).json({ error: 'Access denied' });
            }
        }
        await (0, db_1.query)('DELETE FROM hrms.role_permissions WHERE role_id = $1', [roleId]);
        for (const permId of permissionIds) {
            await (0, db_1.query)('INSERT INTO hrms.role_permissions (role_id, permission_id) VALUES ($1, $2)', [roleId, permId]);
        }
        await (0, db_1.query)('COMMIT');
        return res.json({ message: 'Role permissions updated successfully' });
    }
    catch (err) {
        await (0, db_1.query)('ROLLBACK');
        console.error('Error updating role permissions:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 🕒 SHIFTS CRUD APIs
 */
app.get('/api/v1/shifts', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyIdRaw = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    const companyId = (companyIdRaw === 'all' || companyIdRaw === 'undefined' || companyIdRaw === 'null' || !companyIdRaw) ? null : companyIdRaw;
    if (!companyId && !isSuperAdmin)
        return res.status(400).json({ error: 'Company ID is required' });
    try {
        let result;
        if (companyId) {
            result = await (0, db_1.query)(`SELECT sm.id, sm.company_id, sm.shift_name as name, sm.start_time, sm.end_time, sm.grace_in_minutes, sm.grace_out_minutes, 
                sm.min_half_day_minutes as halfday_minutes, sm.min_full_day_minutes as fullday_minutes, 
                sm.is_night_shift as is_overnight, sm.is_active, c.name as company_name 
         FROM hrms.shift_masters sm
         LEFT JOIN hrms.companies c ON sm.company_id = c.id
         WHERE sm.company_id = $1 AND sm.is_active = true 
         ORDER BY sm.shift_name ASC`, [companyId]);
        }
        else {
            result = await (0, db_1.query)(`SELECT sm.id, sm.company_id, sm.shift_name as name, sm.start_time, sm.end_time, sm.grace_in_minutes, sm.grace_out_minutes, 
                sm.min_half_day_minutes as halfday_minutes, sm.min_full_day_minutes as fullday_minutes, 
                sm.is_night_shift as is_overnight, sm.is_active, c.name as company_name 
         FROM hrms.shift_masters sm
         LEFT JOIN hrms.companies c ON sm.company_id = c.id
         WHERE sm.is_active = true 
         ORDER BY c.name ASC, sm.shift_name ASC`);
        }
        return res.json({ shifts: result.rows });
    }
    catch (err) {
        console.error('Error fetching shifts:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/shifts', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { name, start_time, end_time, grace_in_minutes, grace_out_minutes, halfday_minutes, fullday_minutes, is_overnight } = req.body;
    if (!companyId || !name || !start_time || !end_time) {
        return res.status(400).json({ error: 'Required fields missing: companyId, name, start_time, end_time' });
    }
    try {
        const result = await (0, db_1.query)(`INSERT INTO hrms.shift_masters (company_id, shift_name, start_time, end_time, grace_in_minutes, grace_out_minutes, min_half_day_minutes, min_full_day_minutes, is_night_shift)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id, company_id, shift_name as name, start_time, end_time, grace_in_minutes, grace_out_minutes, min_half_day_minutes as halfday_minutes, min_full_day_minutes as fullday_minutes, is_night_shift as is_overnight`, [
            companyId,
            name,
            start_time,
            end_time,
            grace_in_minutes ? parseInt(grace_in_minutes) : 15,
            grace_out_minutes ? parseInt(grace_out_minutes) : 15,
            halfday_minutes ? parseInt(halfday_minutes) : 240,
            fullday_minutes ? parseInt(fullday_minutes) : 480,
            is_overnight || false
        ]);
        (0, exports.logUserAction)(req, 'CREATE_SHIFT', 'Shifts', `Created shift timing '${name}' (${start_time} - ${end_time})`);
        return res.status(201).json({ message: 'Shift created successfully', shift: result.rows[0] });
    }
    catch (err) {
        console.error('Error creating shift:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.put('/api/v1/shifts/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { name, start_time, end_time, grace_in_minutes, grace_out_minutes, halfday_minutes, fullday_minutes, is_overnight } = req.body;
    try {
        if (!isSuperAdmin) {
            const check = await (0, db_1.query)('SELECT id FROM hrms.shift_masters WHERE id = $1 AND company_id = $2', [id, companyId]);
            if (check.rows.length === 0)
                return res.status(403).json({ error: 'Access denied' });
        }
        const result = await (0, db_1.query)(`UPDATE hrms.shift_masters 
       SET shift_name = $1, start_time = $2, end_time = $3, grace_in_minutes = $4, grace_out_minutes = $5, min_half_day_minutes = $6, min_full_day_minutes = $7, is_night_shift = $8, updated_at = NOW()
       WHERE id = $9 
       RETURNING id, company_id, shift_name as name, start_time, end_time, grace_in_minutes, grace_out_minutes, min_half_day_minutes as halfday_minutes, min_full_day_minutes as fullday_minutes, is_night_shift as is_overnight`, [
            name,
            start_time,
            end_time,
            grace_in_minutes ? parseInt(grace_in_minutes) : 15,
            grace_out_minutes ? parseInt(grace_out_minutes) : 15,
            halfday_minutes ? parseInt(halfday_minutes) : 240,
            fullday_minutes ? parseInt(fullday_minutes) : 480,
            is_overnight || false,
            id
        ]);
        (0, exports.logUserAction)(req, 'UPDATE_SHIFT', 'Shifts', `Updated shift timing '${name}'`);
        return res.json({ message: 'Shift updated successfully', shift: result.rows[0] });
    }
    catch (err) {
        console.error('Error updating shift:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/shifts/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    try {
        if (!isSuperAdmin) {
            const check = await (0, db_1.query)('SELECT id FROM hrms.shift_masters WHERE id = $1 AND company_id = $2', [id, companyId]);
            if (check.rows.length === 0)
                return res.status(403).json({ error: 'Access denied' });
        }
        await (0, db_1.query)('UPDATE hrms.shift_masters SET is_active = false WHERE id = $1', [id]);
        (0, exports.logUserAction)(req, 'DELETE_SHIFT', 'Shifts', `Deactivated shift timing ID ${id}`);
        return res.json({ message: 'Shift deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting shift:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 🕒 EMPLOYEE SHIFTS MAPPING APIs
 */
app.get('/api/v1/employee-shifts', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? (req.query.companyId || null) : req.user?.companyId;
    if (!companyId && !isSuperAdmin)
        return res.status(400).json({ error: 'Company ID is required' });
    try {
        let result;
        if (companyId) {
            result = await (0, db_1.query)(`SELECT es.id, es.employee_id, es.shift_id, es.effective_from, es.effective_to, es.is_default,
                e.first_name, e.last_name, e.emp_id_code, e.company_id as company_id,
                sm.shift_name as shift_name,
                c.name as company_name
         FROM hrms.employee_shifts es
         JOIN hrms.employees e ON es.employee_id = e.id
         JOIN hrms.shift_masters sm ON es.shift_id = sm.id
         LEFT JOIN hrms.companies c ON e.company_id = c.id
         WHERE e.company_id = $1
         ORDER BY es.effective_from DESC`, [companyId]);
        }
        else {
            result = await (0, db_1.query)(`SELECT es.id, es.employee_id, es.shift_id, es.effective_from, es.effective_to, es.is_default,
                e.first_name, e.last_name, e.emp_id_code, e.company_id as company_id,
                sm.shift_name as shift_name,
                c.name as company_name
         FROM hrms.employee_shifts es
         JOIN hrms.employees e ON es.employee_id = e.id
         JOIN hrms.shift_masters sm ON es.shift_id = sm.id
         LEFT JOIN hrms.companies c ON e.company_id = c.id
         ORDER BY c.name ASC, es.effective_from DESC`);
        }
        return res.json({ employeeShifts: result.rows });
    }
    catch (err) {
        console.error('Error fetching employee shifts:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/employee-shifts', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { employee_id, shift_id, effective_from, effective_to, is_default } = req.body;
    if (!companyId || !employee_id || !shift_id || !effective_from) {
        return res.status(400).json({ error: 'Required fields missing' });
    }
    try {
        const empCheck = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE id = $1 AND company_id = $2', [employee_id, companyId]);
        if (empCheck.rows.length === 0)
            return res.status(400).json({ error: 'Invalid employee reference' });
        if (is_default) {
            await (0, db_1.query)('UPDATE hrms.employee_shifts SET is_default = false WHERE employee_id = $1', [employee_id]);
        }
        const result = await (0, db_1.query)(`INSERT INTO hrms.employee_shifts (employee_id, shift_id, effective_from, effective_to, is_default)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [employee_id, shift_id, effective_from, effective_to || null, is_default || false]);
        return res.status(201).json({ message: 'Employee shift assigned successfully', employeeShift: result.rows[0] });
    }
    catch (err) {
        console.error('Error assigning shift:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/employee-shifts/rotate', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { employee_ids, shift_ids, days_interval, start_date, end_date } = req.body;
    if (!companyId || !employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0 ||
        !shift_ids || !Array.isArray(shift_ids) || shift_ids.length === 0 ||
        !days_interval || days_interval <= 0 || !start_date || !end_date) {
        return res.status(400).json({ error: 'Required fields missing or invalid' });
    }
    const start = new Date(start_date);
    const end = new Date(end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return res.status(400).json({ error: 'Invalid date range' });
    }
    try {
        await (0, db_1.query)('BEGIN');
        for (const empId of employee_ids) {
            await (0, db_1.query)(`DELETE FROM hrms.employee_shifts 
         WHERE employee_id = $1 
           AND (
             (effective_from BETWEEN $2 AND $3) 
             OR (effective_to BETWEEN $2 AND $3)
             OR (effective_from <= $2 AND (effective_to IS NULL OR effective_to >= $3))
           )`, [empId, start_date, end_date]);
            let currentDate = new Date(start);
            let shiftIndex = 0;
            while (currentDate <= end) {
                const currentShiftId = shift_ids[shiftIndex];
                const blockStart = new Date(currentDate);
                const blockEnd = new Date(currentDate);
                blockEnd.setDate(blockEnd.getDate() + days_interval - 1);
                const finalBlockEnd = blockEnd > end ? end : blockEnd;
                const effectiveFromStr = blockStart.toISOString().split('T')[0];
                const effectiveToStr = finalBlockEnd.toISOString().split('T')[0];
                await (0, db_1.query)(`INSERT INTO hrms.employee_shifts (employee_id, shift_id, effective_from, effective_to, is_default)
           VALUES ($1, $2, $3, $4, false)`, [empId, currentShiftId, effectiveFromStr, effectiveToStr]);
                currentDate.setDate(currentDate.getDate() + days_interval);
                shiftIndex = (shiftIndex + 1) % shift_ids.length;
            }
        }
        await (0, db_1.query)('COMMIT');
        return res.status(201).json({ message: 'Rotational shifts scheduled successfully' });
    }
    catch (err) {
        await (0, db_1.query)('ROLLBACK');
        console.error('Error generating shift rotations:', err);
        return res.status(500).json({ error: 'Internal server database error during rotation scheduling' });
    }
});
app.put('/api/v1/employee-shifts/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { shift_id, effective_from, effective_to, is_default } = req.body;
    try {
        const check = await (0, db_1.query)(`SELECT es.id, es.employee_id FROM hrms.employee_shifts es 
       JOIN hrms.employees e ON es.employee_id = e.id 
       WHERE es.id = $1 AND e.company_id = $2`, [id, companyId]);
        if (check.rows.length === 0)
            return res.status(403).json({ error: 'Access denied' });
        const employee_id = check.rows[0].employee_id;
        if (is_default) {
            await (0, db_1.query)('UPDATE hrms.employee_shifts SET is_default = false WHERE employee_id = $1 AND id != $2', [employee_id, id]);
        }
        const result = await (0, db_1.query)(`UPDATE hrms.employee_shifts 
       SET shift_id = $1, effective_from = $2, effective_to = $3, is_default = $4
       WHERE id = $5 RETURNING *`, [shift_id, effective_from, effective_to || null, is_default || false, id]);
        return res.json({ message: 'Employee shift assignment updated successfully', employeeShift: result.rows[0] });
    }
    catch (err) {
        console.error('Error updating employee shift:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/employee-shifts/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    try {
        const check = await (0, db_1.query)(`SELECT es.id FROM hrms.employee_shifts es 
       JOIN hrms.employees e ON es.employee_id = e.id 
       WHERE es.id = $1 AND e.company_id = $2`, [id, companyId]);
        if (check.rows.length === 0)
            return res.status(403).json({ error: 'Access denied' });
        await (0, db_1.query)('DELETE FROM hrms.employee_shifts WHERE id = $1', [id]);
        return res.json({ message: 'Employee shift assignment removed successfully' });
    }
    catch (err) {
        console.error('Error deleting employee shift:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 🕒 ATTENDANCE SUMMARY LOG APIs
 */
app.get('/api/v1/attendance/summary', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? (req.query.companyId || null) : req.user?.companyId;
    const { startDate, endDate, employeeId } = req.query;
    if (!companyId && !isSuperAdmin)
        return res.status(400).json({ error: 'Company ID is required' });
    try {
        let sql = `
      SELECT asum.id, asum.company_id, asum.employee_id, asum.attendance_date, asum.shift_id,
             asum.first_in, asum.last_out, asum.worked_minutes, asum.break_minutes,
             asum.overtime_minutes, asum.approved_overtime_minutes, asum.ot_status,
             asum.late_minutes, asum.early_exit_minutes, asum.status, asum.punch_count,
             asum.is_regularized, asum.regularized_by, asum.processed_at,
             e.first_name, e.last_name, e.emp_id_code,
             sm.shift_name as shift_name,
             c.name as company_name
      FROM hrms.attendance_summary asum
      JOIN hrms.employees e ON asum.employee_id = e.id
      LEFT JOIN hrms.shift_masters sm ON asum.shift_id = sm.id
      LEFT JOIN hrms.companies c ON asum.company_id = c.id
    `;
        const params = [];
        let paramIdx = 1;
        let whereClauses = [];
        if (companyId) {
            whereClauses.push(`asum.company_id = $${paramIdx++}`);
            params.push(companyId);
        }
        if (startDate) {
            whereClauses.push(`asum.attendance_date >= $${paramIdx++}`);
            params.push(startDate);
        }
        if (endDate) {
            whereClauses.push(`asum.attendance_date <= $${paramIdx++}`);
            params.push(endDate);
        }
        if (employeeId) {
            whereClauses.push(`asum.employee_id = $${paramIdx++}`);
            params.push(employeeId);
        }
        if (whereClauses.length > 0) {
            sql += ` WHERE ` + whereClauses.join(' AND ');
        }
        sql += ` ORDER BY c.name ASC, asum.attendance_date DESC, e.emp_id_code ASC`;
        const result = await (0, db_1.query)(sql, params);
        return res.json({ attendanceSummary: result.rows });
    }
    catch (err) {
        console.error('Error fetching attendance summary:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/attendance/summary', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { employee_id, attendance_date, shift_id, first_in, last_out, status, worked_minutes, late_minutes } = req.body;
    if (!companyId || !employee_id || !attendance_date || !status) {
        return res.status(400).json({ error: 'Required fields missing' });
    }
    try {
        const result = await (0, db_1.query)(`INSERT INTO hrms.attendance_summary 
       (company_id, employee_id, attendance_date, shift_id, first_in, last_out, status, worked_minutes, late_minutes, punch_count, is_regularized, processed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 2, true, NOW())
       ON CONFLICT (employee_id, attendance_date) 
       DO UPDATE SET 
         shift_id = EXCLUDED.shift_id,
         first_in = EXCLUDED.first_in,
         last_out = EXCLUDED.last_out,
         status = EXCLUDED.status,
         worked_minutes = EXCLUDED.worked_minutes,
         late_minutes = EXCLUDED.late_minutes,
         is_regularized = true,
         processed_at = NOW()
       RETURNING *`, [
            companyId,
            employee_id,
            attendance_date,
            shift_id || null,
            first_in || null,
            last_out || null,
            status,
            worked_minutes ? parseInt(worked_minutes) : 0,
            late_minutes ? parseInt(late_minutes) : 0
        ]);
        return res.status(201).json({ message: 'Attendance summary saved successfully', attendanceRecord: result.rows[0] });
    }
    catch (err) {
        console.error('Error saving attendance summary:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.put('/api/v1/attendance/summary/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { status, first_in, last_out, worked_minutes, late_minutes, shift_id } = req.body;
    try {
        const check = await (0, db_1.query)('SELECT id FROM hrms.attendance_summary WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (check.rows.length === 0)
            return res.status(403).json({ error: 'Access denied' });
        const result = await (0, db_1.query)(`UPDATE hrms.attendance_summary 
       SET status = $1, first_in = $2, last_out = $3, worked_minutes = $4, late_minutes = $5, shift_id = $6, is_regularized = true, processed_at = NOW()
       WHERE id = $7 RETURNING *`, [
            status,
            first_in || null,
            last_out || null,
            worked_minutes ? parseInt(worked_minutes) : 0,
            late_minutes ? parseInt(late_minutes) : 0,
            shift_id || null,
            id
        ]);
        return res.json({ message: 'Attendance record updated successfully', attendanceRecord: result.rows[0] });
    }
    catch (err) {
        console.error('Error updating attendance summary:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/attendance/summary/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    try {
        const check = await (0, db_1.query)('SELECT id FROM hrms.attendance_summary WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (check.rows.length === 0)
            return res.status(403).json({ error: 'Access denied' });
        await (0, db_1.query)('DELETE FROM hrms.attendance_summary WHERE id = $1', [id]);
        return res.json({ message: 'Attendance record deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting attendance summary:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 🕒 RAW PUNCH LOGS APIs
 */
app.get('/api/v1/attendance/punches', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? (req.query.companyId || null) : req.user?.companyId;
    if (!companyId && !isSuperAdmin)
        return res.status(400).json({ error: 'Company ID is required' });
    try {
        let result;
        if (companyId) {
            result = await (0, db_1.query)(`SELECT rp.id, rp.company_id, rp.employee_id, rp.punch_time, rp.device_id, rp.source,
                rp.direction, rp.latitude, rp.longitude, rp.ip_address, rp.image_url, rp.is_processed, rp.created_at,
                e.first_name, e.last_name, e.emp_id_code,
                c.name as company_name
         FROM hrms.attendance_raw_punches rp
         JOIN hrms.employees e ON rp.employee_id = e.id
         LEFT JOIN hrms.companies c ON rp.company_id = c.id
         WHERE rp.company_id = $1
         ORDER BY rp.punch_time DESC
         LIMIT 500`, [companyId]);
        }
        else {
            result = await (0, db_1.query)(`SELECT rp.id, rp.company_id, rp.employee_id, rp.punch_time, rp.device_id, rp.source,
                rp.direction, rp.latitude, rp.longitude, rp.ip_address, rp.image_url, rp.is_processed, rp.created_at,
                e.first_name, e.last_name, e.emp_id_code,
                c.name as company_name
         FROM hrms.attendance_raw_punches rp
         JOIN hrms.employees e ON rp.employee_id = e.id
         LEFT JOIN hrms.companies c ON rp.company_id = c.id
         ORDER BY rp.punch_time DESC
         LIMIT 500`);
        }
        return res.json({ punches: result.rows });
    }
    catch (err) {
        console.error('Error fetching raw punches:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/attendance/punches', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { employee_id, punch_time, source, direction, ip_address, latitude, longitude, image_url } = req.body;
    if (!companyId || !employee_id || !punch_time || !direction) {
        return res.status(400).json({ error: 'Required fields missing' });
    }
    try {
        const empCheck = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE id = $1 AND company_id = $2', [employee_id, companyId]);
        if (empCheck.rows.length === 0)
            return res.status(400).json({ error: 'Invalid employee reference' });
        let actualIp = ip_address;
        if (!actualIp) {
            const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
            actualIp = Array.isArray(rawIp)
                ? rawIp[0]
                : typeof rawIp === 'string'
                    ? rawIp.split(',')[0].trim()
                    : '';
            if (actualIp === '::1' || actualIp === '::ffff:127.0.0.1') {
                actualIp = '127.0.0.1';
            }
        }
        const result = await (0, db_1.query)(`INSERT INTO hrms.attendance_raw_punches (company_id, employee_id, punch_time, source, direction, ip_address, latitude, longitude, image_url, is_processed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false) RETURNING *`, [
            companyId,
            employee_id,
            punch_time,
            source || 'WEB',
            direction,
            actualIp || null,
            latitude ? parseFloat(latitude) : null,
            longitude ? parseFloat(longitude) : null,
            image_url || null
        ]);
        const punchDate = new Date(punch_time).toISOString().split('T')[0];
        const dayPunches = await (0, db_1.query)(`SELECT punch_time, direction FROM hrms.attendance_raw_punches 
       WHERE employee_id = $1 AND punch_time::date = $2::date
       ORDER BY punch_time ASC`, [employee_id, punchDate]);
        let firstIn = null;
        let lastOut = null;
        let punchCount = dayPunches.rows.length;
        const inPunches = dayPunches.rows.filter(p => p.direction === 'IN');
        const outPunches = dayPunches.rows.filter(p => p.direction === 'OUT');
        if (inPunches.length > 0) {
            firstIn = inPunches[0].punch_time;
        }
        if (outPunches.length > 0) {
            lastOut = outPunches[outPunches.length - 1].punch_time;
        }
        let workedMinutes = 0;
        if (firstIn && lastOut) {
            workedMinutes = Math.round((new Date(lastOut).getTime() - new Date(firstIn).getTime()) / (1000 * 60));
        }
        let shiftId = null;
        let shiftStartTime = null;
        let shiftGraceIn = 0;
        const shiftRes = await (0, db_1.query)(`SELECT es.shift_id, sm.start_time, sm.grace_in_minutes 
       FROM hrms.employee_shifts es
       JOIN hrms.shift_masters sm ON es.shift_id = sm.id
       WHERE es.employee_id = $1 AND es.effective_from <= $2::date 
       ORDER BY es.effective_from DESC LIMIT 1`, [employee_id, punchDate]);
        if (shiftRes.rows.length > 0) {
            shiftId = shiftRes.rows[0].shift_id;
            shiftStartTime = shiftRes.rows[0].start_time;
            shiftGraceIn = shiftRes.rows[0].grace_in_minutes || 0;
        }
        else {
            const defShift = await (0, db_1.query)(`SELECT id, start_time, grace_in_minutes FROM hrms.shift_masters WHERE company_id = $1 AND is_active = true ORDER BY created_at ASC LIMIT 1`, [companyId]);
            if (defShift.rows.length > 0) {
                shiftId = defShift.rows[0].id;
                shiftStartTime = defShift.rows[0].start_time;
                shiftGraceIn = defShift.rows[0].grace_in_minutes || 0;
            }
        }
        let lateMinutes = 0;
        if (firstIn && shiftStartTime) {
            const [sh, sm] = shiftStartTime.split(':').map(Number);
            const punchLocalString = new Date(firstIn).toLocaleTimeString('en-US', {
                hour12: false,
                timeZone: 'Asia/Kolkata'
            });
            const [ph, pm] = punchLocalString.split(':').map(Number);
            const punchTotalMinutes = ph * 60 + pm;
            const shiftTotalMinutes = sh * 60 + sm;
            if (punchTotalMinutes > shiftTotalMinutes + shiftGraceIn) {
                lateMinutes = punchTotalMinutes - shiftTotalMinutes;
            }
        }
        let status = 'ABSENT';
        if (workedMinutes >= 480) {
            status = 'PRESENT';
        }
        else if (workedMinutes >= 240) {
            status = 'HALF_DAY';
        }
        else if (punchCount > 0) {
            status = 'HALF_DAY';
        }
        await (0, db_1.query)(`INSERT INTO hrms.attendance_summary 
       (company_id, employee_id, attendance_date, shift_id, first_in, last_out, status, worked_minutes, late_minutes, punch_count, processed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (employee_id, attendance_date) 
       DO UPDATE SET 
         first_in = COALESCE(EXCLUDED.first_in, hrms.attendance_summary.first_in),
         last_out = COALESCE(EXCLUDED.last_out, hrms.attendance_summary.last_out),
         worked_minutes = EXCLUDED.worked_minutes,
         late_minutes = EXCLUDED.late_minutes,
         status = EXCLUDED.status,
         punch_count = EXCLUDED.punch_count,
         processed_at = NOW()`, [companyId, employee_id, punchDate, shiftId, firstIn, lastOut, status, workedMinutes, lateMinutes, punchCount]);
        return res.status(201).json({ message: 'Punch log created and processed successfully', punch: result.rows[0] });
    }
    catch (err) {
        console.error('Error creating punch:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 🕒 ATTENDANCE RULES & POLICIES APIs
 */
app.get('/api/v1/attendance/policies', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    if (!companyId && isSuperAdmin) {
        try {
            const result = await (0, db_1.query)(`SELECT ap.*, c.name as company_name 
         FROM hrms.attendance_policies ap
         JOIN hrms.companies c ON ap.company_id = c.id
         WHERE ap.is_active = true 
         ORDER BY c.name ASC`);
            return res.json({ policies: result.rows });
        }
        catch (err) {
            console.error('Error fetching all attendance policies:', err);
            return res.status(500).json({ error: 'Internal server database error' });
        }
    }
    if (!companyId)
        return res.status(400).json({ error: 'Company ID is required' });
    try {
        const result = await (0, db_1.query)('SELECT * FROM hrms.attendance_policies WHERE company_id = $1 AND is_active = true LIMIT 1', [companyId]);
        return res.json({ policy: result.rows[0] || null });
    }
    catch (err) {
        console.error('Error fetching attendance policies:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/attendance/policies', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { policy_name, late_allowed_per_month, late_marks_deduction_rule, sandwich_rule, max_permission_count_per_month, max_permission_minutes_per_month, max_single_permission_minutes, permission_affects_late, permission_affects_early_exit, allow_mobile_punch, allow_web_punch, require_selfie, require_gps, enforce_device_binding } = req.body;
    if (!companyId || !policy_name) {
        return res.status(400).json({ error: 'Required fields missing: companyId, policy_name' });
    }
    try {
        const check = await (0, db_1.query)('SELECT id FROM hrms.attendance_policies WHERE company_id = $1 AND is_active = true LIMIT 1', [companyId]);
        let result;
        if (check.rows.length > 0) {
            result = await (0, db_1.query)(`UPDATE hrms.attendance_policies SET
          policy_name = $1, late_allowed_per_month = $2, late_marks_deduction_rule = $3, sandwich_rule = $4,
          max_permission_count_per_month = $5, max_permission_minutes_per_month = $6, max_single_permission_minutes = $7,
          permission_affects_late = $8, permission_affects_early_exit = $9, allow_mobile_punch = $10, allow_web_punch = $11,
          require_selfie = $12, require_gps = $13, enforce_device_binding = $14, updated_at = NOW()
         WHERE id = $15 RETURNING *`, [
                policy_name,
                late_allowed_per_month ? parseInt(late_allowed_per_month) : 3,
                late_marks_deduction_rule || '3_LATES_1_HALF_DAY',
                sandwich_rule || false,
                max_permission_count_per_month ? parseInt(max_permission_count_per_month) : 3,
                max_permission_minutes_per_month ? parseInt(max_permission_minutes_per_month) : 360,
                max_single_permission_minutes ? parseInt(max_single_permission_minutes) : 120,
                permission_affects_late !== undefined ? permission_affects_late : true,
                permission_affects_early_exit !== undefined ? permission_affects_early_exit : true,
                allow_mobile_punch !== undefined ? allow_mobile_punch : true,
                allow_web_punch !== undefined ? allow_web_punch : true,
                require_selfie !== undefined ? require_selfie : false,
                require_gps !== undefined ? require_gps : false,
                enforce_device_binding !== undefined ? enforce_device_binding : false,
                check.rows[0].id
            ]);
        }
        else {
            result = await (0, db_1.query)(`INSERT INTO hrms.attendance_policies 
         (company_id, policy_name, late_allowed_per_month, late_marks_deduction_rule, sandwich_rule,
          max_permission_count_per_month, max_permission_minutes_per_month, max_single_permission_minutes,
          permission_affects_late, permission_affects_early_exit, allow_mobile_punch, allow_web_punch,
          require_selfie, require_gps, enforce_device_binding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`, [
                companyId,
                policy_name,
                late_allowed_per_month ? parseInt(late_allowed_per_month) : 3,
                late_marks_deduction_rule || '3_LATES_1_HALF_DAY',
                sandwich_rule || false,
                max_permission_count_per_month ? parseInt(max_permission_count_per_month) : 3,
                max_permission_minutes_per_month ? parseInt(max_permission_minutes_per_month) : 360,
                max_single_permission_minutes ? parseInt(max_single_permission_minutes) : 120,
                permission_affects_late !== undefined ? permission_affects_late : true,
                permission_affects_early_exit !== undefined ? permission_affects_early_exit : true,
                allow_mobile_punch !== undefined ? allow_mobile_punch : true,
                allow_web_punch !== undefined ? allow_web_punch : true,
                require_selfie !== undefined ? require_selfie : false,
                require_gps !== undefined ? require_gps : false,
                enforce_device_binding !== undefined ? enforce_device_binding : false
            ]);
        }
        return res.json({ message: 'Attendance policy saved successfully', policy: result.rows[0] });
    }
    catch (err) {
        console.error('Error saving attendance policy:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 🕒 ATTENDANCE REGULARIZATION APIs
 */
app.get('/api/v1/attendance/regularizations', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? (req.query.companyId || null) : req.user?.companyId;
    const email = req.user?.email;
    const scope = req.query.scope;
    const filterSelf = scope === 'my';
    const filterTeam = scope === 'team';
    if (!companyId && !isSuperAdmin)
        return res.status(400).json({ error: 'Company ID is required' });
    try {
        let employeeId = null;
        if (email) {
            const empCheck = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
            if (empCheck.rows.length > 0) {
                employeeId = empCheck.rows[0].id;
            }
        }
        let sql = `
      SELECT ar.id, ar.employee_id, ar.attendance_date, ar.requested_in, ar.requested_out, ar.reason,
             ar.attachment_url, ar.status, ar.approved_by, ar.approved_at, ar.remarks, ar.created_at,
             e.first_name, e.last_name, e.emp_id_code, e.company_id as company_id,
             appr.first_name as approved_by_first_name, appr.last_name as approved_by_last_name,
             c.name as company_name
      FROM hrms.attendance_regularizations ar
      JOIN hrms.employees e ON ar.employee_id = e.id
      LEFT JOIN hrms.employees appr ON ar.approved_by = appr.id
      LEFT JOIN hrms.companies c ON e.company_id = c.id
    `;
        const params = [];
        const whereClauses = [];
        if (companyId) {
            params.push(companyId);
            whereClauses.push(`e.company_id = $${params.length}`);
        }
        if (filterSelf && employeeId) {
            params.push(employeeId);
            whereClauses.push(`ar.employee_id = $${params.length}`);
        }
        else if (filterTeam && employeeId) {
            if (isSuperAdmin) {
                params.push(employeeId);
                whereClauses.push(`ar.employee_id != $${params.length}`);
            }
            else {
                params.push(employeeId);
                whereClauses.push(`e.reporting_to_id = $${params.length}`);
            }
        }
        if (whereClauses.length > 0) {
            sql += ` WHERE ` + whereClauses.join(' AND ');
        }
        sql += ` ORDER BY ar.created_at DESC`;
        const result = await (0, db_1.query)(sql, params);
        return res.json({ regularizations: result.rows });
    }
    catch (err) {
        console.error('Error fetching regularizations:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/attendance/regularizations', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { employee_id, attendance_date, requested_in, requested_out, reason } = req.body;
    if (!companyId || !employee_id || !attendance_date || !reason) {
        return res.status(400).json({ error: 'Required fields missing' });
    }
    try {
        const empCheck = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE id = $1 AND company_id = $2', [employee_id, companyId]);
        if (empCheck.rows.length === 0)
            return res.status(400).json({ error: 'Invalid employee reference' });
        const result = await (0, db_1.query)(`INSERT INTO hrms.attendance_regularizations (employee_id, attendance_date, requested_in, requested_out, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       ON CONFLICT (employee_id, attendance_date)
       DO UPDATE SET
         requested_in = EXCLUDED.requested_in,
         requested_out = EXCLUDED.requested_out,
         reason = EXCLUDED.reason,
         status = 'PENDING',
         created_at = NOW()
       RETURNING *`, [employee_id, attendance_date, requested_in || null, requested_out || null, reason]);
        (0, exports.logUserAction)(req, 'APPLY_REGULARIZATION', 'Attendance Regularizations', `Submitted attendance regularization request for date ${attendance_date}`);
        return res.status(201).json({ message: 'Regularization request submitted successfully', regularization: result.rows[0] });
    }
    catch (err) {
        console.error('Error submitting regularization:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/attendance/regularizations/:id/action', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { action, remarks } = req.body;
    if (!action || !['APPROVED', 'REJECTED'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action, must be APPROVED or REJECTED' });
    }
    try {
        const reqQuery = await (0, db_1.query)(`SELECT ar.*, e.company_id FROM hrms.attendance_regularizations ar
       JOIN hrms.employees e ON ar.employee_id = e.id
       WHERE ar.id = $1`, [id]);
        if (reqQuery.rows.length === 0)
            return res.status(404).json({ error: 'Regularization request not found' });
        const request = reqQuery.rows[0];
        if (!isSuperAdmin && request.company_id !== companyId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const userEmail = req.user?.email;
        let approverId = null;
        if (userEmail) {
            const appRes = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE email = $1 LIMIT 1', [userEmail]);
            if (appRes.rows.length > 0)
                approverId = appRes.rows[0].id;
        }
        const updateRes = await (0, db_1.query)(`UPDATE hrms.attendance_regularizations
       SET status = $1, approved_by = $2, approved_at = NOW(), remarks = $3
       WHERE id = $4 RETURNING *`, [action, approverId, remarks || null, id]);
        (0, exports.logUserAction)(req, `${action}_REGULARIZATION`, 'Attendance Regularizations', `${action === 'APPROVED' ? 'Approved' : 'Rejected'} attendance regularization request for date ${request.attendance_date}`);
        if (action === 'APPROVED') {
            const reqIn = request.requested_in;
            const reqOut = request.requested_out;
            const reqDate = new Date(request.attendance_date).toISOString().split('T')[0];
            const firstInTs = reqIn ? `${reqDate}T${reqIn}+05:30` : null;
            const lastOutTs = reqOut ? `${reqDate}T${reqOut}+05:30` : null;
            let workedMinutes = 0;
            if (firstInTs && lastOutTs) {
                workedMinutes = Math.round((new Date(lastOutTs).getTime() - new Date(firstInTs).getTime()) / (1000 * 60));
            }
            let shiftId = null;
            const shiftRes = await (0, db_1.query)(`SELECT shift_id FROM hrms.employee_shifts 
         WHERE employee_id = $1 AND effective_from <= $2::date 
         ORDER BY effective_from DESC LIMIT 1`, [request.employee_id, reqDate]);
            if (shiftRes.rows.length > 0) {
                shiftId = shiftRes.rows[0].shift_id;
            }
            let status = 'ABSENT';
            if (workedMinutes >= 480) {
                status = 'PRESENT';
            }
            else if (workedMinutes >= 240) {
                status = 'HALF_DAY';
            }
            else if (reqIn || reqOut) {
                status = 'PRESENT';
            }
            await (0, db_1.query)(`INSERT INTO hrms.attendance_summary 
         (company_id, employee_id, attendance_date, shift_id, first_in, last_out, status, worked_minutes, punch_count, is_regularized, regularized_by, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 2, true, $9, NOW())
         ON CONFLICT (employee_id, attendance_date) 
         DO UPDATE SET 
           first_in = EXCLUDED.first_in,
           last_out = EXCLUDED.last_out,
           status = EXCLUDED.status,
           worked_minutes = EXCLUDED.worked_minutes,
           is_regularized = true,
           regularized_by = EXCLUDED.regularized_by,
           processed_at = NOW()`, [request.company_id, request.employee_id, reqDate, shiftId, firstInTs, lastOutTs, status, workedMinutes, approverId]);
        }
        return res.json({ message: `Regularization request ${action.toLowerCase()} successfully`, regularization: updateRes.rows[0] });
    }
    catch (err) {
        console.error('Error processing regularization action:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 🕒 ATTENDANCE PERMISSION REQUESTS APIs
 */
app.get('/api/v1/attendance/permissions', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? (req.query.companyId || null) : req.user?.companyId;
    const email = req.user?.email;
    const scope = req.query.scope;
    const filterSelf = scope === 'my';
    const filterTeam = scope === 'team';
    if (!companyId && !isSuperAdmin)
        return res.status(400).json({ error: 'Company ID is required' });
    try {
        let employeeId = null;
        if (email) {
            const empCheck = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
            if (empCheck.rows.length > 0) {
                employeeId = empCheck.rows[0].id;
            }
        }
        let sql = `
      SELECT pr.id, pr.company_id, pr.employee_id, pr.permission_type, pr.permission_date, pr.from_time, pr.to_time,
             pr.duration_minutes, pr.reason, pr.status, pr.approved_by, pr.approved_at, pr.created_at, pr.remarks,
             e.first_name, e.last_name, e.emp_id_code,
             appr.first_name as approved_by_first_name, appr.last_name as approved_by_last_name,
             c.name as company_name
      FROM hrms.permission_requests pr
      JOIN hrms.employees e ON pr.employee_id = e.id
      LEFT JOIN hrms.employees appr ON pr.approved_by = appr.id
      LEFT JOIN hrms.companies c ON pr.company_id = c.id
    `;
        const params = [];
        const whereClauses = [];
        if (companyId) {
            params.push(companyId);
            whereClauses.push(`pr.company_id = $${params.length}`);
        }
        if (filterSelf && employeeId) {
            params.push(employeeId);
            whereClauses.push(`pr.employee_id = $${params.length}`);
        }
        else if (filterTeam && employeeId) {
            if (isSuperAdmin) {
                params.push(employeeId);
                whereClauses.push(`pr.employee_id != $${params.length}`);
            }
            else {
                params.push(employeeId);
                whereClauses.push(`e.reporting_to_id = $${params.length}`);
            }
        }
        if (whereClauses.length > 0) {
            sql += ` WHERE ` + whereClauses.join(' AND ');
        }
        sql += ` ORDER BY pr.created_at DESC`;
        const result = await (0, db_1.query)(sql, params);
        return res.json({ permissions: result.rows });
    }
    catch (err) {
        console.error('Error fetching permission requests:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/attendance/permissions', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { employee_id, permission_type, permission_date, from_time, to_time, duration_minutes, reason } = req.body;
    if (!companyId || !employee_id || !permission_type || !permission_date || !from_time || !to_time || !duration_minutes || !reason) {
        return res.status(400).json({ error: 'Required fields missing' });
    }
    try {
        const empCheck = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE id = $1 AND company_id = $2', [employee_id, companyId]);
        if (empCheck.rows.length === 0)
            return res.status(400).json({ error: 'Invalid employee reference' });
        const result = await (0, db_1.query)(`INSERT INTO hrms.permission_requests (company_id, employee_id, permission_type, permission_date, from_time, to_time, duration_minutes, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
       RETURNING *`, [companyId, employee_id, permission_type, permission_date, from_time, to_time, duration_minutes, reason]);
        (0, exports.logUserAction)(req, 'APPLY_PERMISSION', 'Permissions', `Submitted permission request (${permission_type}) for date ${permission_date}`);
        return res.status(201).json({ message: 'Permission request submitted successfully', permission: result.rows[0] });
    }
    catch (err) {
        console.error('Error submitting permission request:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/attendance/permissions/:id/action', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { action, remarks } = req.body;
    if (!action || !['APPROVED', 'REJECTED'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action, must be APPROVED or REJECTED' });
    }
    try {
        const reqQuery = await (0, db_1.query)(`SELECT pr.*, e.company_id FROM hrms.permission_requests pr
       JOIN hrms.employees e ON pr.employee_id = e.id
       WHERE pr.id = $1`, [id]);
        if (reqQuery.rows.length === 0)
            return res.status(404).json({ error: 'Permission request not found' });
        const request = reqQuery.rows[0];
        if (!isSuperAdmin && request.company_id !== companyId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const userEmail = req.user?.email;
        let approverId = null;
        if (userEmail) {
            const appRes = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE email = $1 LIMIT 1', [userEmail]);
            if (appRes.rows.length > 0)
                approverId = appRes.rows[0].id;
        }
        const updateRes = await (0, db_1.query)(`UPDATE hrms.permission_requests
       SET status = $1, approved_by = $2, approved_at = NOW(), remarks = $3
       WHERE id = $4 RETURNING *`, [action, approverId, remarks, id]);
        (0, exports.logUserAction)(req, `${action}_PERMISSION`, 'Permissions', `${action === 'APPROVED' ? 'Approved' : 'Rejected'} permission request for date ${request.permission_date}`);
        return res.json({ message: `Permission request ${action.toLowerCase()} successfully`, permission: updateRes.rows[0] });
    }
    catch (err) {
        console.error('Error processing permission request action:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 📅 HOLIDAYS CRUD APIs
 */
app.get('/api/v1/holidays', auth_1.authenticateToken, (0, auth_1.requirePermission)('view_holiday_masters'), async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    let companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    try {
        if (isSuperAdmin && (!companyId || companyId === 'all' || companyId === '')) {
            const result = await (0, db_1.query)(`SELECT h.*, c.name as company_name 
         FROM hrms.holiday_masters h
         JOIN hrms.companies c ON h.company_id = c.id
         WHERE h.is_active = true 
         ORDER BY h.holiday_date ASC, c.name ASC`);
            return res.json({ holidays: result.rows, isAll: true });
        }
        else {
            if (!companyId || companyId === 'all')
                return res.status(400).json({ error: 'Company ID is required' });
            const result = await (0, db_1.query)(`SELECT h.*, c.name as company_name 
         FROM hrms.holiday_masters h
         LEFT JOIN hrms.companies c ON h.company_id = c.id
         WHERE h.company_id = $1 AND h.is_active = true 
         ORDER BY h.holiday_date ASC`, [companyId]);
            return res.json({ holidays: result.rows, isAll: false });
        }
    }
    catch (err) {
        console.error('Error fetching holidays:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/holidays', auth_1.authenticateToken, (0, auth_1.requirePermission)('create_holiday_masters'), async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { name, holiday_date, description, is_restricted, branch_id, restricted_branches } = req.body;
    if (!companyId || companyId === 'all' || !name || !holiday_date) {
        return res.status(400).json({ error: 'Required fields missing: companyId, name, holiday_date' });
    }
    const restrictedList = Array.isArray(restricted_branches)
        ? JSON.stringify(restricted_branches)
        : (typeof restricted_branches === 'string' ? restricted_branches : '[]');
    try {
        const result = await (0, db_1.query)(`INSERT INTO hrms.holiday_masters (company_id, branch_id, name, holiday_date, description, is_restricted, restricted_branches)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [
            companyId,
            branch_id || null,
            name,
            holiday_date,
            description || '',
            is_restricted || false,
            restrictedList
        ]);
        (0, exports.logUserAction)(req, 'CREATE_HOLIDAY', 'Holidays', `Created holiday '${name}' on ${holiday_date}`);
        return res.status(201).json({ message: 'Holiday created successfully', holiday: result.rows[0] });
    }
    catch (err) {
        console.error('Error creating holiday:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.put('/api/v1/holidays/:id', auth_1.authenticateToken, (0, auth_1.requirePermission)('edit_holiday_masters'), async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { name, holiday_date, description, is_restricted, branch_id, restricted_branches } = req.body;
    try {
        if (!isSuperAdmin) {
            if (!companyId)
                return res.status(403).json({ error: 'Access denied' });
            const check = await (0, db_1.query)('SELECT id FROM hrms.holiday_masters WHERE id = $1 AND company_id = $2', [id, companyId]);
            if (check.rows.length === 0)
                return res.status(403).json({ error: 'Access denied: Holiday does not belong to your company' });
        }
        const restrictedList = Array.isArray(restricted_branches)
            ? JSON.stringify(restricted_branches)
            : (typeof restricted_branches === 'string' ? restricted_branches : '[]');
        const result = await (0, db_1.query)(`UPDATE hrms.holiday_masters 
       SET name = $1, holiday_date = $2, description = $3, is_restricted = $4, branch_id = $5, restricted_branches = $6
       WHERE id = $7 RETURNING *`, [
            name,
            holiday_date,
            description || '',
            is_restricted || false,
            branch_id || null,
            restrictedList,
            id
        ]);
        (0, exports.logUserAction)(req, 'UPDATE_HOLIDAY', 'Holidays', `Updated holiday '${name}' on ${holiday_date}`);
        return res.json({ message: 'Holiday updated successfully', holiday: result.rows[0] });
    }
    catch (err) {
        console.error('Error updating holiday:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.put('/api/v1/holidays/:id/restrict-branches', auth_1.authenticateToken, (0, auth_1.requirePermission)('edit_holiday_masters'), async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { restricted_branches } = req.body;
    try {
        if (!isSuperAdmin) {
            if (!companyId)
                return res.status(403).json({ error: 'Access denied' });
            const check = await (0, db_1.query)('SELECT id FROM hrms.holiday_masters WHERE id = $1 AND company_id = $2', [id, companyId]);
            if (check.rows.length === 0)
                return res.status(403).json({ error: 'Access denied: Holiday does not belong to your company' });
        }
        const restrictedList = Array.isArray(restricted_branches)
            ? JSON.stringify(restricted_branches)
            : (typeof restricted_branches === 'string' ? restricted_branches : '[]');
        const result = await (0, db_1.query)(`UPDATE hrms.holiday_masters 
       SET restricted_branches = $1
       WHERE id = $2 RETURNING *`, [restrictedList, id]);
        (0, exports.logUserAction)(req, 'UPDATE_HOLIDAY_RESTRICTIONS', 'Holidays', `Updated branch restrictions for holiday ID ${id}`);
        return res.json({ message: 'Branch restrictions updated successfully', holiday: result.rows[0] });
    }
    catch (err) {
        console.error('Error updating branch restrictions:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/holidays/:id', auth_1.authenticateToken, (0, auth_1.requirePermission)('delete_holiday_masters'), async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? (req.body.companyId || req.query.companyId) : req.user?.companyId;
    try {
        if (!isSuperAdmin) {
            if (!companyId)
                return res.status(403).json({ error: 'Access denied' });
            const check = await (0, db_1.query)('SELECT id FROM hrms.holiday_masters WHERE id = $1 AND company_id = $2', [id, companyId]);
            if (check.rows.length === 0)
                return res.status(403).json({ error: 'Access denied: Holiday does not belong to your company' });
        }
        await (0, db_1.query)('UPDATE hrms.holiday_masters SET is_active = false WHERE id = $1', [id]);
        (0, exports.logUserAction)(req, 'DELETE_HOLIDAY', 'Holidays', `Deactivated holiday ID ${id}`);
        return res.json({ message: 'Holiday deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting holiday:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 📅 LEAVE TYPES CRUD APIs
 */
app.get('/api/v1/leave-types', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    if (!companyId && !isSuperAdmin)
        return res.status(400).json({ error: 'Company ID is required' });
    try {
        let sql = 'SELECT lt.*, c.name as company_name FROM hrms.leave_types lt LEFT JOIN hrms.companies c ON lt.company_id = c.id WHERE lt.is_active = true';
        const params = [];
        if (companyId && companyId !== 'all') {
            params.push(companyId);
            sql += ` AND lt.company_id = $${params.length}`;
        }
        sql += ' ORDER BY lt.name ASC';
        const result = await (0, db_1.query)(sql, params);
        return res.json({ leaveTypes: result.rows });
    }
    catch (err) {
        console.error('Error fetching leave types:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/leave-types', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { name, code, allotted_per_year, accrual_type, carry_forward_type, max_carry_forward, is_paid, is_wfh } = req.body;
    if (!companyId || !name || !code || !allotted_per_year) {
        return res.status(400).json({ error: 'Required fields missing: companyId, name, code, allotted_per_year' });
    }
    try {
        // Check for duplicate name or code
        const duplicateCheck = await (0, db_1.query)('SELECT id FROM hrms.leave_types WHERE company_id = $1 AND (LOWER(name) = LOWER($2) OR LOWER(code) = LOWER($3))', [companyId, name, code]);
        if (duplicateCheck.rows.length > 0) {
            return res.status(400).json({ error: 'A leave type with this name or code already exists for your company.' });
        }
        const result = await (0, db_1.query)(`INSERT INTO hrms.leave_types (company_id, name, code, allotted_per_year, accrual_type, carry_forward_type, max_carry_forward, is_paid, is_wfh)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, [
            companyId,
            name,
            code.toUpperCase(),
            parseFloat(allotted_per_year),
            accrual_type || 'YEARLY',
            carry_forward_type || 'NONE',
            max_carry_forward ? parseFloat(max_carry_forward) : 0,
            is_paid !== undefined ? is_paid : true,
            is_wfh !== undefined ? is_wfh : false
        ]);
        (0, exports.logUserAction)(req, 'CREATE_LEAVE_TYPE', 'Leaves', `Created leave type '${name}' (${code}) with ${allotted_per_year} days/year`);
        return res.status(201).json({ message: 'Leave type created successfully', leaveType: result.rows[0] });
    }
    catch (err) {
        console.error('Error creating leave type:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.put('/api/v1/leave-types/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { name, code, allotted_per_year, accrual_type, carry_forward_type, max_carry_forward, is_paid, is_wfh } = req.body;
    try {
        if (!isSuperAdmin) {
            const check = await (0, db_1.query)('SELECT id FROM hrms.leave_types WHERE id = $1 AND company_id = $2', [id, companyId]);
            if (check.rows.length === 0)
                return res.status(403).json({ error: 'Access denied' });
        }
        // Check for duplicate name or code (excluding the current row)
        const duplicateCheck = await (0, db_1.query)('SELECT id FROM hrms.leave_types WHERE company_id = $1 AND (LOWER(name) = LOWER($2) OR LOWER(code) = LOWER($3)) AND id != $4', [companyId, name, code, id]);
        if (duplicateCheck.rows.length > 0) {
            return res.status(400).json({ error: 'A leave type with this name or code already exists for your company.' });
        }
        const result = await (0, db_1.query)(`UPDATE hrms.leave_types 
       SET name = $1, code = $2, allotted_per_year = $3, accrual_type = $4, carry_forward_type = $5, max_carry_forward = $6, is_paid = $7, is_wfh = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`, [
            name,
            code.toUpperCase(),
            parseFloat(allotted_per_year),
            accrual_type || 'YEARLY',
            carry_forward_type || 'NONE',
            max_carry_forward ? parseFloat(max_carry_forward) : 0,
            is_paid !== undefined ? is_paid : true,
            is_wfh !== undefined ? is_wfh : false,
            id
        ]);
        (0, exports.logUserAction)(req, 'UPDATE_LEAVE_TYPE', 'Leaves', `Updated leave type '${name}' (${code})`);
        return res.json({ message: 'Leave type updated successfully', leaveType: result.rows[0] });
    }
    catch (err) {
        console.error('Error updating leave type:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/leave-types/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    try {
        if (!isSuperAdmin) {
            const check = await (0, db_1.query)('SELECT id FROM hrms.leave_types WHERE id = $1 AND company_id = $2', [id, companyId]);
            if (check.rows.length === 0)
                return res.status(403).json({ error: 'Access denied' });
        }
        await (0, db_1.query)('UPDATE hrms.leave_types SET is_active = false WHERE id = $1', [id]);
        (0, exports.logUserAction)(req, 'DELETE_LEAVE_TYPE', 'Leaves', `Deactivated leave type ID ${id}`);
        return res.json({ message: 'Leave type deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting leave type:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 📅 LEAVE BALANCES APIs
 */
app.get('/api/v1/leave-balances', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const email = req.user?.email;
    try {
        let employeeId = req.query.employeeId;
        if (!employeeId && !isSuperAdmin && email) {
            const empCheck = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
            if (empCheck.rows.length > 0) {
                employeeId = empCheck.rows[0].id;
            }
        }
        if (!employeeId) {
            return res.json({ balances: [] });
        }
        const currentYear = new Date().getFullYear();
        const result = await (0, db_1.query)(`SELECT lb.*, lt.name as leave_type_name, lt.code as leave_type_code, lt.is_paid
       FROM hrms.leave_balances lb 
       JOIN hrms.leave_types lt ON lb.leave_type_id = lt.id 
       WHERE lb.employee_id = $1 AND lb.balance_year = $2`, [employeeId, currentYear]);
        return res.json({ balances: result.rows });
    }
    catch (err) {
        console.error('Error fetching leave balances:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 📅 LEAVE REQUESTS APIs
 */
app.get('/api/v1/leave-requests', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    const email = req.user?.email;
    const scope = req.query.scope;
    const filterSelf = req.query.self === 'true' || scope === 'my';
    const filterTeam = scope === 'team';
    if (!companyId && !isSuperAdmin)
        return res.status(400).json({ error: 'Company ID is required' });
    try {
        let employeeId = null;
        if (email) {
            const empCheck = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
            if (empCheck.rows.length > 0) {
                employeeId = empCheck.rows[0].id;
            }
        }
        let sql = `
      SELECT lr.*, lt.name as leave_type_name, lt.code as leave_type_code,
             e.first_name || ' ' || e.last_name as employee_name,
             ap.first_name || ' ' || ap.last_name as approved_by_name
      FROM hrms.leave_requests lr
      JOIN hrms.leave_types lt ON lr.leave_type_id = lt.id
      JOIN hrms.employees e ON lr.employee_id = e.id
      LEFT JOIN hrms.employees ap ON lr.approved_by = ap.id
    `;
        const params = [];
        const whereClauses = [];
        if (companyId && companyId !== 'all') {
            params.push(companyId);
            whereClauses.push(`lt.company_id = $${params.length}`);
        }
        else if (!isSuperAdmin && companyId) {
            params.push(companyId);
            whereClauses.push(`lt.company_id = $${params.length}`);
        }
        if (filterSelf && employeeId) {
            params.push(employeeId);
            whereClauses.push(`lr.employee_id = $${params.length}`);
        }
        else if (filterTeam && employeeId) {
            if (isSuperAdmin) {
                if (employeeId) {
                    params.push(employeeId);
                    whereClauses.push(`lr.employee_id != $${params.length}`);
                }
            }
            else if (employeeId) {
                params.push(employeeId);
                whereClauses.push(`e.reporting_to_id = $${params.length}`);
            }
        }
        else if (!isSuperAdmin && employeeId) {
            params.push(employeeId);
            whereClauses.push(`(lr.employee_id = $${params.length} OR e.reporting_to_id = $${params.length})`);
        }
        if (whereClauses.length > 0) {
            sql += ` WHERE ` + whereClauses.join(' AND ');
        }
        sql += ` ORDER BY lr.created_at DESC`;
        const result = await (0, db_1.query)(sql, params);
        return res.json({ requests: result.rows });
    }
    catch (err) {
        console.error('Error fetching leave requests:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/leave-requests', auth_1.authenticateToken, async (req, res) => {
    const email = req.user?.email;
    const { leave_type_id, from_date, to_date, total_days, reason } = req.body;
    if (!leave_type_id || !from_date || !to_date || !total_days || !reason) {
        return res.status(400).json({ error: 'Required fields missing: leave_type_id, from_date, to_date, total_days, reason' });
    }
    try {
        let employeeId = req.body.employee_id;
        if (!employeeId && email) {
            const empCheck = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
            if (empCheck.rows.length === 0)
                return res.status(400).json({ error: 'Active employee record not found' });
            employeeId = empCheck.rows[0].id;
        }
        if (!employeeId)
            return res.status(400).json({ error: 'Employee ID is required' });
        const currentYear = new Date(from_date).getFullYear();
        let balanceCheck = await (0, db_1.query)('SELECT id, remaining, pending_approval FROM hrms.leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND balance_year = $3', [employeeId, leave_type_id, currentYear]);
        if (balanceCheck.rows.length === 0) {
            const ltQuery = await (0, db_1.query)('SELECT allotted_per_year FROM hrms.leave_types WHERE id = $1', [leave_type_id]);
            if (ltQuery.rows.length === 0)
                return res.status(404).json({ error: 'Leave type not found' });
            const allotted = parseFloat(ltQuery.rows[0].allotted_per_year);
            const insertBal = await (0, db_1.query)(`INSERT INTO hrms.leave_balances (employee_id, leave_type_id, balance_year, allotted, used, pending_approval, remaining)
         VALUES ($1, $2, $3, $4, 0, 0, $4) RETURNING *`, [employeeId, leave_type_id, currentYear, allotted]);
            balanceCheck = insertBal;
        }
        const balance = balanceCheck.rows[0];
        const remaining = parseFloat(balance.remaining);
        const requestedDays = parseFloat(total_days);
        const ltCheck = await (0, db_1.query)('SELECT is_paid FROM hrms.leave_types WHERE id = $1', [leave_type_id]);
        const isPaid = ltCheck.rows[0]?.is_paid;
        if (isPaid && remaining < requestedDays) {
            return res.status(400).json({ error: `Insufficient leave balance. Remaining: ${remaining} days, Requested: ${requestedDays} days.` });
        }
        const result = await (0, db_1.query)(`INSERT INTO hrms.leave_requests (employee_id, leave_type_id, from_date, to_date, total_days, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING *`, [employeeId, leave_type_id, from_date, to_date, requestedDays, reason]);
        await (0, db_1.query)(`UPDATE hrms.leave_balances 
       SET pending_approval = pending_approval + $1, remaining = remaining - $1
       WHERE id = $2`, [requestedDays, balance.id]);
        (0, exports.logUserAction)(req, 'APPLY_LEAVE', 'Leaves', `Applied for ${requestedDays} day(s) of leave (${from_date} to ${to_date})`);
        return res.status(201).json({ message: 'Leave request submitted successfully', request: result.rows[0] });
    }
    catch (err) {
        console.error('Error submitting leave request:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/leave-requests/:id/action', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { action } = req.body;
    const email = req.user?.email;
    if (action !== 'APPROVED' && action !== 'REJECTED') {
        return res.status(400).json({ error: 'Invalid action: must be APPROVED or REJECTED' });
    }
    try {
        let approverId = null;
        if (email) {
            const empCheck = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
            if (empCheck.rows.length > 0) {
                approverId = empCheck.rows[0].id;
            }
        }
        const reqCheck = await (0, db_1.query)('SELECT * FROM hrms.leave_requests WHERE id = $1', [id]);
        if (reqCheck.rows.length === 0)
            return res.status(404).json({ error: 'Leave request not found' });
        const leaveReq = reqCheck.rows[0];
        if (leaveReq.status !== 'PENDING') {
            return res.status(400).json({ error: 'Leave request is already processed' });
        }
        const currentYear = new Date(leaveReq.from_date).getFullYear();
        const balCheck = await (0, db_1.query)('SELECT id, remaining, used, pending_approval FROM hrms.leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND balance_year = $3', [leaveReq.employee_id, leaveReq.leave_type_id, currentYear]);
        if (balCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Leave balance not found' });
        }
        const balance = balCheck.rows[0];
        const totalDays = parseFloat(leaveReq.total_days);
        if (action === 'APPROVED') {
            await (0, db_1.query)(`UPDATE hrms.leave_requests 
         SET status = 'APPROVED', approved_by = $1, approved_at = NOW() 
         WHERE id = $2`, [approverId, id]);
            await (0, db_1.query)(`UPDATE hrms.leave_balances 
         SET used = used + $1, pending_approval = pending_approval - $1
         WHERE id = $2`, [totalDays, balance.id]);
            await (0, db_1.query)(`INSERT INTO hrms.leave_transaction_logs (employee_id, leave_type_id, amount, transaction_type, performed_by, remarks)
         VALUES ($1, $2, $3, 'USAGE', $4, $5)`, [leaveReq.employee_id, leaveReq.leave_type_id, -totalDays, approverId, `Leave request approved. Reference ID: ${id}`]);
        }
        else {
            await (0, db_1.query)(`UPDATE hrms.leave_requests 
         SET status = 'REJECTED', approved_by = $1, approved_at = NOW() 
         WHERE id = $2`, [approverId, id]);
            await (0, db_1.query)(`UPDATE hrms.leave_balances 
         SET remaining = remaining + $1, pending_approval = pending_approval - $1
         WHERE id = $2`, [totalDays, balance.id]);
        }
        (0, exports.logUserAction)(req, `${action}_LEAVE`, 'Leaves', `${action === 'APPROVED' ? 'Approved' : 'Rejected'} leave request (${leaveReq.total_days} days) for employee ID ${leaveReq.employee_id}`);
        return res.json({ message: `Leave request ${action.toLowerCase()} successfully` });
    }
    catch (err) {
        console.error('Error processing leave request action:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 📅 LEAVE BALANCES EXTENDED CRUD APIs
 */
app.get('/api/v1/leave-balances/all', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    if (!companyId && !isSuperAdmin)
        return res.status(400).json({ error: 'Company ID is required' });
    try {
        let sql = `
      SELECT lb.*, lt.name as leave_type_name, lt.code as leave_type_code,
             e.first_name || ' ' || e.last_name as employee_name, e.emp_id_code,
             c.name as company_name
      FROM hrms.leave_balances lb 
      JOIN hrms.leave_types lt ON lb.leave_type_id = lt.id 
      JOIN hrms.employees e ON lb.employee_id = e.id
      LEFT JOIN hrms.companies c ON lt.company_id = c.id
    `;
        const params = [];
        if (companyId && companyId !== 'all') {
            params.push(companyId);
            sql += ` WHERE lt.company_id = $${params.length}`;
        }
        sql += ` ORDER BY e.first_name ASC, lt.name ASC`;
        const result = await (0, db_1.query)(sql, params);
        return res.json({ balances: result.rows });
    }
    catch (err) {
        console.error('Error fetching all leave balances:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/leave-balances', auth_1.authenticateToken, async (req, res) => {
    const { employee_id, leave_type_id, balance_year, allotted, used, remaining } = req.body;
    if (!employee_id || !leave_type_id || !balance_year || allotted === undefined) {
        return res.status(400).json({ error: 'Required fields missing: employee_id, leave_type_id, balance_year, allotted' });
    }
    try {
        const doubleCheck = await (0, db_1.query)('SELECT id FROM hrms.leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND balance_year = $3', [employee_id, leave_type_id, parseInt(balance_year)]);
        if (doubleCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Leave balance for this employee and type already exists for this year.' });
        }
        const finalUsed = used !== undefined ? parseFloat(used) : 0.0;
        const finalRemaining = remaining !== undefined ? parseFloat(remaining) : parseFloat(allotted) - finalUsed;
        const result = await (0, db_1.query)(`INSERT INTO hrms.leave_balances (employee_id, leave_type_id, balance_year, allotted, used, pending_approval, remaining)
       VALUES ($1, $2, $3, $4, $5, 0, $6) RETURNING *`, [employee_id, leave_type_id, parseInt(balance_year), parseFloat(allotted), finalUsed, finalRemaining]);
        return res.status(201).json({ message: 'Leave balance created successfully', balance: result.rows[0] });
    }
    catch (err) {
        console.error('Error creating leave balance:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.put('/api/v1/leave-balances/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { allotted, used, remaining } = req.body;
    try {
        const check = await (0, db_1.query)('SELECT * FROM hrms.leave_balances WHERE id = $1', [id]);
        if (check.rows.length === 0)
            return res.status(404).json({ error: 'Leave balance record not found' });
        const currentBal = check.rows[0];
        const finalAllotted = allotted !== undefined ? parseFloat(allotted) : parseFloat(currentBal.allotted);
        const finalUsed = used !== undefined ? parseFloat(used) : parseFloat(currentBal.used);
        const finalRemaining = remaining !== undefined ? parseFloat(remaining) : finalAllotted - finalUsed - parseFloat(currentBal.pending_approval);
        const result = await (0, db_1.query)(`UPDATE hrms.leave_balances 
       SET allotted = $1, used = $2, remaining = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`, [finalAllotted, finalUsed, finalRemaining, id]);
        return res.json({ message: 'Leave balance updated successfully', balance: result.rows[0] });
    }
    catch (err) {
        console.error('Error updating leave balance:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/leave-balances/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const check = await (0, db_1.query)('SELECT id FROM hrms.leave_balances WHERE id = $1', [id]);
        if (check.rows.length === 0)
            return res.status(404).json({ error: 'Leave balance record not found' });
        await (0, db_1.query)('DELETE FROM hrms.leave_balances WHERE id = $1', [id]);
        return res.json({ message: 'Leave balance deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting leave balance:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 📅 LEAVE TRANSACTION LOGS APIs
 */
app.get('/api/v1/leave-transaction-logs', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    if (!companyId && !isSuperAdmin)
        return res.status(400).json({ error: 'Company ID is required' });
    try {
        let sql = `
      SELECT ltl.*, lt.name as leave_type_name, lt.code as leave_type_code,
             e.first_name || ' ' || e.last_name as employee_name, e.emp_id_code,
             pb.first_name || ' ' || pb.last_name as performer_name
      FROM hrms.leave_transaction_logs ltl
      JOIN hrms.leave_types lt ON ltl.leave_type_id = lt.id 
      JOIN hrms.employees e ON ltl.employee_id = e.id
      LEFT JOIN hrms.employees pb ON ltl.performed_by = pb.id
    `;
        const params = [];
        if (companyId && companyId !== 'all') {
            params.push(companyId);
            sql += ` WHERE lt.company_id = $${params.length}`;
        }
        sql += ` ORDER BY ltl.transaction_date DESC`;
        const result = await (0, db_1.query)(sql, params);
        return res.json({ logs: result.rows });
    }
    catch (err) {
        console.error('Error fetching leave transaction logs:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/leave-transaction-logs', auth_1.authenticateToken, async (req, res) => {
    const email = req.user?.email;
    const { employee_id, leave_type_id, amount, transaction_type, remarks } = req.body;
    if (!employee_id || !leave_type_id || amount === undefined || !transaction_type) {
        return res.status(400).json({ error: 'Required fields missing: employee_id, leave_type_id, amount, transaction_type' });
    }
    try {
        let performerId = null;
        if (email) {
            const empCheck = await (0, db_1.query)('SELECT id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
            if (empCheck.rows.length > 0)
                performerId = empCheck.rows[0].id;
        }
        const currentYear = new Date().getFullYear();
        // Check if balance exists
        let balCheck = await (0, db_1.query)('SELECT id, remaining, allotted, used FROM hrms.leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND balance_year = $3', [employee_id, leave_type_id, currentYear]);
        const changeVal = parseFloat(amount);
        if (balCheck.rows.length === 0) {
            // Create a balance if not present
            const ltQuery = await (0, db_1.query)('SELECT allotted_per_year FROM hrms.leave_types WHERE id = $1', [leave_type_id]);
            if (ltQuery.rows.length === 0)
                return res.status(404).json({ error: 'Leave type not found' });
            const baseAllotted = parseFloat(ltQuery.rows[0].allotted_per_year);
            const allotted = transaction_type === 'ACCRUAL' ? baseAllotted + changeVal : baseAllotted;
            const used = transaction_type === 'USAGE' ? -changeVal : 0;
            const remaining = allotted - used;
            await (0, db_1.query)(`INSERT INTO hrms.leave_balances (employee_id, leave_type_id, balance_year, allotted, used, pending_approval, remaining)
         VALUES ($1, $2, $3, $4, $5, 0, $6)`, [employee_id, leave_type_id, currentYear, allotted, used, remaining]);
        }
        else {
            const balId = balCheck.rows[0].id;
            if (transaction_type === 'ACCRUAL') {
                await (0, db_1.query)(`UPDATE hrms.leave_balances SET allotted = allotted + $1, remaining = remaining + $1 WHERE id = $2`, [changeVal, balId]);
            }
            else if (transaction_type === 'USAGE') {
                const absoluteVal = Math.abs(changeVal);
                await (0, db_1.query)(`UPDATE hrms.leave_balances SET used = used + $1, remaining = remaining - $1 WHERE id = $2`, [absoluteVal, balId]);
            }
            else if (transaction_type === 'MANUAL_ADJUSTMENT' || transaction_type === 'CARRY_FORWARD') {
                if (changeVal > 0) {
                    await (0, db_1.query)(`UPDATE hrms.leave_balances SET allotted = allotted + $1, remaining = remaining + $1 WHERE id = $2`, [changeVal, balId]);
                }
                else {
                    await (0, db_1.query)(`UPDATE hrms.leave_balances SET remaining = remaining + $1 WHERE id = $2`, [changeVal, balId]);
                }
            }
        }
        const logResult = await (0, db_1.query)(`INSERT INTO hrms.leave_transaction_logs (employee_id, leave_type_id, amount, transaction_type, performed_by, remarks)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [employee_id, leave_type_id, changeVal, transaction_type, performerId, remarks || 'Manual transaction entry']);
        return res.status(201).json({ message: 'Transaction log and balance updated successfully', log: logResult.rows[0] });
    }
    catch (err) {
        console.error('Error inserting leave transaction log:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
/**
 * 📅 WEEK-OFF POLICIES CRUD APIs
 */
app.get('/api/v1/weekoffs', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    try {
        if (isSuperAdmin && (!companyId || companyId === 'all' || companyId === '')) {
            const result = await (0, db_1.query)(`SELECT w.*, c.name as company_name 
         FROM hrms.weekoff_policies w
         JOIN hrms.companies c ON w.company_id = c.id
         WHERE w.is_active = true 
         ORDER BY c.name ASC`);
            return res.json({
                weekoffs: result.rows,
                isAll: true
            });
        }
        else {
            if (!companyId || companyId === 'all')
                return res.status(400).json({ error: 'Company ID is required' });
            const result = await (0, db_1.query)('SELECT * FROM hrms.weekoff_policies WHERE company_id = $1 AND is_active = true LIMIT 1', [companyId]);
            const companyResult = await (0, db_1.query)('SELECT name FROM hrms.companies WHERE id = $1 LIMIT 1', [companyId]);
            const companyName = companyResult.rows[0]?.name || null;
            return res.json({
                weekoff: result.rows[0] || null,
                companyName: companyName,
                isAll: false
            });
        }
    }
    catch (err) {
        console.error('Error fetching weekoffs:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/weekoffs', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { name, off_days, alternate_rules } = req.body;
    if (!companyId || companyId === 'all' || !name || !Array.isArray(off_days)) {
        return res.status(400).json({ error: 'Required fields missing: companyId, name, off_days (array)' });
    }
    try {
        const check = await (0, db_1.query)('SELECT id FROM hrms.weekoff_policies WHERE company_id = $1 AND is_active = true LIMIT 1', [companyId]);
        let result;
        if (check.rows.length > 0) {
            result = await (0, db_1.query)(`UPDATE hrms.weekoff_policies 
         SET name = $1, off_days = $2, alternate_rules = $3, updated_at = NOW() 
         WHERE id = $4 RETURNING *`, [name, JSON.stringify(off_days), alternate_rules ? JSON.stringify(alternate_rules) : '{}', check.rows[0].id]);
        }
        else {
            result = await (0, db_1.query)(`INSERT INTO hrms.weekoff_policies (company_id, name, off_days, alternate_rules)
         VALUES ($1, $2, $3, $4) RETURNING *`, [companyId, name, JSON.stringify(off_days), alternate_rules ? JSON.stringify(alternate_rules) : '{}']);
        }
        return res.json({ message: 'Week-off policy saved successfully', weekoff: result.rows[0] });
    }
    catch (err) {
        console.error('Error saving weekoff policy:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/weekoffs', auth_1.authenticateToken, async (req, res) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? (req.query.companyId || req.body.companyId) : req.user?.companyId;
    if (!companyId || companyId === 'all')
        return res.status(400).json({ error: 'Company ID is required' });
    try {
        await (0, db_1.query)('DELETE FROM hrms.weekoff_policies WHERE company_id = $1', [companyId]);
        return res.json({ message: 'Week-off policy deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting weekoff policy:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
// =========================================================================
// 💸 PAYROLL ENGINE API ROUTES (SLABS, COMPONENTS, CONFIGURATIONS)
// =========================================================================
// Helper to check and resolve company ID from auth token or query parameter
// Returns null for SuperAdmin 'all' / empty scope (cross-company view)
const resolveCompanyId = (req) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const raw = isSuperAdmin ? (req.query.companyId || req.body.companyId) : req.user?.companyId;
    const id = raw ? String(raw).trim() : '';
    // Treat 'all', empty string, or absence as null (SuperAdmin global scope)
    if (!id || id === 'all')
        return null;
    return id;
};
// 1. Unified Sandbox & cache fetch
app.get('/api/v1/payroll/sandbox-data', auth_1.authenticateToken, async (req, res) => {
    const companyId = resolveCompanyId(req);
    try {
        let slabs, components, configurations;
        if (!companyId) {
            // SuperAdmin global view — no UUID filter, return all records
            slabs = await (0, db_1.query)(`SELECT * FROM hrms.salary_slabs ORDER BY min_gross ASC`);
            components = await (0, db_1.query)(`SELECT * FROM hrms.salary_components ORDER BY display_order ASC`);
            configurations = await (0, db_1.query)(`SELECT c.*, s.slab_name, t.type_name as calculation_type_name
         FROM hrms.salary_component_configurations c
         LEFT JOIN hrms.salary_slabs s ON c.slab_id = s.id
         LEFT JOIN hrms.calculation_types t ON c.calculation_type_id = t.id
         ORDER BY s.min_gross ASC, c.display_order ASC`);
        }
        else {
            // Tenant-scoped view — filter by company_id or global (NULL) records
            slabs = await (0, db_1.query)(`SELECT * FROM hrms.salary_slabs 
         WHERE company_id = $1 OR company_id IS NULL 
         ORDER BY min_gross ASC`, [companyId]);
            components = await (0, db_1.query)(`SELECT * FROM hrms.salary_components 
         WHERE company_id = $1 OR company_id IS NULL 
         ORDER BY display_order ASC`, [companyId]);
            configurations = await (0, db_1.query)(`SELECT c.*, s.slab_name, t.type_name as calculation_type_name
         FROM hrms.salary_component_configurations c
         LEFT JOIN hrms.salary_slabs s ON c.slab_id = s.id
         LEFT JOIN hrms.calculation_types t ON c.calculation_type_id = t.id
         WHERE c.company_id = $1 OR c.company_id IS NULL
         ORDER BY s.min_gross ASC, c.display_order ASC`, [companyId]);
        }
        const calcTypes = await (0, db_1.query)('SELECT * FROM hrms.calculation_types ORDER BY type_name ASC');
        return res.json({
            slabs: slabs.rows,
            components: components.rows,
            calculationTypes: calcTypes.rows,
            configurations: configurations.rows
        });
    }
    catch (err) {
        console.error('Error fetching payroll sandbox data:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
// 2. SLABS CRUD
app.post('/api/v1/payroll/slabs', auth_1.authenticateToken, async (req, res) => {
    const companyId = resolveCompanyId(req);
    const { slab_name, min_gross, max_gross, description, is_active } = req.body;
    if (!slab_name || min_gross === undefined || max_gross === undefined) {
        return res.status(400).json({ error: 'Required fields missing: slab_name, min_gross, max_gross' });
    }
    const min = parseFloat(min_gross);
    const max = parseFloat(max_gross);
    if (min > max) {
        return res.status(400).json({ error: 'Min Gross cannot exceed Max Gross' });
    }
    try {
        // Overlap check
        const overlapCheck = await (0, db_1.query)(`SELECT COUNT(*) FROM hrms.salary_slabs
       WHERE is_active = true
         AND (company_id = $1 OR company_id IS NULL)
         AND $2 <= max_gross
         AND $3 >= min_gross`, [companyId, min, max]);
        if (parseInt(overlapCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'Salary range overlaps with an existing active slab.' });
        }
        const result = await (0, db_1.query)(`INSERT INTO hrms.salary_slabs (company_id, slab_name, min_gross, max_gross, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [companyId, slab_name, min, max, description || '', is_active !== false]);
        return res.json({ message: 'Slab created successfully', slab: result.rows[0] });
    }
    catch (err) {
        console.error('Error creating slab:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.put('/api/v1/payroll/slabs/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const companyId = resolveCompanyId(req);
    const { slab_name, min_gross, max_gross, description, is_active } = req.body;
    if (!slab_name || min_gross === undefined || max_gross === undefined) {
        return res.status(400).json({ error: 'Required fields missing: slab_name, min_gross, max_gross' });
    }
    const min = parseFloat(min_gross);
    const max = parseFloat(max_gross);
    if (min > max) {
        return res.status(400).json({ error: 'Min Gross cannot exceed Max Gross' });
    }
    try {
        // Overlap check excluding self
        const overlapCheck = await (0, db_1.query)(`SELECT COUNT(*) FROM hrms.salary_slabs
       WHERE is_active = true
         AND (company_id = $1 OR company_id IS NULL)
         AND id <> $2
         AND $3 <= max_gross
         AND $4 >= min_gross`, [companyId, id, min, max]);
        if (parseInt(overlapCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'Salary range overlaps with an existing active slab.' });
        }
        const result = await (0, db_1.query)(`UPDATE hrms.salary_slabs 
       SET slab_name = $1, min_gross = $2, max_gross = $3, description = $4, is_active = $5, updated_at = NOW()
       WHERE id = $6 AND (company_id = $7 OR company_id IS NULL)
       RETURNING *`, [slab_name, min, max, description || '', is_active !== false, id, companyId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Slab not found or unauthorized' });
        }
        return res.json({ message: 'Slab updated successfully', slab: result.rows[0] });
    }
    catch (err) {
        console.error('Error updating slab:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/payroll/slabs/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const companyId = resolveCompanyId(req);
    try {
        // Check if referenced in configurations
        const refCheck = await (0, db_1.query)('SELECT COUNT(*) FROM hrms.salary_component_configurations WHERE slab_id = $1', [id]);
        if (parseInt(refCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'Cannot delete this slab. It is referenced in active configurations.' });
        }
        const result = await (0, db_1.query)('DELETE FROM hrms.salary_slabs WHERE id = $1 AND (company_id = $2 OR company_id IS NULL) RETURNING *', [id, companyId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Slab not found or unauthorized' });
        }
        return res.json({ message: 'Slab deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting slab:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
// 3. COMPONENTS CRUD
app.post('/api/v1/payroll/components', auth_1.authenticateToken, async (req, res) => {
    const companyId = resolveCompanyId(req);
    const { component_code, component_name, component_type, is_statutory, is_taxable, display_order, is_active } = req.body;
    if (!component_code || !component_name || !component_type) {
        return res.status(400).json({ error: 'Required fields missing: component_code, component_name, component_type' });
    }
    const code = String(component_code).trim().toUpperCase();
    try {
        // Duplicate check
        const dupCheck = await (0, db_1.query)(`SELECT COUNT(*) FROM hrms.salary_components 
       WHERE (company_id = $1 OR company_id IS NULL) AND UPPER(component_code) = $2`, [companyId, code]);
        if (parseInt(dupCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'A component with this code already exists.' });
        }
        const result = await (0, db_1.query)(`INSERT INTO hrms.salary_components (company_id, component_code, component_name, component_type, is_statutory, is_taxable, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [companyId, code, component_name, component_type, is_statutory === true, is_taxable !== false, parseInt(display_order) || 1, is_active !== false]);
        return res.json({ message: 'Component created successfully', component: result.rows[0] });
    }
    catch (err) {
        console.error('Error creating component:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.put('/api/v1/payroll/components/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const companyId = resolveCompanyId(req);
    const { component_code, component_name, component_type, is_statutory, is_taxable, display_order, is_active } = req.body;
    if (!component_code || !component_name || !component_type) {
        return res.status(400).json({ error: 'Required fields missing: component_code, component_name, component_type' });
    }
    const code = String(component_code).trim().toUpperCase();
    try {
        // Duplicate check excluding self
        const dupCheck = await (0, db_1.query)(`SELECT COUNT(*) FROM hrms.salary_components 
       WHERE (company_id = $1 OR company_id IS NULL) AND UPPER(component_code) = $2 AND id <> $3`, [companyId, code, id]);
        if (parseInt(dupCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'A component with this code already exists.' });
        }
        const result = await (0, db_1.query)(`UPDATE hrms.salary_components 
       SET component_code = $1, component_name = $2, component_type = $3, is_statutory = $4, is_taxable = $5, display_order = $6, is_active = $7, updated_at = NOW()
       WHERE id = $8 AND (company_id = $9 OR company_id IS NULL)
       RETURNING *`, [code, component_name, component_type, is_statutory === true, is_taxable !== false, parseInt(display_order) || 1, is_active !== false, id, companyId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Component not found or unauthorized' });
        }
        return res.json({ message: 'Component updated successfully', component: result.rows[0] });
    }
    catch (err) {
        console.error('Error updating component:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/payroll/components/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const companyId = resolveCompanyId(req);
    try {
        // Get component code
        const compRes = await (0, db_1.query)('SELECT component_code FROM hrms.salary_components WHERE id = $1 AND (company_id = $2 OR company_id IS NULL)', [id, companyId]);
        if (compRes.rows.length === 0) {
            return res.status(404).json({ error: 'Component not found or unauthorized' });
        }
        const code = compRes.rows[0].component_code;
        // Check if referenced in configurations
        const refCheck = await (0, db_1.query)('SELECT COUNT(*) FROM hrms.salary_component_configurations WHERE component_code = $1 OR depends_on_component = $1', [code]);
        if (parseInt(refCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'Cannot delete this component. It is referenced in active configurations.' });
        }
        await (0, db_1.query)('DELETE FROM hrms.salary_components WHERE id = $1', [id]);
        return res.json({ message: 'Component deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting component:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
// 4. CONFIGURATIONS CRUD
app.post('/api/v1/payroll/configurations', auth_1.authenticateToken, async (req, res) => {
    const companyId = resolveCompanyId(req);
    const { slab_id, component_code, calculation_type_id, calculation_value, depends_on_component, formula_expression, employee_type, is_prorata, min_cap, max_cap, display_order, is_active } = req.body;
    if (!slab_id || !component_code || !calculation_type_id || calculation_value === undefined) {
        return res.status(400).json({ error: 'Required fields missing: slab_id, component_code, calculation_type_id, calculation_value' });
    }
    const code = String(component_code).toUpperCase();
    const depends = depends_on_component ? String(depends_on_component).toUpperCase() : null;
    if (code === depends) {
        return res.status(400).json({ error: 'A component cannot depend on itself.' });
    }
    try {
        // Duplicate check
        const dupCheck = await (0, db_1.query)(`SELECT COUNT(*) FROM hrms.salary_component_configurations 
       WHERE slab_id = $1 AND UPPER(component_code) = $2 AND (company_id = $3 OR company_id IS NULL)`, [slab_id, code, companyId]);
        if (parseInt(dupCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'This component is already configured for the selected salary slab.' });
        }
        const result = await (0, db_1.query)(`INSERT INTO hrms.salary_component_configurations 
       (company_id, slab_id, component_code, calculation_type_id, calculation_value, depends_on_component, formula_expression, employee_type, is_prorata, min_cap, max_cap, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`, [
            companyId,
            slab_id,
            code,
            calculation_type_id,
            parseFloat(calculation_value),
            depends,
            formula_expression || '',
            employee_type || 'ALL',
            is_prorata !== false,
            min_cap ? parseFloat(min_cap) : 0,
            max_cap ? parseFloat(max_cap) : null,
            parseInt(display_order) || 1,
            is_active !== false
        ]);
        return res.json({ message: 'Configuration created successfully', configuration: result.rows[0] });
    }
    catch (err) {
        console.error('Error creating configuration:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.put('/api/v1/payroll/configurations/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const companyId = resolveCompanyId(req);
    const { slab_id, component_code, calculation_type_id, calculation_value, depends_on_component, formula_expression, employee_type, is_prorata, min_cap, max_cap, display_order, is_active } = req.body;
    if (!slab_id || !component_code || !calculation_type_id || calculation_value === undefined) {
        return res.status(400).json({ error: 'Required fields missing: slab_id, component_code, calculation_type_id, calculation_value' });
    }
    const code = String(component_code).toUpperCase();
    const depends = depends_on_component ? String(depends_on_component).toUpperCase() : null;
    if (code === depends) {
        return res.status(400).json({ error: 'A component cannot depend on itself.' });
    }
    try {
        // Duplicate check excluding self
        const dupCheck = await (0, db_1.query)(`SELECT COUNT(*) FROM hrms.salary_component_configurations 
       WHERE slab_id = $1 AND UPPER(component_code) = $2 AND (company_id = $3 OR company_id IS NULL) AND id <> $4`, [slab_id, code, companyId, id]);
        if (parseInt(dupCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'This component is already configured for the selected salary slab.' });
        }
        const result = await (0, db_1.query)(`UPDATE hrms.salary_component_configurations 
       SET slab_id = $1, component_code = $2, calculation_type_id = $3, calculation_value = $4, depends_on_component = $5, 
           formula_expression = $6, employee_type = $7, is_prorata = $8, min_cap = $9, max_cap = $10, display_order = $11, is_active = $12, updated_at = NOW()
       WHERE id = $13 AND (company_id = $14 OR company_id IS NULL)
       RETURNING *`, [
            slab_id,
            code,
            calculation_type_id,
            parseFloat(calculation_value),
            depends,
            formula_expression || '',
            employee_type || 'ALL',
            is_prorata !== false,
            min_cap ? parseFloat(min_cap) : 0,
            max_cap ? parseFloat(max_cap) : null,
            parseInt(display_order) || 1,
            is_active !== false,
            id,
            companyId
        ]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Configuration not found or unauthorized' });
        }
        return res.json({ message: 'Configuration updated successfully', configuration: result.rows[0] });
    }
    catch (err) {
        console.error('Error updating configuration:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/payroll/configurations/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    const companyId = resolveCompanyId(req);
    try {
        const result = await (0, db_1.query)('DELETE FROM hrms.salary_component_configurations WHERE id = $1 AND (company_id = $2 OR company_id IS NULL) RETURNING *', [id, companyId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Configuration not found or unauthorized' });
        }
        return res.json({ message: 'Configuration deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting configuration:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
// =========================================================================
// 💼 SALARY STRUCTURE CRUD API ROUTES
// =========================================================================
app.get('/api/v1/payroll/structures', auth_1.authenticateToken, async (req, res) => {
    const companyId = resolveCompanyId(req);
    try {
        let result;
        if (companyId) {
            result = await (0, db_1.query)(`SELECT * FROM hrms.salary_structures WHERE company_id = $1 OR company_id IS NULL ORDER BY emp_id ASC`, [companyId]);
        }
        else {
            result = await (0, db_1.query)(`SELECT * FROM hrms.salary_structures ORDER BY emp_id ASC`);
        }
        // Auto-seed initial sample structures if empty
        if (result.rows.length === 0) {
            const initialSamples = [
                { emp_id: '1434', full_name: 'KALLE SATISH', salary_per_annum: 360000.00, salary_per_month: 30000, basic: 18500, hra: 5550, ca: 0, ma: 0, sa: 5950, employee_pf: 1800, employee_esi: 0, professional_tax: 200, employer_pf: 1800, employer_esi: 0, retention_bonus: 0, is_retention_bonus_applicable: false },
                { emp_id: '1284', full_name: 'CHUKKA TEJASWI SWARNA SAGARIKA', salary_per_annum: 480000.00, salary_per_month: 40000, basic: 20000, hra: 10000, ca: 1600, ma: 1250, sa: 7150, employee_pf: 1800, employee_esi: 0, professional_tax: 200, employer_pf: 1800, employer_esi: 0, retention_bonus: 0, is_retention_bonus_applicable: false },
                { emp_id: '1268', full_name: 'THAKUR AMRITHA', salary_per_annum: 408000.00, salary_per_month: 34000, basic: 18500, hra: 5550, ca: 0, ma: 0, sa: 9950, employee_pf: 1800, employee_esi: 0, professional_tax: 200, employer_pf: 1800, employer_esi: 0, retention_bonus: 0, is_retention_bonus_applicable: false },
                { emp_id: '1267', full_name: 'VARDHA VAISHNAVI GOUD', salary_per_annum: 384000.00, salary_per_month: 32000, basic: 18500, hra: 5550, ca: 0, ma: 0, sa: 7950, employee_pf: 1800, employee_esi: 0, professional_tax: 200, employer_pf: 1800, employer_esi: 0, retention_bonus: 0, is_retention_bonus_applicable: false },
                { emp_id: '1543', full_name: 'MEKALA SRINU', salary_per_annum: 276384.00, salary_per_month: 23032, basic: 18500, hra: 1850, ca: 0, ma: 0, sa: 2682, employee_pf: 1800, employee_esi: 0, professional_tax: 200, employer_pf: 1800, employer_esi: 0, retention_bonus: 0, is_retention_bonus_applicable: false },
                { emp_id: '1501', full_name: 'MANDALA NAVEEN', salary_per_annum: 240000.00, salary_per_month: 20000, basic: 17000, hra: 850, ca: 0, ma: 0, sa: 2150, employee_pf: 1800, employee_esi: 150, professional_tax: 150, employer_pf: 1800, employer_esi: 650, retention_bonus: 0, is_retention_bonus_applicable: false },
                { emp_id: '1503', full_name: 'HASTHAVARAM VVS NAGENDRA BABU', salary_per_annum: 227700.00, salary_per_month: 18975, basic: 17000, hra: 850, ca: 0, ma: 0, sa: 1125, employee_pf: 1800, employee_esi: 142, professional_tax: 150, employer_pf: 1800, employer_esi: 617, retention_bonus: 0, is_retention_bonus_applicable: false },
                { emp_id: '1500', full_name: 'BHANU PRASAD', salary_per_annum: 248400.00, salary_per_month: 20700, basic: 17000, hra: 850, ca: 0, ma: 0, sa: 2850, employee_pf: 1800, employee_esi: 155, professional_tax: 200, employer_pf: 1800, employer_esi: 673, retention_bonus: 0, is_retention_bonus_applicable: false },
                { emp_id: '1499', full_name: 'LAKKIREDDY SUDHARSHAN REDDY', salary_per_annum: 261804.00, salary_per_month: 21817, basic: 18500, hra: 1850, ca: 0, ma: 0, sa: 1467, employee_pf: 1800, employee_esi: 0, professional_tax: 200, employer_pf: 1800, employer_esi: 0, retention_bonus: 0, is_retention_bonus_applicable: false }
            ];
            for (const item of initialSamples) {
                await (0, db_1.query)(`
          INSERT INTO hrms.salary_structures 
          (company_id, emp_id, full_name, salary_per_annum, salary_per_month, basic, hra, ca, ma, sa, employee_pf, employee_esi, professional_tax, employer_pf, employer_esi, retention_bonus, is_retention_bonus_applicable)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `, [companyId, item.emp_id, item.full_name, item.salary_per_annum, item.salary_per_month, item.basic, item.hra, item.ca, item.ma, item.sa, item.employee_pf, item.employee_esi, item.professional_tax, item.employer_pf, item.employer_esi, item.retention_bonus, item.is_retention_bonus_applicable]);
            }
            result = await (0, db_1.query)(`SELECT * FROM hrms.salary_structures ORDER BY emp_id ASC`);
        }
        return res.json({ structures: result.rows });
    }
    catch (err) {
        console.error('Error fetching salary structures:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.post('/api/v1/payroll/structures', auth_1.authenticateToken, async (req, res) => {
    const companyId = resolveCompanyId(req);
    const structures = Array.isArray(req.body) ? req.body : [req.body];
    try {
        for (const item of structures) {
            const emp_id = item.empId || item.emp_id;
            const emp_uuid = item.employeeId || item.employee_id || item.empUuid || item.emp_uuid || null;
            const full_name = item.fullName || item.full_name;
            const salary_per_annum = parseFloat(item.salaryPerAnnum || item.salary_per_annum || 0);
            const salary_per_month = parseFloat(item.salaryPerMonth || item.salary_per_month || 0);
            const basic = parseFloat(item.basic || 0);
            const hra = parseFloat(item.hra || 0);
            const ca = parseFloat(item.ca || 0);
            const ma = parseFloat(item.ma || 0);
            const sa = parseFloat(item.sa || 0);
            const employee_pf = parseFloat(item.employeePf || item.employee_pf || 0);
            const employee_esi = parseFloat(item.employeeEsi || item.employee_esi || 0);
            const professional_tax = parseFloat(item.professionalTax || item.professional_tax || 0);
            const employer_pf = parseFloat(item.employerPf || item.employer_pf || 0);
            const employer_esi = parseFloat(item.employerEsi || item.employer_esi || 0);
            const retention_bonus = parseFloat(item.retentionVal || item.retention_bonus || 0);
            const is_retention_bonus_applicable = item.retentionCheck !== undefined ? item.retentionCheck : (item.is_retention_bonus_applicable || false);
            const salary_year = parseInt(item.salaryYear || item.salary_year || new Date().getFullYear());
            const existing = await (0, db_1.query)(`SELECT id FROM hrms.salary_structures WHERE (emp_id = $1 OR (employee_id IS NOT NULL AND employee_id = $2)) AND salary_year = $3`, [emp_id, emp_uuid, salary_year]);
            if (existing.rows.length > 0) {
                await (0, db_1.query)(`
          UPDATE hrms.salary_structures 
          SET employee_id = COALESCE($1, employee_id), emp_uuid = COALESCE($1, emp_uuid),
              salary_per_annum = $2, salary_per_month = $3, basic = $4, hra = $5, ca = $6, ma = $7, sa = $8,
              employee_pf = $9, employee_esi = $10, professional_tax = $11, employer_pf = $12, employer_esi = $13,
              retention_bonus = $14, is_retention_bonus_applicable = $15, full_name = $16, updated_at = NOW()
          WHERE id = $17 OR emp_id = $18
        `, [emp_uuid, salary_per_annum, salary_per_month, basic, hra, ca, ma, sa, employee_pf, employee_esi, professional_tax, employer_pf, employer_esi, retention_bonus, is_retention_bonus_applicable, full_name, existing.rows[0].id, emp_id]);
                (0, exports.logUserAction)(req, 'UPDATE_STRUCTURE', 'Payroll Structures', `Updated salary structure for ${full_name || emp_id} (Year ${salary_year})`);
            }
            else {
                await (0, db_1.query)(`
          INSERT INTO hrms.salary_structures 
          (company_id, emp_id, employee_id, emp_uuid, full_name, salary_per_annum, salary_per_month, basic, hra, ca, ma, sa, employee_pf, employee_esi, professional_tax, employer_pf, employer_esi, retention_bonus, is_retention_bonus_applicable, salary_year)
          VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        `, [companyId, emp_id, emp_uuid, full_name, salary_per_annum, salary_per_month, basic, hra, ca, ma, sa, employee_pf, employee_esi, professional_tax, employer_pf, employer_esi, retention_bonus, is_retention_bonus_applicable, salary_year]);
                (0, exports.logUserAction)(req, 'CREATE_STRUCTURE', 'Payroll Structures', `Created salary structure for ${full_name || emp_id} (Year ${salary_year})`);
            }
        }
        return res.json({ message: 'Salary structures updated successfully' });
    }
    catch (err) {
        console.error('Error updating salary structures:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
app.delete('/api/v1/payroll/structures/:id', auth_1.authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await (0, db_1.query)('DELETE FROM hrms.salary_structures WHERE id = $1 OR emp_id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Salary structure not found' });
        }
        const deletedRow = result.rows[0];
        (0, exports.logUserAction)(req, 'DELETE_STRUCTURE', 'Payroll Structures', `Deleted salary structure for ${deletedRow.full_name || deletedRow.emp_id}`);
        return res.json({ message: 'Salary structure deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting salary structure:', err);
        return res.status(500).json({ error: 'Internal server database error' });
    }
});
// Start server
app.listen(PORT, async () => {
    console.log(`HRMS Backend server running on port ${PORT}`);
    try {
        // Database schema migration for hrms.salary_structures
        await (0, db_1.query)(`
      CREATE TABLE IF NOT EXISTS hrms.salary_structures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID,
        emp_id VARCHAR(50) NOT NULL,
        employee_id UUID,
        emp_uuid UUID,
        full_name VARCHAR(150),
        doj DATE,
        salary_per_annum NUMERIC(18, 2) DEFAULT 0,
        salary_per_month NUMERIC(18, 2) DEFAULT 0,
        basic NUMERIC(18, 2) DEFAULT 0,
        hra NUMERIC(18, 2) DEFAULT 0,
        ca NUMERIC(18, 2) DEFAULT 0,
        ma NUMERIC(18, 2) DEFAULT 0,
        sa NUMERIC(18, 2) DEFAULT 0,
        employee_pf NUMERIC(18, 2) DEFAULT 0,
        employee_esi NUMERIC(18, 2) DEFAULT 0,
        professional_tax NUMERIC(18, 2) DEFAULT 0,
        employer_pf NUMERIC(18, 2) DEFAULT 0,
        employer_esi NUMERIC(18, 2) DEFAULT 0,
        variable_pay NUMERIC(18, 2) DEFAULT 0,
        retention_bonus NUMERIC(18, 2) DEFAULT 0,
        net_salary NUMERIC(18, 2) DEFAULT 0,
        monthly_ctc NUMERIC(18, 2) DEFAULT 0,
        pf_check INT DEFAULT 1,
        esi_check INT DEFAULT 1,
        pt_check BOOLEAN DEFAULT TRUE,
        is_structure_active BOOLEAN DEFAULT TRUE,
        is_retention_bonus_applicable BOOLEAN DEFAULT FALSE,
        is_variable_pay_applicable BOOLEAN DEFAULT FALSE,
        retention_bonus_percentage NUMERIC(5, 2) DEFAULT 0,
        variable_pay_percentage NUMERIC(5, 2) DEFAULT 0,
        salary_year INT DEFAULT 2026,
        other_allowance NUMERIC(18, 2) DEFAULT 0,
        meal_food_coupons NUMERIC(18, 2) DEFAULT 0,
        telephone_internet_reimbursement NUMERIC(18, 2) DEFAULT 0,
        effective_from_date DATE DEFAULT CURRENT_DATE,
        effective_to_date DATE DEFAULT NULL,
        tax_regime VARCHAR(20) DEFAULT 'New',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
        await (0, db_1.query)(`ALTER TABLE hrms.salary_structures ADD COLUMN IF NOT EXISTS employee_id UUID;`);
        await (0, db_1.query)(`ALTER TABLE hrms.salary_structures ADD COLUMN IF NOT EXISTS emp_uuid UUID;`);
        // Database schema correction migration for leaves code and additional settings
        await (0, db_1.query)('ALTER TABLE hrms.leave_types ADD COLUMN IF NOT EXISTS code VARCHAR(10);');
        await (0, db_1.query)("UPDATE hrms.leave_types SET code = UPPER(SUBSTRING(name FROM 1 FOR 3)) WHERE code IS NULL;");
        await (0, db_1.query)("ALTER TABLE hrms.leave_types ADD COLUMN IF NOT EXISTS carry_forward_type VARCHAR(20) DEFAULT 'NONE';");
        await (0, db_1.query)("ALTER TABLE hrms.leave_types ADD COLUMN IF NOT EXISTS max_carry_forward NUMERIC DEFAULT 0;");
        await (0, db_1.query)("ALTER TABLE hrms.leave_types ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT TRUE;");
        console.log('[MIGRATION] hrms.salary_structures and hrms.leave_types tables verified successfully.');
    }
    catch (err) {
        console.error('[MIGRATION] Error migrating database schema:', err);
    }
    await syncDynamicPermissions();
});
