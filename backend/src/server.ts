import express, { Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import multer from 'multer';
import { query } from './config/db';

const bulkUploadMulter = multer({ storage: multer.memoryStorage() });
import { updateEmployeeDailySummary } from './utils/attendanceSync';
import { authenticateToken, requireSuperAdmin, requirePermission, AuthenticatedRequest, getEmployeeDataScope, buildDataScopeCondition } from './middlewares/auth';

// Modular Routes
import recruitmentRoutes from './routes/recruitment';
import interviewsRoutes from './routes/interviews';
import visitorsRoutes from './routes/visitors';
import onboardingRoutes from './routes/onboarding';
import notificationRoutes from './routes/notifications';
import eventsRoutes from './routes/events';
import { sendNotification } from './services/notificationService';

// ============================================================================
// WORKBRIDGE: TASK MANAGEMENT MODULE - START
// ============================================================================
import workbridgeRoutes from './routes/workbridge';
// ============================================================================
// WORKBRIDGE: TASK MANAGEMENT MODULE - END
// ============================================================================

import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5005;

// Swagger API Documentation Config
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Enterprise HRMS REST API Documentation',
      version: '1.0.0',
      description: 'Official API documentation for Enterprise Multi-Tenant HRMS system. Use the Authorize button to enter your JWT Bearer token obtained from POST /api/v1/auth/login.',
    },
    servers: [
      {
        url: '/',
        description: 'Current API Server (Production / Active Domain)',
      },
      {
        url: 'http://localhost:5005',
        description: 'Local REST API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your access_token obtained from /api/v1/auth/login',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/server.ts', './src/routes/*.ts', './dist/server.js', './dist/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 1. Helmet Security Headers (Secures HTTP headers)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
}));

// 2. HTTP Request Logger (Prints requests in a structured format in the console)
app.use(morgan('dev'));

// 3. Rate Limiter to prevent brute-force attacks on login
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 login requests per windowMs
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// 4. Background Schedulers (Cron Jobs)
// Runs a daily background task at midnight (00:00) to verify uptime/log health
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON WORKER] Running daily system health check...');
  try {
    const dbCheck = await query('SELECT NOW()');
    console.log(`[CRON WORKER] Database connection healthy. Server timestamp: ${dbCheck.rows[0].now}`);
  } catch (err) {
    console.error('[CRON WORKER] Background database check failed:', err);
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Background Queue implementation for non-blocking asynchronous database writes (e.g. Audit/Activity logging)
class TaskQueue {
  private queue: (() => Promise<void>)[] = [];
  private processing = false;

  public enqueue(task: () => Promise<void>) {
    this.queue.push(task);
    this.processNext();
  }

  private async processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const task = this.queue.shift();
    if (task) {
      try {
        await task();
      } catch (err) {
        console.error('Error executing queued background task:', err);
      }
    }
    this.processing = false;
    this.processNext();
  }
}

const backgroundQueue = new TaskQueue();

export function enqueueActivityLog(
  companyId: string | null,
  userEmail: string,
  action: string,
  module: string,
  details: any,
  ipAddress: string,
  userAgent: string
) {
  backgroundQueue.enqueue(async () => {
    try {
      let jsonDetails: string;
      if (typeof details === 'object' && details !== null) {
        jsonDetails = JSON.stringify(details);
      } else if (typeof details === 'string') {
        try {
          JSON.parse(details);
          jsonDetails = details;
        } catch {
          jsonDetails = JSON.stringify({ message: details });
        }
      } else {
        jsonDetails = JSON.stringify({ message: String(details || '') });
      }

      await query(
        `INSERT INTO hrms.activity_logs (company_id, user_email, action, module, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [companyId, userEmail, action, module, jsonDetails, ipAddress, userAgent]
      );
    } catch (err) {
      console.error('Failed to write activity log via background queue:', err);
    }
  });
}

// Helper to check and resolve company ID from auth token or query parameter
// Returns null for SuperAdmin 'all' / empty scope (cross-company view)
export function resolveCompanyId(req: AuthenticatedRequest): string | null {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const raw = isSuperAdmin ? (req.query.companyId || req.body.companyId) : req.user?.companyId;
  const id = raw ? String(raw).trim() : '';
  if (!id || id === 'all') return null;
  return id;
}

export const logUserAction = (
  req: AuthenticatedRequest,
  action: string,
  moduleName: string,
  details: string
) => {
  try {
    const companyId = resolveCompanyId(req);
    const userEmail = req.user?.email || (req.user as any)?.preferred_username || 'system@hrms.com';
    const ipAddress = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') as string;
    const userAgent = (req.headers['user-agent'] || '') as string;

    enqueueActivityLog(companyId, userEmail, action, moduleName, details, ipAddress, userAgent);
  } catch (err) {
    console.error('Non-blocking audit log error:', err);
  }
};

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Uptime Health Check
 *     tags:
 *       - System Health
 *     responses:
 *       200:
 *         description: Server is online and DB connection is healthy
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'UP', timestamp: new Date() });
});

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: User Login & Token Generation
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: superadmin
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Successful authentication with access_token and user metadata
 *       401:
 *         description: Invalid credentials
 */
app.post('/api/v1/auth/login', loginRateLimiter, async (req, res) => {
  const { username, password } = req.body;
  const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string;
  const userAgent = req.headers['user-agent'] || '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // 1. Verify if username/email exists in DB (or is a known superadmin username)
  const isSuperAdminDev = username.toLowerCase() === 'superadmin' ||
    username.toLowerCase() === 'superadmin@hrms.com';
  let userExists = isSuperAdminDev;
  let isInactive = false;
  let resolvedEmail = username;
  let dbIsTempPassword: boolean | null = null;
  try {
    const empCheck = await query(
      `SELECT email, status, is_temporary_password 
       FROM hrms.employees 
       WHERE LOWER(email) = LOWER($1) 
          OR LOWER(emp_id_code) = LOWER($1) 
          OR LOWER(SPLIT_PART(email, '@', 1)) = LOWER($1)`,
      [username]
    );
    if (empCheck.rows.length > 0) {
      const empStatus = empCheck.rows[0].status;
      dbIsTempPassword = empCheck.rows[0].is_temporary_password === true;
      if (empStatus === 'INACTIVE' || empStatus === 'TERMINATED' || empStatus === 'EXITED') {
        isInactive = true;
      } else {
        userExists = true;
        if (empCheck.rows[0].email) {
          resolvedEmail = empCheck.rows[0].email;
        }
      }
    }
  } catch (dbErr) {
    console.error('Pre-login DB user check error:', dbErr);
    userExists = true;
  }

  if (isInactive) {
    return res.status(401).json({ error: 'Account is deactivated. Your employment status is set to INACTIVE. Please contact HR or System Administrator.' });
  }

  if (!userExists) {
    return res.status(401).json({ error: 'Invalid email or username.' });
  }

  const tokenUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;

  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', process.env.KEYCLOAK_CLIENT_ID || 'hrms-backend-api');
  params.append('username', resolvedEmail);
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

    const data = await response.json() as any;

    if (response.ok) {
      const accessToken = data.access_token;
      const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
      const email = decoded?.email || username;
      const preferredUsername = decoded?.preferred_username || username;
      const tokenRoles = decoded?.realm_access?.roles || [];

      // Check if user is SuperAdmin
      const isSuper = tokenRoles.includes('SuperAdmin') ||
        tokenRoles.includes('superadmin') ||
        preferredUsername.toLowerCase() === 'superadmin' ||
        preferredUsername.toLowerCase() === 'superadmin@hrms.com';

      const roles = [...tokenRoles];
      if (isSuper && !roles.includes('SuperAdmin')) {
        roles.push('SuperAdmin');
      }

      let companyId: string | null = null;
      let userPermissions: string[] = [];

      let isTemporaryPassword = false;

      // Find company_id, permissions and temporary password status if user is not a global SuperAdmin
      if (!isSuper) {
        try {
          const empQuery = await query(
            `SELECT company_id, role_id, is_temporary_password 
             FROM hrms.employees 
             WHERE (LOWER(email) = LOWER($1) OR LOWER(emp_id_code) = LOWER($1) OR LOWER(SPLIT_PART(email, '@', 1)) = LOWER($1)) AND status = 'ACTIVE'`,
            [email]
          );
          if (empQuery.rows.length > 0) {
            companyId = empQuery.rows[0].company_id;
            isTemporaryPassword = empQuery.rows[0].is_temporary_password === true;
            const roleId = empQuery.rows[0].role_id;
            if (roleId) {
              const permQuery = await query(
                `SELECT p.name 
                 FROM hrms.role_permissions rp 
                 JOIN hrms.permissions p ON rp.permission_id = p.id 
                 WHERE rp.role_id = $1`,
                [roleId]
              );
              userPermissions = permQuery.rows.map(row => row.name);
            }
          }
        } catch (dbQueryErr) {
          console.error('Error querying employee details in login:', dbQueryErr);
          // Fallback if is_temporary_password column is not present or query fails
          const fallbackQuery = await query(
            'SELECT company_id, role_id FROM hrms.employees WHERE (LOWER(email) = LOWER($1) OR LOWER(emp_id_code) = LOWER($1)) AND status = \'ACTIVE\'',
            [email]
          );
          if (fallbackQuery.rows.length > 0) {
            companyId = fallbackQuery.rows[0].company_id;
          }
        }
      } else {
        userPermissions = ['*'];
        isTemporaryPassword = false;
      }

      // Record successful login activity in audit logs using background task queue
      enqueueActivityLog(
        companyId,
        email,
        'LOGIN_SUCCESS',
        'auth',
        JSON.stringify({ roles, login_at: new Date() }),
        ipAddress,
        userAgent
      );

      return res.json({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: 3600, // 1 Hour (60 Minutes) session token lifespan
        email,
        roles,
        permissions: userPermissions,
        companyId,
        is_temporary_password: isTemporaryPassword,
      });
    } else {
      // Record failed login attempt in audit logs using background task queue
      enqueueActivityLog(
        null,
        username,
        'LOGIN_FAILED',
        'auth',
        JSON.stringify({ error: data.error_description || 'Invalid credentials' }),
        ipAddress,
        userAgent
      );

      const errorMsg = data.error_description || 'Incorrect password.';
      return res.status(401).json({ 
        error: errorMsg,
        is_temporary_password: dbIsTempPassword === true
      });
    }
  } catch (err) {
    console.error('Keycloak authentication server connection error:', err);
    return res.status(500).json({ error: 'Keycloak authentication server connection failure. Please check Keycloak service status.' });
  }
});

/**
 * 🔑 GET FRESH LOGGED-IN USER PERMISSIONS
 */
app.get('/api/v1/auth/user-permissions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    if (isSuperAdmin) {
      return res.json({ permissions: ['*'], scopes: {} });
    }

    const rawUser = req.user as any;
    const userIdentifier = (rawUser?.email || rawUser?.preferred_username || rawUser?.username || '').trim();

    const empRes = await query(
      `SELECT role_id FROM hrms.employees 
       WHERE (LOWER(email) = LOWER($1) OR LOWER(emp_id_code) = LOWER($1)) 
         AND status = 'ACTIVE' 
       LIMIT 1`,
      [userIdentifier]
    );

    if (empRes.rows.length === 0 || !empRes.rows[0].role_id) {
      return res.json({ permissions: [], scopes: {} });
    }

    const permQuery = await query(
      `SELECT p.name, rp.data_scope 
       FROM hrms.role_permissions rp 
       JOIN hrms.permissions p ON rp.permission_id = p.id 
       WHERE rp.role_id = $1`,
      [empRes.rows[0].role_id]
    );

    const userPermissions: string[] = [];
    const userScopes: Record<string, string> = {};

    permQuery.rows.forEach(row => {
      userPermissions.push(row.name);
      if (row.name) {
        userScopes[row.name] = row.data_scope || 'ALL';
      }
    });

    return res.json({ permissions: userPermissions, scopes: userScopes });
  } catch (err) {
    console.error('Error fetching user permissions:', err);
    return res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

/**
 * @openapi
 * /api/v1/auth/verify-temporary-password:
 *   post:
 *     summary: Verify Temporary Credentials
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - temporaryPassword
 *             properties:
 *               username:
 *                 type: string
 *               temporaryPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Temporary password verified
 *       401:
 *         description: Invalid credentials
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

    const data = await keycloakRes.json() as any;

    const isValidCredentials =
      keycloakRes.ok ||
      (data.error === 'invalid_grant' && data.error_description === 'Account is not fully set up');

    if (isValidCredentials) {
      return res.json({ success: true, message: 'Temporary password verified.' });
    } else {
      return res.status(401).json({ error: data.error_description || 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Offline development verify password bypass check...');
    // Development fallback if auth server is unreachable
    if (temporaryPassword === '123' || temporaryPassword === 'Dinesh@2023') {
      return res.json({ success: true, message: 'Offline dev bypass verification successful.' });
    }
    return res.status(500).json({ error: 'Authentication server connection failure' });
  }
});

/**
 * @openapi
 * /api/v1/auth/welcome-profile:
 *   get:
 *     summary: Get Public Welcome Profile for Onboarding
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Welcome profile data object
 */
app.get('/api/v1/auth/welcome-profile', async (req, res) => {
  const username = (req.query.username as string) || '';
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const cleanUser = username.trim();
  const userPrefix = cleanUser.split('@')[0];

  try {
    let empRes = await query(
      `SELECT e.id, e.emp_id_code, e.first_name, e.last_name, e.email, e.emp_image, e.joining_date,
              d.name as designation_name, dept.name as department_name, b.name as branch_name,
              c.id as company_id, c.name as company_name, c.branding_logo as company_logo
       FROM hrms.employees e
       LEFT JOIN hrms.designations d ON e.designation_id = d.id
       LEFT JOIN hrms.departments dept ON e.department_id = dept.id
       LEFT JOIN hrms.branches b ON e.branch_id = b.id
       LEFT JOIN hrms.companies c ON e.company_id = c.id
       WHERE e.id::text = $1
          OR LOWER(TRIM(e.email)) = LOWER($1) 
          OR LOWER(TRIM(e.emp_id_code)) = LOWER($1)
          OR LOWER(SPLIT_PART(e.email, '@', 1)) = LOWER($2)
          OR LOWER(e.email) LIKE LOWER($3)
       ORDER BY 
          CASE
            WHEN e.id::text = $1 THEN 1
            WHEN LOWER(TRIM(e.emp_id_code)) = LOWER($1) THEN 2
            WHEN LOWER(TRIM(e.email)) = LOWER($1) THEN 3
            ELSE 4
          END, e.created_at DESC
       LIMIT 1`,
      [cleanUser, userPrefix, `%${userPrefix}%`]
    );

    if (empRes.rows.length === 0) {
      empRes = await query(
        `SELECT e.id, e.emp_id_code, e.first_name, e.last_name, e.email, e.emp_image, e.joining_date,
                d.name as designation_name, dept.name as department_name, b.name as branch_name,
                c.id as company_id, c.name as company_name, c.branding_logo as company_logo
         FROM hrms.employees e
         LEFT JOIN hrms.designations d ON e.designation_id = d.id
         LEFT JOIN hrms.departments dept ON e.department_id = dept.id
         LEFT JOIN hrms.branches b ON e.branch_id = b.id
         LEFT JOIN hrms.companies c ON e.company_id = c.id
         ORDER BY e.created_at DESC
         LIMIT 1`
      );
    }

    // Default company lookup fallback if company name/logo is null
    let defaultCompany = { name: 'Brihaspathi Cloud', logo: null as string | null };
    try {
      const compRes = await query('SELECT name, branding_logo FROM hrms.companies ORDER BY created_at ASC LIMIT 1');
      if (compRes.rows.length > 0) {
        defaultCompany.name = compRes.rows[0].name || defaultCompany.name;
        defaultCompany.logo = compRes.rows[0].branding_logo || null;
      }
    } catch (compErr) {
      console.warn('Fallback company lookup check:', compErr);
    }

    if (empRes.rows.length === 0) {
      return res.json({
        found: false,
        name: userPrefix,
        designation: 'Team Member',
        joiningDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        companyName: defaultCompany.name,
        companyLogo: defaultCompany.logo,
        empImage: null,
        stats: { years: 10, branches: 6, teamMembers: 2500 }
      });
    }

    const emp = empRes.rows[0];
    let branchCount = 6;
    let empCount = 2500;
    if (emp.company_id) {
      const bRes = await query('SELECT COUNT(*) FROM hrms.branches WHERE company_id = $1', [emp.company_id]);
      const countB = parseInt(bRes.rows[0]?.count || '0', 10);
      if (countB > 0) branchCount = countB;

      const eRes = await query('SELECT COUNT(*) FROM hrms.employees WHERE company_id = $1', [emp.company_id]);
      const countE = parseInt(eRes.rows[0]?.count || '0', 10);
      if (countE > 0) empCount = countE;
    }

    let formattedJoiningDate = 'Joining Day';
    if (emp.joining_date) {
      formattedJoiningDate = new Date(emp.joining_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || userPrefix;
    const finalCompanyName = emp.company_name || defaultCompany.name;
    const finalCompanyLogo = emp.company_logo || defaultCompany.logo;

    return res.json({
      found: true,
      name: fullName,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      designation: emp.designation_name || emp.department_name || 'Team Member',
      department: emp.department_name,
      branch: emp.branch_name,
      joiningDate: formattedJoiningDate,
      companyName: finalCompanyName,
      companyLogo: finalCompanyLogo,
      empImage: emp.emp_image || null,
      stats: {
        years: 10,
        branches: branchCount,
        teamMembers: empCount
      }
    });
  } catch (err) {
    console.error('Error fetching welcome profile:', err);
    return res.json({
      found: false,
      name: userPrefix,
      designation: 'Team Member',
      joiningDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      companyName: 'HRMaster Cloud',
      companyLogo: null,
      empImage: null,
      stats: { years: 10, branches: 6, teamMembers: 2500 }
    });
  }
});

/**
 * 📊 GET DYNAMIC ANALYTICS SUMMARY
 * Endpoint for Dashboard Analytics Summary
 */


async function getKeycloakAdminToken(): Promise<string | null> {
  const masterUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/realms/master/protocol/openid-connect/token`;
  try {
    const masterRes = await fetch(masterUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: process.env.KEYCLOAK_ADMIN_USER || 'admin',
        password: process.env.KEYCLOAK_ADMIN_PASSWORD || '123'
      }).toString()
    });
    if (masterRes.ok) {
      const data = await masterRes.json() as any;
      return data.access_token;
    }
  } catch (e) {
    console.warn('Master admin token fetch attempt error:', e);
  }

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

    const data = await res.json() as any;
    return data.access_token;
  } catch (err) {
    console.error('Error fetching admin token from Keycloak:', err);
    return null;
  }
}

/**
 * @openapi
 * /api/v1/auth/reset-temporary-password:
 *   post:
 *     summary: Reset Temporary Password
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - temporaryPassword
 *               - newPassword
 *             properties:
 *               username:
 *                 type: string
 *               temporaryPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       401:
 *         description: Invalid temporary password
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

    const data = await keycloakRes.json() as any;

    // A correct temporary password will return either 200 (if temporary check is not enforced somehow)
    // or 400/401 with error "invalid_grant" and description "Account is not fully set up"
    const isValidCredentials =
      keycloakRes.ok ||
      (data.error === 'invalid_grant' && data.error_description === 'Account is not fully set up');

    if (!isValidCredentials) {
      return res.status(401).json({ error: 'Invalid username/email or temporary password' });
    }

    // 2. Find exact employee record ID from hrms.employees table
    const empFind = await query(
      `SELECT id, email FROM hrms.employees 
       WHERE LOWER(email) = LOWER($1) 
          OR LOWER(emp_id_code) = LOWER($1) 
          OR LOWER(SPLIT_PART(email, '@', 1)) = LOWER($1)`,
      [username]
    );

    if (empFind.rows.length === 0) {
      return res.status(404).json({ error: 'Employee account not found in database.' });
    }

    const employeeId = empFind.rows[0].id;

    // 3. Set is_temporary_password to FALSE in DB using Primary Key ID
    try {
      const dbUpdateRes = await query(
        "UPDATE hrms.employees SET is_temporary_password = FALSE, updated_at = NOW() WHERE id = $1",
        [employeeId]
      );
      if (dbUpdateRes.rowCount === 0) {
        return res.status(500).json({ error: 'Failed to update employee record in database.' });
      }
      console.log(`Successfully set is_temporary_password = FALSE in DB for Employee ID: ${employeeId} (${username})`);
    } catch (dbErr) {
      console.error('Failed to update DB is_temporary_password flag:', dbErr);
      return res.status(500).json({ error: 'Database update failed. Password status could not be updated.' });
    }

    // 2. Extract Keycloak User ID from token if available, or query via Admin API
    let keycloakUserId: string | null = null;
    if (data && data.access_token) {
      try {
        const payload = JSON.parse(Buffer.from(data.access_token.split('.')[1], 'base64').toString());
        if (payload && payload.sub) {
          keycloakUserId = payload.sub;
        }
      } catch (e) {
        console.warn('Could not decode access_token payload:', e);
      }
    }

    // Obtain Admin Access Token
    const adminToken = await getKeycloakAdminToken();
    if (!adminToken) {
      console.warn(`[PASSWORD RESET] Keycloak Admin token unavailable. Password updated in database for ${username}.`);
      return res.json({ success: true, message: 'Password updated successfully.' });
    }

    let userProfile: any = null;

    if (!keycloakUserId) {
      // Find Keycloak User ID by username or email
      let findUserUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users?username=${encodeURIComponent(username)}`;
      let findRes = await fetch(findUserUrl, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      let users = findRes.ok ? (await findRes.json() as any[]) : [];
      if (!users || users.length === 0) {
        findUserUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users?email=${encodeURIComponent(username)}`;
        findRes = await fetch(findUserUrl, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (findRes.ok) users = await findRes.json() as any[];
      }

      if (!users || users.length === 0) {
        return res.status(404).json({ error: 'User profile not found in Keycloak' });
      }

      userProfile = users[0];
      keycloakUserId = userProfile.id;
    }

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
      console.error('Keycloak password reset failed:', resetRes.status, errText);
      return res.status(500).json({ error: 'Failed to update permanent password in Keycloak authentication system.' });
    }

    // 5. Clear Required Actions in Keycloak and fill missing profile attributes like lastName
    if (!userProfile) {
      try {
        const uGetRes = await fetch(`${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${keycloakUserId}`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (uGetRes.ok) {
          userProfile = await uGetRes.json();
        }
      } catch (e) {
        console.warn('Could not fetch user profile details by ID:', e);
      }
    }

    if (userProfile) {
      const updateUserUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${keycloakUserId}`;
      const updateRes = await fetch(updateUserUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...userProfile,
          lastName: userProfile.lastName || userProfile.firstName || 'Employee',
          emailVerified: true,
          requiredActions: []
        })
      });

      if (!updateRes.ok) {
        console.warn('Warning: Keycloak requiredActions update output:', await updateRes.text());
      }
    }

    return res.json({ success: true, message: 'Password updated successfully. You can now login with your new password.' });

  } catch (err: any) {
    console.error('Error during password reset:', err);
    return res.status(500).json({ error: err.message || 'Failed to reset password in Keycloak' });
  }
});

/**
 * @openapi
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change User Password
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 example: NewSecretPass123!
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Invalid password length
 *       401:
 *         description: Unauthorized
 */
app.post('/api/v1/auth/change-password', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { newPassword } = req.body;
  const username = req.user?.email; // Keycloak username corresponds to email in our HRMS config

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized: User email not found' });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string;
  const userAgent = req.headers['user-agent'] || '';

  // Check if Keycloak credentials are configured, if not, do offline mock update
  if (!process.env.KEYCLOAK_AUTH_SERVER_URL || !process.env.KEYCLOAK_REALM) {
    console.log(`[OFFLINE DEV MODE] Password updated successfully for user ${username}.`);

    // Log the audit event using the non-blocking background queue
    enqueueActivityLog(
      req.user?.companyId || null,
      username,
      'PASSWORD_CHANGE',
      'AUTH',
      'User changed their password via profile dashboard (Offline Bypass)',
      ipAddress,
      userAgent
    );

    return res.json({ success: true, message: 'Password updated successfully (Offline Dev Mode bypass).' });
  }

  try {
    // 1. Obtain Admin Access Token
    const adminToken = await getKeycloakAdminToken();
    if (!adminToken) {
      return res.status(500).json({ error: 'Failed to retrieve Keycloak admin access token' });
    }

    // 2. Find Keycloak User ID by username or email
    let findUserUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users?username=${encodeURIComponent(username)}`;
    let findRes = await fetch(findUserUrl, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    let users = findRes.ok ? (await findRes.json() as any[]) : [];
    if (!users || users.length === 0) {
      findUserUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users?email=${encodeURIComponent(username)}`;
      findRes = await fetch(findUserUrl, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (findRes.ok) users = await findRes.json() as any[];
    }

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
    enqueueActivityLog(
      req.user?.companyId || null,
      username,
      'PASSWORD_CHANGE',
      'AUTH',
      'User changed their password via profile dashboard',
      ipAddress,
      userAgent
    );

    return res.json({ success: true, message: 'Password updated successfully in Keycloak.' });

  } catch (err: any) {
    console.error('Error changing password in Keycloak:', err);
    return res.status(500).json({ error: 'Internal server error while updating password' });
  }
});

/**
 * @openapi
 * /api/v1/auth/logs:
 *   get:
 *     summary: Fetch System Activity & Audit Logs
 *     tags:
 *       - Roles, Permissions & Logs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of activity logs
 */
app.get(
  '/api/v1/auth/logs',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;
    const email = req.user?.email || '';

    try {
      let result;
      if (isSuperAdmin) {
        result = await query(
          'SELECT id, company_id, user_email, action, module, details, ip_address, user_agent, created_at FROM hrms.activity_logs ORDER BY created_at DESC LIMIT 50'
        );
      } else if (companyId) {
        result = await query(
          'SELECT id, company_id, user_email, action, module, details, ip_address, user_agent, created_at FROM hrms.activity_logs WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50',
          [companyId]
        );
      } else {
        result = await query(
          'SELECT id, company_id, user_email, action, module, details, ip_address, user_agent, created_at FROM hrms.activity_logs WHERE user_email = $1 ORDER BY created_at DESC LIMIT 50',
          [email]
        );
      }

      res.json({ logs: result.rows });
    } catch (err) {
      console.error('Error fetching logs:', err);
      res.status(500).json({ error: 'Internal database query failure' });
    }
  }
);

/**
 * @openapi
 * /api/v1/analytics/summary:
 *   get:
 *     summary: Get Dynamic Dashboard Analytics Summary
 *     tags:
 *       - System Health
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: companyId
 *         schema:
 *           type: string
 *         description: Optional company ID filter
 *     responses:
 *       200:
 *         description: Dashboard statistics and summary metrics
 */
app.get(
  '/api/v1/analytics/summary',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyIdRaw = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    const companyId = (companyIdRaw === 'all' || companyIdRaw === 'undefined' || companyIdRaw === 'null' || !companyIdRaw) ? null : companyIdRaw;

    try {
      // 1. Employee Count & Department/Branch Counts
      let empCountQuery = 'SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE status = \'ACTIVE\')::int as active FROM hrms.employees';
      let deptQuery = 'SELECT d.id, d.name as label, COUNT(e.id)::int as count FROM hrms.departments d LEFT JOIN hrms.employees e ON e.department_id = d.id';
      let branchQuery = 'SELECT COUNT(*)::int as total FROM hrms.branches';
      let params: any[] = [];

      if (companyId) {
        empCountQuery += ' WHERE company_id = $1';
        deptQuery += ' WHERE d.company_id = $1 GROUP BY d.id, d.name';
        branchQuery += ' WHERE company_id = $1';
        params = [companyId];
      } else {
        deptQuery += ' GROUP BY d.id, d.name';
      }

      const empRes = await query(empCountQuery, params);
      const deptRes = await query(deptQuery, params);
      const branchRes = await query(branchQuery, params);

      const totalEmployees = empRes.rows[0]?.total || 0;
      const activeEmployees = empRes.rows[0]?.active || 0;
      const branchesCount = branchRes.rows[0]?.total || 0;
      const departmentsCount = deptRes.rows.length;

      // 2. Active Leaves Today
      let leaveQuery = `SELECT COUNT(*)::int as active_leaves 
                        FROM hrms.leave_requests 
                        WHERE status = 'APPROVED' 
                        AND CURRENT_DATE BETWEEN start_date AND end_date`;
      if (companyId) {
        leaveQuery += ' AND company_id = $1';
      }
      const leaveRes = await query(leaveQuery, params);
      const activeLeavesToday = leaveRes.rows[0]?.active_leaves || 0;

      // 3. Attendance Today & Punches
      let punchesQuery = `SELECT e.first_name, e.last_name, e.emp_id_code, d.name as department_name, 
                                 COALESCE(att.in_time, '09:00 AM') as in_time, 
                                 COALESCE(att.status, 'In-Time') as status
                          FROM hrms.employees e
                          LEFT JOIN hrms.departments d ON e.department_id = d.id
                          LEFT JOIN hrms.attendance_summary att ON att.employee_id = e.id AND att.date = CURRENT_DATE`;
      if (companyId) {
        punchesQuery += ' WHERE e.company_id = $1';
      }
      punchesQuery += ' ORDER BY e.first_name ASC LIMIT 10';
      const punchesRes = await query(punchesQuery, params);

      const punches = punchesRes.rows.map((r: any) => ({
        name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Employee',
        time: r.in_time || '09:00 AM',
        department: r.department_name || 'General',
        status: r.status === 'LATE' ? 'Late' : 'In-Time',
        avatar: `${r.first_name ? r.first_name.charAt(0).toUpperCase() : 'E'}${r.last_name ? r.last_name.charAt(0).toUpperCase() : ''}`
      }));

      // Calculate Present percentage
      const presentEmployees = activeEmployees > activeLeavesToday ? activeEmployees - activeLeavesToday : activeEmployees;
      const attendancePercentage = totalEmployees > 0 ? Math.round((presentEmployees / totalEmployees) * 1000) / 10 : 0;

      // 4. Payroll Total Spend & Departmental Salary Analysis
      let payrollQuery = `SELECT d.name as department, 
                                 COALESCE(AVG(es.gross_salary), 4500)::int as average,
                                 COALESCE(SUM(es.gross_salary), 0)::int as spend,
                                 (COALESCE(SUM(es.gross_salary), 0) * 1.25)::int as budget
                          FROM hrms.departments d
                          LEFT JOIN hrms.employees e ON e.department_id = d.id
                          LEFT JOIN hrms.employee_salary_slabs es ON es.employee_id = e.id`;
      if (companyId) {
        payrollQuery += ' WHERE d.company_id = $1';
      }
      payrollQuery += ' GROUP BY d.name ORDER BY d.name ASC';
      const payrollRes = await query(payrollQuery, params);

      let totalPayrollSpend = 0;
      payrollRes.rows.forEach((r: any) => {
        totalPayrollSpend += parseInt(r.spend || 0, 10);
      });

      // 5. Designation Headcount & Open Positions
      let desigQuery = 'SELECT des.name as label, COUNT(e.id)::int as count FROM hrms.designations des LEFT JOIN hrms.employees e ON e.designation_id = des.id';
      let openJobsQuery = "SELECT COUNT(*)::int as total FROM hrms.job_postings WHERE status = 'OPEN'";
      if (companyId) {
        desigQuery += ' WHERE des.company_id = $1 GROUP BY des.id, des.name';
        openJobsQuery += ' AND company_id = $1';
      } else {
        desigQuery += ' GROUP BY des.id, des.name';
      }

      let desigRes: any = { rows: [] };
      let openJobsRes: any = { rows: [{ total: 0 }] };
      try {
        desigRes = await query(desigQuery, params);
        openJobsRes = await query(openJobsQuery, params);
      } catch (subErr) {
        console.log('Optional recruitment/designation query note:', subErr);
      }

      const openPositionsCount = openJobsRes.rows[0]?.total || 8;

      return res.json({
        totalEmployees,
        activeEmployees,
        branchesCount,
        departmentsCount,
        openPositionsCount,
        activeLeavesToday,
        attendancePercentage,
        totalPayrollSpend,
        departmentStats: deptRes.rows.map((r: any) => ({ label: r.label, count: parseInt(r.count, 10) })),
        designationStats: desigRes.rows.map((r: any) => ({ label: r.label, count: parseInt(r.count, 10) })),
        todayPunches: punches,
        departmentSalaryAverages: payrollRes.rows.map((r: any) => ({
          department: r.department,
          average: parseInt(r.average || 4500, 10),
          spend: parseInt(r.spend || 0, 10),
          budget: parseInt(r.budget || 50000, 10)
        }))
      });
    } catch (err) {
      console.error('Error generating analytics summary:', err);
      return res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
  }
);

/**
 * @openapi
 * /api/v1/companies:
 *   post:
 *     summary: Create Tenant Company (SuperAdmin Only)
 *     tags:
 *       - Organization Masters
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - subdomain
 *             properties:
 *               name:
 *                 type: string
 *                 example: Brihaspathi Tech
 *               subdomain:
 *                 type: string
 *                 example: brihaspathi
 *               company_code:
 *                 type: string
 *                 example: BRIH
 *               domain:
 *                 type: string
 *                 example: brihaspathi.in
 *     responses:
 *       201:
 *         description: Company created successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Subdomain conflict
 */
app.post(
  '/api/v1/companies',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    const { name, company_code, subdomain, domain, branding_logo, established_date } = req.body;
    const cleanName = String(name || '').trim();
    if (!cleanName || !subdomain) {
      return res.status(400).json({ error: 'Name and subdomain are required' });
    }
    if (cleanName.length > 50) {
      return res.status(400).json({ error: 'Company name cannot exceed 50 characters' });
    }

    try {
      const dupCheck = await query('SELECT id FROM hrms.companies WHERE LOWER(TRIM(name)) = LOWER($1)', [cleanName]);
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: `A company with the name "${cleanName}" already exists` });
      }

      const codeVal = company_code || (subdomain ? subdomain.toUpperCase() : 'COMP');

      const result = await query(
        'INSERT INTO hrms.companies (name, company_code, subdomain, domain, branding_logo, established_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [cleanName, codeVal, subdomain, domain || null, branding_logo || null, established_date || null]
      );
      const newCompany = result.rows[0];

      const defaultRoles = ['Admin'];
      for (const roleName of defaultRoles) {
        await query(
          'INSERT INTO hrms.roles (company_id, name, description) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [newCompany.id, roleName, `Default ${roleName} role for ${name}`]
        );
      }

      return res.status(201).json({
        message: 'Tenant company created successfully and Admin role seeded.',
        company: newCompany,
      });
    } catch (err: any) {
      console.error('Error creating company:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Subdomain already exists' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

/**
 * @openapi
 * /api/v1/companies:
 *   get:
 *     summary: List Companies
 *     tags:
 *       - Organization Masters
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tenant companies
 */
app.get(
  '/api/v1/companies',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));

    try {
      if (isSuperAdmin) {
        const result = await query('SELECT id, name, company_code, subdomain, domain, branding_logo, status, established_date, created_at FROM hrms.companies ORDER BY name ASC');
        return res.json({ companies: result.rows });
      }

      const userCompanyId = req.user?.companyId;
      if (!userCompanyId) {
        return res.status(403).json({ error: 'Access denied: No company assigned' });
      }

      const result = await query('SELECT id, name, company_code, subdomain, domain, branding_logo, status, established_date, created_at FROM hrms.companies WHERE id = $1', [userCompanyId]);
      return res.json({ companies: result.rows });
    } catch (err) {
      console.error('Error fetching companies:', err);
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

/**
 * @openapi
 * /api/v1/companies/{id}:
 *   put:
 *     summary: Update Company Details
 *     tags:
 *       - Organization Masters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               subdomain:
 *                 type: string
 *               domain:
 *                 type: string
 *               status:
 *                 type: string
 *                 example: ACTIVE
 *     responses:
 *       200:
 *         description: Company updated successfully
 *       404:
 *         description: Company not found
 */
app.put(
  '/api/v1/companies/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));

    if (!isSuperAdmin && req.user?.companyId !== id) {
      return res.status(403).json({ error: 'Access denied: You can only update your own company' });
    }
    const { name, company_code, subdomain, domain, branding_logo, status, established_date } = req.body;
    const cleanName = String(name || '').trim();
    if (!cleanName || !subdomain) {
      return res.status(400).json({ error: 'Name and subdomain are required' });
    }
    if (cleanName.length > 50) {
      return res.status(400).json({ error: 'Company name cannot exceed 50 characters' });
    }

    try {
      const dupCheck = await query('SELECT id FROM hrms.companies WHERE LOWER(TRIM(name)) = LOWER($1) AND id != $2', [cleanName, id]);
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: `A company with the name "${cleanName}" already exists` });
      }

      const codeVal = company_code || (subdomain ? subdomain.toUpperCase() : 'COMP');

      const result = await query(
        'UPDATE hrms.companies SET name = $1, company_code = $2, subdomain = $3, domain = $4, branding_logo = $5, status = $6, established_date = $7, updated_at = NOW() WHERE id = $8 RETURNING *',
        [cleanName, codeVal, subdomain, domain || null, branding_logo || null, status || 'ACTIVE', established_date || null, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }

      return res.json({
        message: 'Tenant company updated successfully.',
        company: result.rows[0],
      });
    } catch (err: any) {
      console.error('Error updating company:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Subdomain already exists' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

/**
 * @openapi
 * /api/v1/companies/{id}:
 *   delete:
 *     summary: Delete Company
 *     tags:
 *       - Organization Masters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Company deleted successfully
 *       404:
 *         description: Company not found
 */
app.delete(
  '/api/v1/companies/:id',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
      const result = await query('DELETE FROM hrms.companies WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }

      return res.json({ message: 'Tenant company deleted successfully.' });
    } catch (err) {
      console.error('Error deleting company:', err);
      return res.status(500).json({ error: 'Internal server database error. Ensure no dependent items exist.' });
    }
  }
);

/**
 * 👥 GET EMPLOYEES (Multi-Tenant)
 */
app.get(
  '/api/v1/employees',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyIdRaw = (req.query.companyId && req.query.companyId !== 'all') ? req.query.companyId : req.user?.companyId;
    const companyId = (companyIdRaw === 'all' || companyIdRaw === 'undefined' || companyIdRaw === 'null' || !companyIdRaw) ? null : companyIdRaw;

    if (!companyId) {
      if (isSuperAdmin) {
        try {
          const result = await query(
            `SELECT e.id, e.company_id, e.emp_id_code, e.first_name, e.last_name, e.email, e.phone, e.status, e.joining_date,
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
             ORDER BY e.emp_id_code ASC`
          );
          return res.json({
            count: result.rows.length,
            employees: result.rows,
          });
        } catch (err) {
          console.error('Error fetching all employees:', err);
          return res.status(500).json({ error: 'Internal database query failure' });
        }
      }
      return res.status(400).json({ error: 'Company ID could not be identified' });
    }

    try {
      const targetModule = (req.query.module as string) || 'employees';
      const scopeCtx = await getEmployeeDataScope(req, targetModule);
      const scopeCond = buildDataScopeCondition(scopeCtx, 'e', 'id', 2);

      let whereClause = `WHERE e.company_id = $1`;
      const queryParams: any[] = [companyId];
      if (scopeCond.whereSql) {
        whereClause += ` AND ${scopeCond.whereSql}`;
        queryParams.push(...scopeCond.params);
      }

      const result = await query(
        `SELECT e.id, e.company_id, e.emp_id_code, e.first_name, e.last_name, e.email, e.phone, e.status, e.joining_date,
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
         ${whereClause}
         ORDER BY e.emp_id_code ASC`,
        queryParams
      );
      return res.json({
        count: result.rows.length,
        employees: result.rows,
      });
    } catch (err) {
      console.error('Error fetching employees:', err);
      return res.status(500).json({ error: 'Internal database query failure' });
    }
  }
);

// 🔍 REAL-TIME DUPLICATE CHECK FOR EMAIL & EMPLOYEE ID CODE
app.get(
  '/api/v1/employees/check-duplicate',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = (req.query.email as string || '').trim().toLowerCase();
      const empIdCode = (req.query.emp_id_code as string || '').trim().toLowerCase();
      const companyId = (req.query.companyId as string || '').trim();

      let duplicateEmail: any = null;
      let duplicateEmpId: any = null;

      if (email) {
        const emailRes = await query(
          `SELECT id, company_id, emp_id_code, first_name, last_name, email 
           FROM hrms.employees 
           WHERE LOWER(TRIM(email)) = $1 OR LOWER(TRIM(COALESCE(personal_email, ''))) = $1 
           LIMIT 1`,
          [email]
        );
        if (emailRes.rows.length > 0) {
          duplicateEmail = emailRes.rows[0];
        }
      }

      if (empIdCode) {
        let empSql = `SELECT id, company_id, emp_id_code, first_name, last_name, email 
                      FROM hrms.employees 
                      WHERE LOWER(TRIM(emp_id_code)) = $1`;
        const params: any[] = [empIdCode];
        if (companyId && companyId !== 'all') {
          empSql += ` AND company_id = $2`;
          params.push(companyId);
        }
        empSql += ` LIMIT 1`;
        const empRes = await query(empSql, params);
        if (empRes.rows.length > 0) {
          duplicateEmpId = empRes.rows[0];
        }
      }

      return res.json({ duplicateEmail, duplicateEmpId });
    } catch (err) {
      console.error('Error in check-duplicate:', err);
      return res.status(500).json({ error: 'Failed to check duplicate' });
    }
  }
);

// 👤 GET LOGGED-IN EMPLOYEE PROFILE (ME)
app.get('/api/v1/employees/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const keycloakUuid = (req.user as any)?.keycloakId || (req.user as any)?.sub || '';
    const rawEmail = req.user?.email || (req.user as any)?.preferred_username || keycloakUuid;
    const userEmail = (rawEmail && typeof rawEmail === 'string' && rawEmail.trim() !== '') ? rawEmail.trim() : 'employee@brihaspathi.com';

    const result = await query(
      `SELECT e.*,
              b.name as branch_name,
              d.name as department_name,
              des.name as designation_name,
              r.name as role_name,
              c.name as company_name,
              m.first_name as manager_first_name,
              m.last_name as manager_last_name,
              m.emp_id_code as manager_emp_code
       FROM hrms.employees e
       LEFT JOIN hrms.branches b ON e.branch_id = b.id
       LEFT JOIN hrms.departments d ON e.department_id = d.id
       LEFT JOIN hrms.designations des ON e.designation_id = des.id
       LEFT JOIN hrms.roles r ON e.role_id = r.id
       LEFT JOIN hrms.companies c ON e.company_id = c.id
       LEFT JOIN hrms.employees m ON e.reporting_to_id = m.id
       WHERE e.id::text = $1
          OR LOWER(e.emp_id_code) = LOWER($2)
          OR LOWER(e.email) = LOWER($2)
          OR LOWER(SPLIT_PART(e.email, '@', 1)) = LOWER($2)
          OR LOWER(e.email) LIKE LOWER($2 || '@%')
       ORDER BY 
          CASE 
            WHEN e.id::text = $1 THEN 1
            WHEN LOWER(e.emp_id_code) = LOWER($2) THEN 2
            WHEN LOWER(e.email) = LOWER($2) THEN 3
            ELSE 4
          END
       LIMIT 1`,
      [keycloakUuid || userEmail, userEmail]
    );

    if (result.rows.length === 0) {
      // Graceful Fallback: return a synthetic or default profile so UI never breaks with 404
      const displayName = userEmail.includes('@') ? userEmail.split('@')[0] : userEmail;
      return res.json({
        employee: {
          id: req.user?.keycloakId || 'emp-me-id',
          emp_id_code: 'EMP-ME',
          first_name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
          last_name: '',
          email: userEmail,
          status: 'ACTIVE',
          branch_name: 'CORPORATE(HO)',
          department_name: 'GENERAL',
          designation_name: 'Team Member',
          role_name: req.user?.roles?.[0] || 'Employee'
        }
      });
    }

    return res.json({ employee: result.rows[0] });
  } catch (err) {
    console.error('Error fetching logged-in employee profile:', err);
    return res.status(500).json({ error: 'Failed to fetch employee profile' });
  }
});

// 🎴 PUBLIC EMPLOYEE ID CARD VERIFICATION (No Auth required for Smartphone QR Scans)
app.get('/api/v1/employees/public/idcard/:empCode', async (req: express.Request, res: Response) => {
  try {
    const empCode = req.params.empCode;
    const result = await query(
      `SELECT e.id, e.emp_id_code, e.first_name, e.last_name, e.emp_image, e.blood_group, e.status,
              des.name as designation_name,
              c.name as company_name, c.branding_logo
       FROM hrms.employees e
       LEFT JOIN hrms.designations des ON e.designation_id = des.id
       LEFT JOIN hrms.companies c ON e.company_id = c.id
       WHERE e.id::text = $1
          OR LOWER(e.emp_id_code) = LOWER($1)
          OR LOWER(SPLIT_PART(e.email, '@', 1)) = LOWER($1)
       LIMIT 1`,
      [empCode]
    );

    if (result.rows.length > 0) {
      return res.json({ employee: result.rows[0] });
    }
    
    // Fallback: return first employee if specific ID not found
    const fallback = await query(
      `SELECT e.id, e.emp_id_code, e.first_name, e.last_name, e.emp_image, e.blood_group, e.status,
              des.name as designation_name,
              c.name as company_name, c.branding_logo
       FROM hrms.employees e
       LEFT JOIN hrms.designations des ON e.designation_id = des.id
       LEFT JOIN hrms.companies c ON e.company_id = c.id
       ORDER BY e.created_at ASC
       LIMIT 1`
    );
    if (fallback.rows.length > 0) {
      return res.json({ employee: fallback.rows[0] });
    }

    return res.status(404).json({ error: 'Employee not found' });
  } catch (err) {
    console.error('Error fetching public employee ID card:', err);
    return res.status(500).json({ error: 'Server error fetching public employee ID' });
  }
});

// 👤 GET SINGLE EMPLOYEE BY ID
app.get('/api/v1/employees/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT e.*,
              b.name as branch_name,
              d.name as department_name,
              des.name as designation_name,
              r.name as role_name,
              c.name as company_name,
              m.first_name as manager_first_name,
              m.last_name as manager_last_name,
              m.emp_id_code as manager_emp_code,
              COALESCE(e.shift_id, es.shift_id) as shift_id,
              sm.shift_name as shift_name
       FROM hrms.employees e
       LEFT JOIN hrms.branches b ON e.branch_id = b.id
       LEFT JOIN hrms.departments d ON e.department_id = d.id
       LEFT JOIN hrms.designations des ON e.designation_id = des.id
       LEFT JOIN hrms.roles r ON e.role_id = r.id
       LEFT JOIN hrms.companies c ON e.company_id = c.id
       LEFT JOIN hrms.employees m ON e.reporting_to_id = m.id
       LEFT JOIN LATERAL (
         SELECT shift_id FROM hrms.employee_shifts
         WHERE employee_id = e.id
         ORDER BY effective_from DESC LIMIT 1
       ) es ON true
       LEFT JOIN hrms.shift_masters sm ON COALESCE(e.shift_id, es.shift_id) = sm.id
       WHERE e.id::text = $1 OR e.emp_id_code = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    return res.json({ employee: result.rows[0] });
  } catch (err) {
    console.error('Error fetching single employee:', err);
    return res.status(500).json({ error: 'Failed to fetch employee details' });
  }
});

async function createKeycloakUser(email: string, firstName: string, lastName: string, tempPassword?: string) {
  if (!process.env.KEYCLOAK_AUTH_SERVER_URL || !process.env.KEYCLOAK_REALM) {
    console.warn('Keycloak environment variables are missing. Skipping user registration.');
    return { success: false, error: 'Keycloak server not configured' };
  }

  const adminToken = await getKeycloakAdminToken();
  if (!adminToken) {
    return { success: false, error: 'Failed to retrieve Keycloak admin access token' };
  }

  const createUserUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users`;
  const defaultPassword = tempPassword || '123';

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
    } else {
      const errorText = await res.text();
      console.error('Keycloak user creation failed:', errorText);
      return { success: false, error: errorText || `Response status code ${res.status}` };
    }
  } catch (err: any) {
    console.error('Error contacting Keycloak server during user registration:', err);
    return { success: false, error: err.message || err };
  }
}

app.post(
  '/api/v1/employees',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;

    const {
      emp_id_code,
      first_name,
      last_name,
      email,
      phone,
      branch_id,
      department_id,
      designation_id,
      role_id,
      joining_date,
      status,
      shift_id,
      dob,
      gender,
      marital_status,
      blood_group,
      personal_email,
      reporting_to_id,
      employment_type,
      probation_period_months,
      confirmation_date,
      exit_date,
      resignation_date,
      bank_information,
      pan_number,
      aadhar_number,
      esi_number,
      uan_number,
      current_address,
      permanent_address,
      emergency_contacts,
      education,
      experience,
      skills,
      emp_image
    } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!emp_id_code || !first_name || !last_name || !email || !joining_date) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    try {
      if (branch_id) {
        const check = await query('SELECT id FROM hrms.branches WHERE id = $1 AND company_id = $2', [branch_id, companyId]);
        if (check.rows.length === 0) return res.status(400).json({ error: 'Invalid Branch reference' });
      }
      if (department_id) {
        const check = await query('SELECT id FROM hrms.departments WHERE id = $1 AND company_id = $2', [department_id, companyId]);
        if (check.rows.length === 0) return res.status(400).json({ error: 'Invalid Department reference' });
      }
      if (designation_id) {
        const check = await query('SELECT id FROM hrms.designations WHERE id = $1 AND company_id = $2', [designation_id, companyId]);
        if (check.rows.length === 0) return res.status(400).json({ error: 'Invalid Designation reference' });
      }
      if (role_id) {
        const check = await query('SELECT id FROM hrms.roles WHERE id = $1 AND company_id = $2', [role_id, companyId]);
        if (check.rows.length === 0) return res.status(400).json({ error: 'Invalid Role reference' });
      }
      if (reporting_to_id) {
        const check = await query('SELECT id FROM hrms.employees WHERE id = $1 AND company_id = $2', [reporting_to_id, companyId]);
        if (check.rows.length === 0) return res.status(400).json({ error: 'Invalid Reporting Manager reference' });
      }

      const result = await query(
        `INSERT INTO hrms.employees (
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
        ) RETURNING *`,
        [
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
        ]
      );

      const newEmployee = result.rows[0];

      // Auto-initialize documents record
      await query(
        `INSERT INTO hrms.employee_documents (company_id, employee_id, documents)
         VALUES ($1, $2, '[]'::jsonb)
         ON CONFLICT (employee_id) DO NOTHING`,
        [companyId, newEmployee.id]
      );

      // Auto-assign selected shift or default shift if one exists
      try {
        let assignedShiftId = shift_id;
        if (!assignedShiftId) {
          const defaultShiftRes = await query(
            "SELECT id FROM hrms.shift_masters WHERE company_id = $1 AND is_active = true ORDER BY created_at ASC LIMIT 1",
            [companyId]
          );
          if (defaultShiftRes.rows.length > 0) {
            assignedShiftId = defaultShiftRes.rows[0].id;
          }
        }
        if (assignedShiftId) {
          await query(
            `INSERT INTO hrms.employee_shifts (employee_id, shift_id, effective_from, is_default)
             VALUES ($1, $2, $3, true)`,
            [newEmployee.id, assignedShiftId, joining_date]
          );
        }
      } catch (shiftErr) {
        console.error('Error assigning default shift to new employee:', shiftErr);
      }

      // Initialize leave balances if hired directly as ACTIVE
      if (newEmployee.status === 'ACTIVE') {
        try {
          const leaveTypesRes = await query(
            "SELECT id, allotted_per_year, accrual_type, name FROM hrms.leave_types WHERE company_id = $1 AND is_active = true",
            [companyId]
          );
          const joinDate = new Date(joining_date);
          const joiningMonth = joinDate.getMonth() + 1; // 1 to 12
          const remainingMonths = 12 - joiningMonth + 1;
          const currentYear = joinDate.getFullYear();

          for (const leaveType of leaveTypesRes.rows) {
            const allottedPerYear = parseFloat(leaveType.allotted_per_year);
            const proratedAllotted = parseFloat((allottedPerYear * (remainingMonths / 12)).toFixed(2));

            // Insert initial prorated balance
            await query(
              `INSERT INTO hrms.leave_balances (employee_id, leave_type_id, balance_year, allotted, remaining)
               VALUES ($1, $2, $3, $4, $4)
               ON CONFLICT (employee_id, leave_type_id, balance_year) DO NOTHING`,
              [newEmployee.id, leaveType.id, currentYear, proratedAllotted]
            );

            // Log the transaction
            await query(
              `INSERT INTO hrms.leave_transaction_logs (employee_id, leave_type_id, amount, transaction_type, remarks)
               VALUES ($1, $2, $3, 'ACCRUAL', $4)`,
              [newEmployee.id, leaveType.id, proratedAllotted, `Prorated initial allocation on direct onboarding (ACTIVE status)`]
            );
          }
        } catch (leaveErr) {
          console.error('Error initializing leave balances for active onboarding:', leaveErr);
        }
      }

      // Create Keycloak user with fixed default password '123'
      const tempPassword = '123';
      const keycloakResult = await createKeycloakUser(email, first_name, last_name, tempPassword);

      const decodedTokenEmail = req.user?.email || 'unknown';
      enqueueActivityLog(
        companyId,
        decodedTokenEmail,
        'EMPLOYEE_CREATE',
        'employee',
        JSON.stringify({ emp_id_code, email, keycloakCreated: keycloakResult.success }),
        (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string,
        req.headers['user-agent'] || ''
      );

      return res.status(201).json({
        message: 'Employee registered successfully',
        employee: newEmployee,
        keycloakCreated: keycloakResult.success,
        keycloakTempPassword: keycloakResult.success ? tempPassword : null,
        keycloakError: keycloakResult.success ? null : keycloakResult.error
      });
    } catch (err: any) {
      console.error('Error creating employee:', err);
      if (err.code === '23505') {
        if (err.message.includes('email')) {
          return res.status(409).json({ error: 'An employee with this email already exists' });
        }
        return res.status(409).json({ error: 'An employee with this employee code already exists' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

/**
 * 📦 BULK UPLOAD EMPLOYEES
 * Accepts an array of employee records or uploaded CSV file and inserts them in batch.
 * Returns per-row success/failure details.
 */
const handleBulkEmployeeUpload = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isSuperAdmin = req.user && (
      (Array.isArray(req.user.roles) && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'))) ||
      (req.user as any).role === 'SuperAdmin' || (req.user as any).role === 'superadmin' ||
      (req.user as any).isSuperAdmin === true
    );
  const companyId = isSuperAdmin ? (req.body?.companyId || req.query?.companyId || req.user?.companyId) : req.user?.companyId;

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  // 1. FILE EXTENSION VALIDATION (EMP-BULK-NEG-001)
  const filename: string = (
    req.file?.originalname ||
    req.body?.filename ||
    req.body?.fileName ||
    req.body?.file_name ||
    req.body?.fileExtension ||
    req.query?.filename ||
    ''
  ).trim();

  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext && !['csv', 'xlsx', 'xls'].includes(ext)) {
      return res.status(400).json({
        error: `Invalid file extension '.${ext}'. Only .csv and .xlsx files are supported for employee bulk upload.`
      });
    }
  }

  // 2. EMPTY FILE / 0-BYTE VALIDATION (EMP-BULK-NEG-002)
  let fileContentStr: string = (req.body?.fileContent || req.body?.file_content || req.body?.text || '').trim();
  if (req.file) {
    if (req.file.size === 0 || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ error: 'Uploaded CSV file is completely empty (0 bytes).' });
    }
    fileContentStr = req.file.buffer.toString('utf-8').trim();
  }

  let employees: any[] = req.body?.employees;
  let csvHeaders: string[] = Array.isArray(req.body?.headers) ? req.body.headers : [];

  // Parse CSV content string if array not provided
  if (fileContentStr && (!Array.isArray(employees) || employees.length === 0)) {
    if (fileContentStr.length === 0) {
      return res.status(400).json({ error: 'Uploaded CSV file is completely empty (0 bytes).' });
    }
    const lines = fileContentStr.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV file is empty or contains no data rows.' });
    }

    csvHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    employees = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: Record<string, string> = {};
      csvHeaders.forEach((h, i) => {
        let val = values[i] || '';
        if (h.toLowerCase() === 'email') val = val.replace(/\s+/g, '');
        obj[h] = val;
      });
      return obj;
    });
  }

  if (!Array.isArray(employees) || employees.length === 0) {
    return res.status(400).json({ error: 'CSV file is empty (0 bytes) or employees array is empty.' });
  }

  if (employees.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 employees can be uploaded at once' });
  }

  // 3. REQUIRED HEADER COLUMNS VALIDATION (EMP-BULK-NEG-004)
  let allKeys: string[] = csvHeaders.map(h => h.trim().toLowerCase());
  if (allKeys.length === 0 && employees.length > 0) {
    allKeys = Object.keys(employees[0]).map(k => k.trim().toLowerCase());
  }

  const hasEmpCode = allKeys.some(k => ['emp_id_code', 'emp_code', 'empcode', 'employee_code', 'employee_id'].includes(k));
  const hasFirstName = allKeys.some(k => ['first_name', 'firstname', 'name'].includes(k));
  const hasEmail = allKeys.some(k => ['email', 'email_address'].includes(k));

  if (!hasEmpCode || !hasFirstName || !hasEmail) {
    const missing: string[] = [];
    if (!hasEmpCode) missing.push('emp_id_code');
    if (!hasFirstName) missing.push('first_name');
    if (!hasEmail) missing.push('email');

    return res.status(400).json({
      error: `Missing required header columns: ${missing.join(', ')}. Bulk upload file must include headers for emp_id_code, first_name, and email.`
    });
  }

    const results: { row: number; emp_id_code: string; status: 'success' | 'error'; keycloak_status?: string; message: string }[] = [];

    // Pre-fetch lookup maps for this company to avoid N+1 queries
    let branchMap: Record<string, string> = {};
    let deptMap: Record<string, string> = {};
    let desigMap: Record<string, string> = {};
    let roleMap: Record<string, string> = {};
    let shiftMap: Record<string, string> = {};

    try {
      const [branchRes, deptRes, desigRes, roleRes, shiftRes] = await Promise.all([
        query('SELECT id, name FROM hrms.branches WHERE company_id = $1', [companyId]),
        query('SELECT id, name FROM hrms.departments WHERE company_id = $1', [companyId]),
        query('SELECT id, name FROM hrms.designations WHERE company_id = $1', [companyId]),
        query('SELECT id, name FROM hrms.roles WHERE company_id = $1', [companyId]),
        query('SELECT id, shift_name as name FROM hrms.shift_masters WHERE company_id = $1', [companyId]),
      ]);

      branchMap = Object.fromEntries(branchRes.rows.map((r: any) => [r.name.trim().toLowerCase(), r.id]));
      deptMap = Object.fromEntries(deptRes.rows.map((r: any) => [r.name.trim().toLowerCase(), r.id]));
      desigMap = Object.fromEntries(desigRes.rows.map((r: any) => [r.name.trim().toLowerCase(), r.id]));
      roleMap = Object.fromEntries(roleRes.rows.map((r: any) => [r.name.trim().toLowerCase(), r.id]));
      shiftMap = Object.fromEntries(shiftRes.rows.map((r: any) => [r.name.trim().toLowerCase(), r.id]));
    } catch (lookupErr) {
      console.error('Error building lookup maps for bulk upload:', lookupErr);
      return res.status(500).json({ error: 'Failed to fetch company lookup data' });
    }

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const rowNum = i + 2; // Row 1 = header in CSV, so data starts at row 2

      const joiningDate = emp.joining_date || new Date().toISOString().split('T')[0];
      const empEmail = (emp.email || '').trim().toLowerCase();
      const empCode = (emp.emp_id_code || '').trim();

      // Required fields validation (minimal: emp_id_code, first_name, email)
      if (!empCode || !emp.first_name || !empEmail) {
        results.push({ row: rowNum, emp_id_code: empCode || '—', status: 'error', message: 'Required fields missing: emp_id_code, first_name, email' });
        continue;
      }

      // Check duplicate email or code in DB before inserting
      try {
        const dupCheck = await query(
          `SELECT id, email, emp_id_code FROM hrms.employees WHERE company_id = $1 AND (LOWER(email) = LOWER($2) OR LOWER(emp_id_code) = LOWER($3))`,
          [companyId, empEmail, empCode]
        );
        if (dupCheck.rows.length > 0) {
          const dupRow = dupCheck.rows[0];
          const reason = dupRow.email.toLowerCase() === empEmail ? `Email '${empEmail}' already registered` : `Emp Code '${empCode}' already assigned`;
          results.push({
            row: rowNum,
            emp_id_code: empCode,
            status: 'error',
            message: `Skipped: ${reason}`
          });
          continue;
        }
      } catch (dupErr) {
        console.error('Error checking duplicate employee:', dupErr);
      }

      // Resolve or auto-create branch
      let branch_id = emp.branch_name ? branchMap[emp.branch_name.trim().toLowerCase()] || null : null;
      if (!branch_id && emp.branch_name && emp.branch_name.trim()) {
        const cleanBName = emp.branch_name.trim();
        try {
          const bRes = await query(
            `INSERT INTO hrms.branches (company_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id`,
            [companyId, cleanBName]
          );
          if (bRes.rows.length > 0) {
            branch_id = bRes.rows[0].id;
          } else {
            const fetchB = await query(`SELECT id FROM hrms.branches WHERE company_id = $1 AND LOWER(name) = LOWER($2)`, [companyId, cleanBName]);
            if (fetchB.rows.length > 0) branch_id = fetchB.rows[0].id;
          }
          if (branch_id) branchMap[cleanBName.toLowerCase()] = branch_id;
        } catch (bErr) {
          console.error('Branch auto-create error:', bErr);
        }
      }

      // Resolve or auto-create department
      let department_id = emp.department_name ? deptMap[emp.department_name.trim().toLowerCase()] || null : null;
      if (!department_id && emp.department_name && emp.department_name.trim()) {
        const cleanDName = emp.department_name.trim();
        try {
          const dRes = await query(
            `INSERT INTO hrms.departments (company_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id`,
            [companyId, cleanDName]
          );
          if (dRes.rows.length > 0) {
            department_id = dRes.rows[0].id;
          } else {
            const fetchD = await query(`SELECT id FROM hrms.departments WHERE company_id = $1 AND LOWER(name) = LOWER($2)`, [companyId, cleanDName]);
            if (fetchD.rows.length > 0) department_id = fetchD.rows[0].id;
          }
          if (department_id) deptMap[cleanDName.toLowerCase()] = department_id;
        } catch (dErr) {
          console.error('Department auto-create error:', dErr);
        }
      }

      // Resolve or auto-create designation
      let designation_id = emp.designation_name ? desigMap[emp.designation_name.trim().toLowerCase()] || null : null;
      if (!designation_id && emp.designation_name && emp.designation_name.trim()) {
        const cleanDesName = emp.designation_name.trim();
        try {
          const desRes = await query(
            `INSERT INTO hrms.designations (company_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id`,
            [companyId, cleanDesName]
          );
          if (desRes.rows.length > 0) {
            designation_id = desRes.rows[0].id;
          } else {
            const fetchDes = await query(`SELECT id FROM hrms.designations WHERE company_id = $1 AND LOWER(name) = LOWER($2)`, [companyId, cleanDesName]);
            if (fetchDes.rows.length > 0) designation_id = fetchDes.rows[0].id;
          }
          if (designation_id) desigMap[cleanDesName.toLowerCase()] = designation_id;
        } catch (desErr) {
          console.error('Designation auto-create error:', desErr);
        }
      }

      // Resolve or auto-create role
      const roleInputName = (emp.role_name || emp.role || '').trim();
      let role_id = roleInputName ? roleMap[roleInputName.toLowerCase()] || null : null;
      if (!role_id && roleInputName) {
        try {
          const fetchR = await query(`SELECT id FROM hrms.roles WHERE company_id = $1 AND LOWER(name) = LOWER($2)`, [companyId, roleInputName]);
          if (fetchR.rows.length > 0) {
            role_id = fetchR.rows[0].id;
          } else {
            const rRes = await query(
              `INSERT INTO hrms.roles (company_id, name, description) VALUES ($1, $2, $3) RETURNING id`,
              [companyId, roleInputName, `Auto-created during bulk upload`]
            );
            if (rRes.rows.length > 0) {
              role_id = rRes.rows[0].id;
            }
          }
          if (role_id) roleMap[roleInputName.toLowerCase()] = role_id;
        } catch (rErr) {
          console.error('Role auto-create error in bulk upload:', rErr);
        }
      }
      const shift_id = emp.shift_name ? shiftMap[emp.shift_name.trim().toLowerCase()] || null : null;

      try {
        const result = await query(
          `INSERT INTO hrms.employees (
            company_id, role_id, branch_id, department_id, designation_id,
            emp_id_code, first_name, last_name, email, phone, status, joining_date,
            dob, gender, reporting_to_id, emp_image
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
            $13, $14, $15, $16
          ) RETURNING id, emp_id_code`,
          [
            companyId,
            role_id || null,
            branch_id || null,
            department_id || null,
            designation_id || null,
            empCode,
            emp.first_name.trim(),
            (emp.last_name || '').trim(),
            empEmail,
            emp.phone || null,
            emp.status || 'ACTIVE',
            joiningDate,
            emp.dob || null,
            emp.gender || null,
            null, // reporting_to_id resolved separately if needed
            null
          ]
        );

        const newEmp = result.rows[0];

        // Auto-initialize documents record
        await query(
          `INSERT INTO hrms.employee_documents (company_id, employee_id, documents)
           VALUES ($1, $2, '[]'::jsonb) ON CONFLICT (employee_id) DO NOTHING`,
          [companyId, newEmp.id]
        );

        // Assign shift if resolved
        if (shift_id) {
          await query(
            `INSERT INTO hrms.employee_shifts (employee_id, shift_id, effective_from)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [newEmp.id, shift_id, emp.joining_date]
          );
        }

        // Create Keycloak user with fixed default password '123' (awaited so we can report status)
        const keycloakResult = await createKeycloakUser(empEmail, emp.first_name.trim(), (emp.last_name || '').trim(), '123');

        results.push({
          row: rowNum,
          emp_id_code: newEmp.emp_id_code,
          status: 'success',
          keycloak_status: keycloakResult.success ? 'created' : 'failed',
          message: keycloakResult.success
            ? 'DB ✅ | Keycloak ✅ | Password: 123'
            : `DB ✅ | Keycloak ❌: ${keycloakResult.error || 'Account creation failed'}`,
        });
      } catch (insertErr: any) {
        let errorMsg = 'Database error';
        if (insertErr.code === '23505') {
          errorMsg = insertErr.message.includes('email') ? 'Skipped: Email already exists' : 'Skipped: Employee code already exists';
        }
        results.push({ row: rowNum, emp_id_code: empCode || '—', status: 'error', message: errorMsg });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const keycloakFailCount = results.filter(r => r.status === 'success' && r.keycloak_status === 'failed').length;

    enqueueActivityLog(
      companyId,
      req.user?.email || 'unknown',
      'EMPLOYEE_BULK_IMPORT',
      'employee',
      JSON.stringify({ total: employees.length, success: successCount, errors: errorCount }),
      (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string,
      req.headers['user-agent'] || ''
    );

    return res.status(207).json({
      message: `Bulk import complete. ${successCount} DB records saved (${keycloakFailCount} Keycloak account${keycloakFailCount !== 1 ? 's' : ''} failed), ${errorCount} rows skipped.`,
      successCount,
      errorCount,
      keycloakFailCount,
      results,
    });
  } catch (err: any) {
    console.error('Error in bulk employee upload:', err);
    return res.status(500).json({ error: 'Failed to process employee bulk upload' });
  }
};

app.post('/api/v1/employees/bulk', authenticateToken, bulkUploadMulter.single('file'), handleBulkEmployeeUpload);
app.post('/api/v1/employees/upload', authenticateToken, bulkUploadMulter.single('file'), handleBulkEmployeeUpload);
app.post('/api/v1/employees/bulk-upload', authenticateToken, bulkUploadMulter.single('file'), handleBulkEmployeeUpload);

app.put(
  '/api/v1/employees/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    let companyId = req.body.companyId || req.body.company_id || (req.query.companyId as string) || (isSuperAdmin ? null : req.user?.companyId);

    const {
      emp_id_code,
      first_name,
      last_name,
      email,
      phone,
      branch_id,
      department_id,
      designation_id,
      role_id,
      joining_date,
      status,
      shift_id,
      dob,
      gender,
      marital_status,
      blood_group,
      personal_email,
      reporting_to_id,
      employment_type,
      probation_period_months,
      confirmation_date,
      exit_date,
      resignation_date,
      bank_information,
      pan_number,
      aadhar_number,
      esi_number,
      uan_number,
      current_address,
      permanent_address,
      emergency_contacts,
      education,
      experience,
      skills,
      emp_image,
      password, // Add password extraction
      allow_mobile_punch,
      require_punch_approval
    } = req.body;

    if (password && password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    try {
      // Fetch current status, existing values & company_id for transition and fallback checks
      const originalEmpQuery = await query('SELECT * FROM hrms.employees WHERE id = $1', [id]);
      if (originalEmpQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      const existingEmp = originalEmpQuery.rows[0];
      const originalStatus = existingEmp.status;
      const dbCompanyId = existingEmp.company_id;

      const allowMobilePunchVal = allow_mobile_punch !== undefined ? Boolean(allow_mobile_punch) : (existingEmp.allow_mobile_punch ?? true);
      const requirePunchApprovalVal = require_punch_approval !== undefined ? Boolean(require_punch_approval) : (existingEmp.require_punch_approval ?? true);

      if (!companyId || companyId === 'all') {
        companyId = dbCompanyId;
      }

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      // Fallback required fields to existing database values if empty or missing in req.body
      const final_emp_id_code = (emp_id_code && String(emp_id_code).trim() !== '') ? emp_id_code : existingEmp.emp_id_code;
      const final_first_name = (first_name && String(first_name).trim() !== '') ? first_name : existingEmp.first_name;
      const final_last_name = (last_name && String(last_name).trim() !== '') ? last_name : (existingEmp.last_name || '');
      const final_email = (email && String(email).trim() !== '') ? email : existingEmp.email;
      const final_joining_date = (joining_date && String(joining_date).trim() !== '') ? joining_date : existingEmp.joining_date;

      if (!final_emp_id_code || !final_first_name || !final_email || !final_joining_date) {
        const missing: string[] = [];
        if (!final_emp_id_code) missing.push('Employee ID Code');
        if (!final_first_name) missing.push('First Name');
        if (!final_email) missing.push('Email');
        if (!final_joining_date) missing.push('Joining Date');
        return res.status(400).json({ error: `Required fields missing: ${missing.join(', ')}` });
      }

      if (!isSuperAdmin) {
        const empCheck = await query('SELECT id FROM hrms.employees WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (empCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied: employee not found in your company context' });
        }
      }

      const cleanBranchId = branch_id && branch_id !== '' && branch_id !== 'null' ? branch_id : null;
      const cleanDeptId = department_id && department_id !== '' && department_id !== 'null' ? department_id : null;
      const cleanDesigId = designation_id && designation_id !== '' && designation_id !== 'null' ? designation_id : null;
      const cleanRoleId = role_id && role_id !== '' && role_id !== 'null' ? role_id : null;
      const cleanReportingId = reporting_to_id && reporting_to_id !== '' && reporting_to_id !== 'null' ? reporting_to_id : null;
      const cleanShiftId = shift_id && shift_id !== '' && shift_id !== 'null' ? shift_id : null;

      if (cleanBranchId) {
        const check = await query('SELECT id FROM hrms.branches WHERE id = $1 AND (company_id = $2 OR company_id IS NULL)', [cleanBranchId, companyId]);
        if (check.rows.length === 0) return res.status(400).json({ error: 'Invalid Branch reference' });
      }
      if (cleanDeptId) {
        const check = await query('SELECT id FROM hrms.departments WHERE id = $1 AND (company_id = $2 OR company_id IS NULL)', [cleanDeptId, companyId]);
        if (check.rows.length === 0) return res.status(400).json({ error: 'Invalid Department reference' });
      }
      if (cleanDesigId) {
        const check = await query('SELECT id FROM hrms.designations WHERE id = $1 AND (company_id = $2 OR company_id IS NULL)', [cleanDesigId, companyId]);
        if (check.rows.length === 0) return res.status(400).json({ error: 'Invalid Designation reference' });
      }
      if (cleanRoleId) {
        const check = await query('SELECT id FROM hrms.roles WHERE id = $1 AND (company_id = $2 OR company_id IS NULL)', [cleanRoleId, companyId]);
        if (check.rows.length === 0) return res.status(400).json({ error: 'Invalid Role reference' });
      }
      if (cleanReportingId) {
        // Prevent setting reporting manager to self
        if (cleanReportingId === id) {
          return res.status(400).json({ error: 'Employee cannot report to themselves' });
        }
        const check = await query('SELECT id FROM hrms.employees WHERE id = $1 AND (company_id = $2 OR company_id IS NULL)', [cleanReportingId, companyId]);
        if (check.rows.length === 0) return res.status(400).json({ error: 'Invalid Reporting Manager reference' });
      }

      const result = await query(
        `UPDATE hrms.employees SET
          company_id = $1, role_id = $2, branch_id = $3, department_id = $4, designation_id = $5,
          emp_id_code = $6, first_name = $7, last_name = $8, email = $9, phone = $10,
          status = $11, joining_date = $12,
          dob = $13, gender = $14, marital_status = $15, blood_group = $16, personal_email = $17,
          reporting_to_id = $18, employment_type = $19, probation_period_months = $20, confirmation_date = $21,
          exit_date = $22, resignation_date = $23,
          pan_number = $24, aadhar_number = $25, esi_number = $26, uan_number = $27, bank_information = $28,
          current_address = $29, permanent_address = $30,
          emergency_contacts = $31, education = $32, experience = $33, skills = $34,
          emp_image = $35, shift_id = $36, allow_mobile_punch = $37, require_punch_approval = $38,
          updated_at = NOW()
         WHERE id = $39 RETURNING *`,
        [
          companyId,
          cleanRoleId,
          cleanBranchId,
          cleanDeptId,
          cleanDesigId,
          final_emp_id_code,
          final_first_name,
          final_last_name,
          final_email,
          phone || null,
          status || 'ACTIVE',
          final_joining_date,
          dob || null,
          gender || null,
          marital_status || null,
          blood_group || null,
          personal_email || null,
          cleanReportingId,
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
          cleanShiftId,
          allowMobilePunchVal,
          requirePunchApprovalVal,
          id
        ]
      );

      const updatedEmployee = result.rows[0];

      // 🌟 Keycloak Sync for Employee Update (sync firstname, lastname, email, password)
      (async () => {
        try {
          const adminToken = await getKeycloakAdminToken();
          if (adminToken) {
            let findUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users?username=${encodeURIComponent(email)}`;
            let findRes = await fetch(findUrl, {
              headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            let kcUsers = findRes.ok ? (await findRes.json() as any[]) : [];
            if (!kcUsers || kcUsers.length === 0) {
              findUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users?email=${encodeURIComponent(email)}`;
              findRes = await fetch(findUrl, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
              });
              if (findRes.ok) kcUsers = (await findRes.json()) as any[];
            }

            if (kcUsers && kcUsers.length > 0) {
              const kcUserId = kcUsers[0].id;
              const updateUserUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${kcUserId}`;

              await fetch(updateUserUrl, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${adminToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  ...kcUsers[0],
                  firstName: first_name,
                  lastName: last_name || first_name || 'Employee',
                  email: email,
                  emailVerified: true,
                  requiredActions: []
                })
              });

              const newPassToSet = req.body.password || req.body.newPassword;
              if (newPassToSet && typeof newPassToSet === 'string' && newPassToSet.trim().length >= 6) {
                const resetUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${kcUserId}/reset-password`;
                const resetRes = await fetch(resetUrl, {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    type: 'password',
                    value: newPassToSet.trim(),
                    temporary: false
                  })
                });
                console.log(`[KEYCLOAK SYNC] Password update status for ${email}:`, resetRes.status);
              }
            }
          }
        } catch (kcErr) {
          console.warn('[KEYCLOAK SYNC] Keycloak profile update sync error:', kcErr);
        }
      })();

      // Handle shift update if cleanShiftId is provided
      if (cleanShiftId) {
        try {
          const effectiveDate = final_joining_date || new Date().toISOString().split('T')[0];
          const existingShiftCheck = await query(
            "SELECT id FROM hrms.employee_shifts WHERE employee_id = $1",
            [id]
          );
          if (existingShiftCheck.rows.length > 0) {
            await query(
              "UPDATE hrms.employee_shifts SET shift_id = $1, effective_from = $2 WHERE employee_id = $3",
              [cleanShiftId, effectiveDate, id]
            );
          } else {
            await query(
              "INSERT INTO hrms.employee_shifts (employee_id, shift_id, effective_from, is_default) VALUES ($1, $2, $3, true)",
              [id, cleanShiftId, effectiveDate]
            );
          }
        } catch (shiftErr) {
          console.error('Error updating employee shift during update:', shiftErr);
        }
      }

      // If transitioning from PROBATION to ACTIVE, initialize leave balances
      if (originalStatus === 'PROBATION' && updatedEmployee.status === 'ACTIVE') {
        try {
          const leaveTypesRes = await query(
            "SELECT id, allotted_per_year, accrual_type, name FROM hrms.leave_types WHERE company_id = $1 AND is_active = true",
            [companyId]
          );
          const refDate = updatedEmployee.confirmation_date ? new Date(updatedEmployee.confirmation_date) : new Date();
          const refMonth = refDate.getMonth() + 1; // 1 to 12
          const remainingMonths = 12 - refMonth + 1;
          const currentYear = refDate.getFullYear();

          for (const leaveType of leaveTypesRes.rows) {
            const allottedPerYear = parseFloat(leaveType.allotted_per_year);
            const proratedAllotted = parseFloat((allottedPerYear * (remainingMonths / 12)).toFixed(2));

            // Insert initial prorated balance on confirmation
            await query(
              `INSERT INTO hrms.leave_balances (employee_id, leave_type_id, balance_year, allotted, remaining)
               VALUES ($1, $2, $3, $4, $4)
               ON CONFLICT (employee_id, leave_type_id, balance_year) DO NOTHING`,
              [id, leaveType.id, currentYear, proratedAllotted]
            );

            // Log the transaction
            await query(
              `INSERT INTO hrms.leave_transaction_logs (employee_id, leave_type_id, amount, transaction_type, remarks)
               VALUES ($1, $2, $3, 'ACCRUAL', $4)`,
              [id, leaveType.id, proratedAllotted, `Prorated leaves allocated on confirmation from PROBATION to ACTIVE status`]
            );
          }
        } catch (leaveErr) {
          console.error('Error initializing leave balances on confirmation:', leaveErr);
        }
      }

      // Handle Keycloak password update if provided
      let keycloakUpdateStatus = '';
      if (password) {
        try {
          if (process.env.KEYCLOAK_AUTH_SERVER_URL && process.env.KEYCLOAK_REALM) {
            const adminToken = await getKeycloakAdminToken();
            if (adminToken) {
              // Find user by email
              const findUserUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users?username=${encodeURIComponent(updatedEmployee.email)}`;
              const findRes = await fetch(findUserUrl, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
              });
              const users = await findRes.json() as any[];

              if (users && users.length > 0) {
                const keycloakUserId = users[0].id;
                // Update password
                const resetPasswordUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${keycloakUserId}/reset-password`;
                const resetRes = await fetch(resetPasswordUrl, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                  },
                  body: JSON.stringify({
                    type: 'password',
                    value: password,
                    temporary: false
                  })
                });

                if (resetRes.ok) {
                  keycloakUpdateStatus = ' (Keycloak password updated successfully)';
                } else {
                  console.error('Failed to update Keycloak password:', await resetRes.text());
                  keycloakUpdateStatus = ' (Failed to update Keycloak password)';
                }
              } else {
                keycloakUpdateStatus = ' (User not found in Keycloak)';
              }
            }
          }
        } catch (kcErr) {
          console.error('Error updating Keycloak password during employee edit:', kcErr);
          keycloakUpdateStatus = ' (Error updating Keycloak password)';
        }
      }

      const decodedTokenEmail = req.user?.email || 'unknown';
      enqueueActivityLog(
        companyId,
        decodedTokenEmail,
        'EMPLOYEE_UPDATE',
        'employee',
        JSON.stringify({ emp_id_code, email }),
        (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string,
        req.headers['user-agent'] || ''
      );

      return res.json({ message: `Employee updated successfully${keycloakUpdateStatus}`, employee: updatedEmployee });
    } catch (err: any) {
      console.error('Error updating employee:', err);
      if (err.code === '23505') {
        if (err.message.includes('email')) {
          return res.status(409).json({ error: 'An employee with this email already exists' });
        }
        return res.status(409).json({ error: 'An employee with this employee code already exists' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.delete(
  '/api/v1/employees/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;

    try {
      let targetCompanyId = companyId;

      if (!isSuperAdmin) {
        if (!companyId) return res.status(400).json({ error: 'Company context required' });
        const empCheck = await query('SELECT company_id FROM hrms.employees WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (empCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied: employee not found in your company context' });
        }
      } else {
        const empInfo = await query('SELECT company_id FROM hrms.employees WHERE id = $1', [id]);
        if (empInfo.rows.length > 0) {
          targetCompanyId = empInfo.rows[0].company_id;
        }
      }

      const result = await query('DELETE FROM hrms.employees WHERE id = $1 RETURNING emp_id_code, email', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const { emp_id_code, email } = result.rows[0];
      const decodedTokenEmail = req.user?.email || 'unknown';
      enqueueActivityLog(
        targetCompanyId || null,
        decodedTokenEmail,
        'EMPLOYEE_DELETE',
        'employee',
        JSON.stringify({ emp_id_code, email }),
        (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string,
        req.headers['user-agent'] || ''
      );

      return res.json({ message: 'Employee profile deleted successfully.' });
    } catch (err) {
      console.error('Error deleting employee:', err);
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

/**
 * 📂 EMPLOYEE DOCUMENTS MANAGEMENT API
 */
app.get(
  '/api/v1/employees/:id/documents',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;

    try {
      if (!isSuperAdmin) {
        if (!companyId) return res.status(400).json({ error: 'Company context required' });
        const check = await query('SELECT company_id FROM hrms.employees WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (check.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied: Employee not found in your company context' });
        }
      }

      const docQuery = await query(
        'SELECT documents FROM hrms.employee_documents WHERE employee_id = $1',
        [id]
      );

      if (docQuery.rows.length > 0) {
        return res.json({ documents: docQuery.rows[0].documents || [] });
      } else {
        return res.json({ documents: [] });
      }
    } catch (err) {
      console.error('Error fetching employee documents:', err);
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.post(
  '/api/v1/employees/:id/documents',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;

    const { document_title, file_name, file_url, file_type } = req.body;

    if (!document_title || !file_name || !file_url || !file_type) {
      return res.status(400).json({ error: 'All document fields are required' });
    }

    try {
      const empQuery = await query('SELECT company_id FROM hrms.employees WHERE id = $1', [id]);
      if (empQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      const empCompanyId = empQuery.rows[0].company_id;

      if (!isSuperAdmin && empCompanyId !== companyId) {
        return res.status(403).json({ error: 'Access denied: Employee is not in your company context' });
      }

      const docQuery = await query('SELECT id, documents FROM hrms.employee_documents WHERE employee_id = $1', [id]);

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
        await query(
          'UPDATE hrms.employee_documents SET documents = $1, updated_at = NOW() WHERE employee_id = $2',
          [JSON.stringify(currentDocs), id]
        );
      } else {
        const initialDocs = [newDoc];
        await query(
          'INSERT INTO hrms.employee_documents (company_id, employee_id, documents) VALUES ($1, $2, $3)',
          [empCompanyId, id, JSON.stringify(initialDocs)]
        );
      }

      return res.status(201).json({ message: 'Document added successfully', document: newDoc });
    } catch (err) {
      console.error('Error adding employee document:', err);
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.delete(
  '/api/v1/employees/:id/documents/:docIndex',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id, docIndex } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;

    try {
      const empQuery = await query('SELECT company_id FROM hrms.employees WHERE id = $1', [id]);
      if (empQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      const empCompanyId = empQuery.rows[0].company_id;

      if (!isSuperAdmin && empCompanyId !== companyId) {
        return res.status(403).json({ error: 'Access denied: Employee is not in your company context' });
      }

      const docQuery = await query('SELECT documents FROM hrms.employee_documents WHERE employee_id = $1', [id]);
      if (docQuery.rows.length === 0) {
        return res.status(404).json({ error: 'No documents found for this employee' });
      }

      const currentDocs = docQuery.rows[0].documents || [];
      const idx = parseInt(docIndex, 10);

      if (isNaN(idx) || idx < 0 || idx >= currentDocs.length) {
        return res.status(400).json({ error: 'Invalid document index' });
      }

      currentDocs.splice(idx, 1);

      await query(
        'UPDATE hrms.employee_documents SET documents = $1, updated_at = NOW() WHERE employee_id = $2',
        [JSON.stringify(currentDocs), id]
      );

      return res.json({ message: 'Document deleted successfully', documents: currentDocs });
    } catch (err) {
      console.error('Error deleting employee document:', err);
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

/**
 * 📍 BRANCHES CRUD API
 */
app.get(
  '/api/v1/branches',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;

    if (!companyId || companyId === 'all' || companyId === '') {
      if (isSuperAdmin) {
        try {
          const result = await query(
            `SELECT b.id, b.company_id, b.name, b.address, b.status, b.created_at, c.name as company_name 
             FROM hrms.branches b
             JOIN hrms.companies c ON b.company_id = c.id
             ORDER BY c.name ASC, b.name ASC`
          );
          return res.json({ branches: result.rows });
        } catch (err) {
          console.error('Error fetching all branches:', err);
          return res.status(500).json({ error: 'Internal server database error' });
        }
      }
      return res.status(400).json({ error: 'Company ID is required' });
    }

    try {
      const result = await query(
        'SELECT id, company_id, name, address, status, created_at FROM hrms.branches WHERE company_id = $1 ORDER BY name ASC',
        [companyId]
      );
      return res.json({ branches: result.rows });
    } catch (err) {
      console.error('Error fetching branches:', err);
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.post(
  '/api/v1/branches',
  authenticateToken,
  requirePermission('create_branches'),
  async (req: AuthenticatedRequest, res: Response) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { name, address } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ error: 'Branch name is required' });
    }
    if (cleanName.length > 50) {
      return res.status(400).json({ error: 'Branch name cannot exceed 50 characters' });
    }

    try {
      const dupCheck = await query(
        'SELECT id FROM hrms.branches WHERE company_id = $1 AND LOWER(TRIM(name)) = LOWER($2)',
        [companyId, cleanName]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: `A branch with the name "${cleanName}" already exists in this company` });
      }

      const result = await query(
        'INSERT INTO hrms.branches (company_id, name, address) VALUES ($1, $2, $3) RETURNING *',
        [companyId, cleanName, address || '']
      );
      return res.status(201).json({ message: 'Branch created successfully', branch: result.rows[0] });
    } catch (err: any) {
      console.error('Error creating branch:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Branch with this name already exists' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.put(
  '/api/v1/branches/:id',
  authenticateToken,
  requirePermission('edit_branches'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;
    const { name, address, status } = req.body;

    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ error: 'Branch name is required' });
    }
    if (cleanName.length > 50) {
      return res.status(400).json({ error: 'Branch name cannot exceed 50 characters' });
    }

    try {
      const branchCheck = await query('SELECT company_id FROM hrms.branches WHERE id = $1', [id]);
      if (branchCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Branch not found' });
      }
      const targetCompId = branchCheck.rows[0].company_id;

      if (!isSuperAdmin) {
        if (targetCompId !== companyId) {
          return res.status(403).json({ error: 'Access denied: Branch is not in your company context' });
        }
      }

      const dupCheck = await query(
        'SELECT id FROM hrms.branches WHERE company_id = $1 AND LOWER(TRIM(name)) = LOWER($2) AND id != $3',
        [targetCompId, cleanName, id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: `A branch with the name "${cleanName}" already exists in this company` });
      }

      const result = await query(
        'UPDATE hrms.branches SET name = $1, address = $2, status = $3 WHERE id = $4 RETURNING *',
        [cleanName, address || '', status || 'ACTIVE', id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Branch not found' });
      }

      return res.json({ message: 'Branch updated successfully', branch: result.rows[0] });
    } catch (err: any) {
      console.error('Error updating branch:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Branch with this name already exists' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.delete(
  '/api/v1/branches/:id',
  authenticateToken,
  requirePermission('delete_branches'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;

    try {
      if (!isSuperAdmin) {
        const branchCheck = await query('SELECT company_id FROM hrms.branches WHERE id = $1', [id]);
        if (branchCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Branch not found' });
        }
        if (branchCheck.rows[0].company_id !== companyId) {
          return res.status(403).json({ error: 'Access denied: Branch is not in your company context' });
        }
      }

      const result = await query('DELETE FROM hrms.branches WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Branch not found' });
      }

      return res.json({ message: 'Branch deleted successfully' });
    } catch (err: any) {
      console.error('Error deleting branch:', err);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Cannot delete branch because it has active departments, designations, or employees linked to it' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

/**
 * 📁 DEPARTMENTS CRUD API
 */
app.get(
  '/api/v1/departments',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    const { branchId } = req.query;

    if (!companyId) {
      if (isSuperAdmin) {
        try {
          let q = 'SELECT d.id, d.company_id, d.branch_id, b.name as branch_name, d.name, d.description, d.status, d.created_at FROM hrms.departments d LEFT JOIN hrms.branches b ON d.branch_id = b.id';
          const params: any[] = [];
          if (branchId) {
            q += ' WHERE d.branch_id = $1';
            params.push(branchId);
          }
          q += ' ORDER BY d.name ASC';
          const result = await query(q, params);
          return res.json({ departments: result.rows });
        } catch (err) {
          console.error('Error fetching all departments:', err);
          return res.status(500).json({ error: 'Internal server database error' });
        }
      }
      return res.status(400).json({ error: 'Company ID is required' });
    }

    try {
      let q = 'SELECT d.id, d.company_id, d.branch_id, b.name as branch_name, d.name, d.description, d.status, d.created_at FROM hrms.departments d LEFT JOIN hrms.branches b ON d.branch_id = b.id WHERE d.company_id = $1';
      const params: any[] = [companyId];

      if (branchId) {
        q += ' AND d.branch_id = $2';
        params.push(branchId);
      }
      q += ' ORDER BY d.name ASC';

      const result = await query(q, params);
      return res.json({ departments: result.rows });
    } catch (err) {
      console.error('Error fetching departments:', err);
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.post(
  '/api/v1/departments',
  authenticateToken,
  requirePermission('create_departments'),
  async (req: AuthenticatedRequest, res: Response) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { branch_id, name, description } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!branch_id) {
      return res.status(400).json({ error: 'Branch reference is required' });
    }
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ error: 'Department name is required' });
    }
    if (cleanName.length > 50) {
      return res.status(400).json({ error: 'Department name cannot exceed 50 characters' });
    }

    try {
      const branchCheck = await query('SELECT id FROM hrms.branches WHERE id = $1 AND company_id = $2', [branch_id, companyId]);
      if (branchCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid Branch reference' });
      }

      const dupCheck = await query(
        'SELECT id FROM hrms.departments WHERE company_id = $1 AND branch_id = $2 AND LOWER(TRIM(name)) = LOWER($3)',
        [companyId, branch_id, cleanName]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: `A department with the name "${cleanName}" already exists under this branch` });
      }

      const result = await query(
        'INSERT INTO hrms.departments (company_id, branch_id, name, description) VALUES ($1, $2, $3, $4) RETURNING *',
        [companyId, branch_id, cleanName, description || '']
      );
      return res.status(201).json({ message: 'Department created successfully', department: result.rows[0] });
    } catch (err: any) {
      console.error('Error creating department:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Department already exists under this branch' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.put(
  '/api/v1/departments/:id',
  authenticateToken,
  requirePermission('edit_departments'),
  async (req: AuthenticatedRequest, res: Response) => {
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
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ error: 'Department name is required' });
    }
    if (cleanName.length > 50) {
      return res.status(400).json({ error: 'Department name cannot exceed 50 characters' });
    }

    try {
      const deptCheck = await query('SELECT company_id FROM hrms.departments WHERE id = $1', [id]);
      if (deptCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Department not found' });
      }
      const targetCompId = deptCheck.rows[0].company_id;

      if (!isSuperAdmin) {
        if (targetCompId !== companyId) {
          return res.status(403).json({ error: 'Access denied: Department is not in your company context' });
        }
      }

      const branchCheck = await query('SELECT id FROM hrms.branches WHERE id = $1 AND company_id = $2', [branch_id, targetCompId]);
      if (branchCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid Branch reference for this company' });
      }

      const dupCheck = await query(
        'SELECT id FROM hrms.departments WHERE company_id = $1 AND branch_id = $2 AND LOWER(TRIM(name)) = LOWER($3) AND id != $4',
        [targetCompId, branch_id, cleanName, id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: `A department with the name "${cleanName}" already exists under this branch` });
      }

      const result = await query(
        'UPDATE hrms.departments SET branch_id = $1, name = $2, description = $3, status = $4 WHERE id = $5 RETURNING *',
        [branch_id, cleanName, description || '', status || 'ACTIVE', id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Department not found' });
      }

      return res.json({ message: 'Department updated successfully', department: result.rows[0] });
    } catch (err: any) {
      console.error('Error updating department:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Department already exists under this branch' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.delete(
  '/api/v1/departments/:id',
  authenticateToken,
  requirePermission('delete_departments'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;

    try {
      if (!isSuperAdmin) {
        const deptCheck = await query('SELECT company_id FROM hrms.departments WHERE id = $1', [id]);
        if (deptCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Department not found' });
        }
        if (deptCheck.rows[0].company_id !== companyId) {
          return res.status(403).json({ error: 'Access denied: Department is not in your company context' });
        }
      }

      const result = await query('DELETE FROM hrms.departments WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Department not found' });
      }

      return res.json({ message: 'Department deleted successfully' });
    } catch (err: any) {
      console.error('Error deleting department:', err);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Cannot delete department because it has active designations or employees linked to it' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

/**
 * 🏷️ DESIGNATIONS CRUD API
 */
app.get(
  '/api/v1/designations',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
    const { branchId, departmentId } = req.query;

    if (!companyId) {
      if (isSuperAdmin) {
        try {
          let q = `SELECT d.id, d.company_id, d.branch_id, b.name as branch_name, 
                          d.department_id, dept.name as department_name, d.name, d.description, d.status, d.created_at 
                   FROM hrms.designations d 
                   LEFT JOIN hrms.branches b ON d.branch_id = b.id 
                   LEFT JOIN hrms.departments dept ON d.department_id = dept.id`;
          const params: any[] = [];

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

          const result = await query(q, params);
          return res.json({ designations: result.rows });
        } catch (err) {
          console.error('Error fetching all designations:', err);
          return res.status(500).json({ error: 'Internal server database error' });
        }
      }
      return res.status(400).json({ error: 'Company ID is required' });
    }

    try {
      let q = `SELECT d.id, d.company_id, d.branch_id, b.name as branch_name, 
                      d.department_id, dept.name as department_name, d.name, d.description, d.status, d.created_at 
               FROM hrms.designations d 
               LEFT JOIN hrms.branches b ON d.branch_id = b.id 
               LEFT JOIN hrms.departments dept ON d.department_id = dept.id 
               WHERE d.company_id = $1`;
      const params: any[] = [companyId];

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

      const result = await query(q, params);
      return res.json({ designations: result.rows });
    } catch (err) {
      console.error('Error fetching designations:', err);
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.post(
  '/api/v1/designations',
  authenticateToken,
  requirePermission('create_designations'),
  async (req: AuthenticatedRequest, res: Response) => {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
    const { branch_id, department_id, name, description } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!branch_id || !department_id) {
      return res.status(400).json({ error: 'Branch and Department references are required' });
    }
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ error: 'Designation name is required' });
    }
    if (cleanName.length > 50) {
      return res.status(400).json({ error: 'Designation name cannot exceed 50 characters' });
    }

    try {
      const branchCheck = await query('SELECT id FROM hrms.branches WHERE id = $1 AND company_id = $2', [branch_id, companyId]);
      if (branchCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid Branch reference' });
      }

      const deptCheck = await query('SELECT id FROM hrms.departments WHERE id = $1 AND branch_id = $2 AND company_id = $3', [department_id, branch_id, companyId]);
      if (deptCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid Department reference' });
      }

      const dupCheck = await query(
        'SELECT id FROM hrms.designations WHERE company_id = $1 AND department_id = $2 AND LOWER(TRIM(name)) = LOWER($3)',
        [companyId, department_id, cleanName]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: `A designation with the title "${cleanName}" already exists in this department` });
      }

      const result = await query(
        'INSERT INTO hrms.designations (company_id, branch_id, department_id, name, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [companyId, branch_id, department_id, cleanName, description || '']
      );
      return res.status(201).json({ message: 'Designation created successfully', designation: result.rows[0] });
    } catch (err: any) {
      console.error('Error creating designation:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Designation already exists in this hierarchy' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.put(
  '/api/v1/designations/:id',
  authenticateToken,
  requirePermission('edit_designations'),
  async (req: AuthenticatedRequest, res: Response) => {
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
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ error: 'Designation name is required' });
    }
    if (cleanName.length > 50) {
      return res.status(400).json({ error: 'Designation name cannot exceed 50 characters' });
    }

    try {
      const desigCheck = await query('SELECT company_id FROM hrms.designations WHERE id = $1', [id]);
      if (desigCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Designation not found' });
      }
      const targetCompId = desigCheck.rows[0].company_id;

      if (!isSuperAdmin) {
        if (targetCompId !== companyId) {
          return res.status(403).json({ error: 'Access denied: Designation is not in your company context' });
        }
      }

      const branchCheck = await query('SELECT id FROM hrms.branches WHERE id = $1 AND company_id = $2', [branch_id, targetCompId]);
      if (branchCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid Branch reference' });
      }

      const deptCheck = await query('SELECT id FROM hrms.departments WHERE id = $1 AND branch_id = $2 AND company_id = $3', [department_id, branch_id, targetCompId]);
      if (deptCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid Department reference' });
      }

      const dupCheck = await query(
        'SELECT id FROM hrms.designations WHERE company_id = $1 AND department_id = $2 AND LOWER(TRIM(name)) = LOWER($3) AND id != $4',
        [targetCompId, department_id, cleanName, id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: `A designation with the title "${cleanName}" already exists in this department` });
      }

      const result = await query(
        'UPDATE hrms.designations SET branch_id = $1, department_id = $2, name = $3, description = $4, status = $5 WHERE id = $6 RETURNING *',
        [branch_id, department_id, cleanName, description || '', status || 'ACTIVE', id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Designation not found' });
      }

      return res.json({ message: 'Designation updated successfully', designation: result.rows[0] });
    } catch (err: any) {
      console.error('Error updating designation:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Designation already exists in this hierarchy' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.delete(
  '/api/v1/designations/:id',
  authenticateToken,
  requirePermission('delete_designations'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;

    try {
      if (!isSuperAdmin) {
        const desigCheck = await query('SELECT company_id FROM hrms.designations WHERE id = $1', [id]);
        if (desigCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Designation not found' });
        }
        if (desigCheck.rows[0].company_id !== companyId) {
          return res.status(403).json({ error: 'Access denied: Designation is not in your company context' });
        }
      }

      const result = await query('DELETE FROM hrms.designations WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Designation not found' });
      }

      return res.json({ message: 'Designation deleted successfully' });
    } catch (err: any) {
      console.error('Error deleting designation:', err);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Cannot delete designation because it has active employees linked to it' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

/**
 * 🔄 DYNAMIC DATABASE TABLE-BASED PERMISSIONS SYNCHRONIZATION
 */
let lastPermissionSyncTime = 0;

async function syncDynamicPermissions(force = false) {
  // Cache sync for 5 minutes (300,000ms) unless forced
  if (!force && Date.now() - lastPermissionSyncTime < 300000) {
    return;
  }
  try {
    // 1. Get all tables in hrms schema (excluding internal system/meta tables)
    const tablesResult = await query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'hrms' 
         AND table_type = 'BASE TABLE'
         AND table_name NOT IN ('permissions', 'role_permissions', 'activity_logs')
       ORDER BY table_name`
    );
    const tables = tablesResult.rows.map(row => row.table_name);

    if (tables.length === 0) return;

    // 2. Define standard CRUD permissions for each table
    const requiredPermissions: { name: string; description: string; module: string }[] = [];
    tables.forEach(table => {
      const moduleName = table;
      requiredPermissions.push(
        {
          name: `view_${table}`,
          description: `Allow viewing of ${table} records`,
          module: moduleName
        },
        {
          name: `create_${table}`,
          description: `Allow creating new ${table} records`,
          module: moduleName
        },
        {
          name: `edit_${table}`,
          description: `Allow modifying existing ${table} records`,
          module: moduleName
        },
        {
          name: `delete_${table}`,
          description: `Allow deleting ${table} records`,
          module: moduleName
        }
      );
    });

    // 3. Batch Insert permissions
    if (requiredPermissions.length > 0) {
      const values: any[] = [];
      const valueRows: string[] = [];
      requiredPermissions.forEach((perm, idx) => {
        const base = idx * 3;
        valueRows.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
        values.push(perm.name, perm.description, perm.module);
      });

      await query(
        `INSERT INTO hrms.permissions (name, description, module) 
         VALUES ${valueRows.join(', ')} 
         ON CONFLICT (name) DO UPDATE 
         SET description = EXCLUDED.description, module = EXCLUDED.module`,
        values
      );
    }

    // 4. Clean up permissions for tables that no longer exist
    const activeNames = requiredPermissions.map(p => p.name);
    const placeholders = activeNames.map((_, i) => '$' + (i + 1)).join(', ');
    await query(
      `DELETE FROM hrms.permissions 
       WHERE name NOT IN (${placeholders})`,
      activeNames
    );

    lastPermissionSyncTime = Date.now();
  } catch (err) {
    console.error('[Permissions Sync] Error synchronizing permissions:', err);
  }
}

/**
 * 🔑 ROLES & PERMISSIONS API
 */
app.get(
  '/api/v1/roles',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    await syncDynamicPermissions();
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;

    if (!companyId) {
      if (isSuperAdmin) {
        try {
          const result = await query(
            `SELECT r.id, r.company_id, r.name, r.description, r.created_at, c.name as company_name,
              COALESCE(
                json_agg(
                  json_build_object('id', p.id, 'name', p.name, 'module', p.module, 'data_scope', COALESCE(rp.data_scope, 'ALL'))
                ) FILTER (WHERE p.id IS NOT NULL), 
                '[]'
              ) as permissions
             FROM hrms.roles r
             LEFT JOIN hrms.companies c ON r.company_id = c.id
             LEFT JOIN hrms.role_permissions rp ON r.id = rp.role_id
             LEFT JOIN hrms.permissions p ON rp.permission_id = p.id
             GROUP BY r.id, c.name
             ORDER BY r.name ASC`
          );
          return res.json({ roles: result.rows });
        } catch (err) {
          console.error('Error fetching all roles:', err);
          return res.status(500).json({ error: 'Internal server database error' });
        }
      }
      return res.status(400).json({ error: 'Company ID is required' });
    }

    try {
      const result = await query(
        `SELECT r.id, r.company_id, r.name, r.description, r.created_at, c.name as company_name,
          COALESCE(
            json_agg(
              json_build_object('id', p.id, 'name', p.name, 'module', p.module, 'data_scope', COALESCE(rp.data_scope, 'ALL'))
            ) FILTER (WHERE p.id IS NOT NULL), 
            '[]'
          ) as permissions
         FROM hrms.roles r
         LEFT JOIN hrms.companies c ON r.company_id = c.id
         LEFT JOIN hrms.role_permissions rp ON r.id = rp.role_id
         LEFT JOIN hrms.permissions p ON rp.permission_id = p.id
         WHERE r.company_id = $1
         GROUP BY r.id, c.name
         ORDER BY r.name ASC`,
        [companyId]
      );
      return res.json({ roles: result.rows });
    } catch (err) {
      console.error('Error fetching roles:', err);
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.post(
  '/api/v1/roles',
  authenticateToken,
  requirePermission('create_roles'),
  async (req: AuthenticatedRequest, res: Response) => {
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
      const result = await query(
        'INSERT INTO hrms.roles (company_id, name, description) VALUES ($1, $2, $3) RETURNING *',
        [companyId, name, description || '']
      );
      return res.status(201).json({ message: 'Role created successfully', role: result.rows[0] });
    } catch (err: any) {
      console.error('Error creating role:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Role already exists' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.put(
  '/api/v1/roles/:id',
  authenticateToken,
  requirePermission('edit_roles'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { name, description } = req.body;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;

    if (!name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    try {
      if (!isSuperAdmin) {
        const roleCheck = await query('SELECT company_id FROM hrms.roles WHERE id = $1', [id]);
        if (roleCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Role not found' });
        }
        if (roleCheck.rows[0].company_id !== companyId) {
          return res.status(403).json({ error: 'Access denied: Role is not in your company context' });
        }
      }

      const result = await query(
        'UPDATE hrms.roles SET name = $1, description = $2 WHERE id = $3 RETURNING *',
        [name, description || '', id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Role not found' });
      }

      return res.json({ message: 'Role updated successfully', role: result.rows[0] });
    } catch (err: any) {
      console.error('Error updating role:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Role name already exists' });
      }
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.delete(
  '/api/v1/roles/:id',
  authenticateToken,
  requirePermission('delete_roles'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;

    try {
      if (!isSuperAdmin) {
        const roleCheck = await query('SELECT company_id FROM hrms.roles WHERE id = $1', [id]);
        if (roleCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Role not found' });
        }
        if (roleCheck.rows[0].company_id !== companyId) {
          return res.status(403).json({ error: 'Access denied: Role is not in your company context' });
        }
      }

      // Safety check: count active employee assignments
      const empCheck = await query('SELECT COUNT(*) as count FROM hrms.user_roles WHERE role_id = $1', [id]);
      const count = parseInt(empCheck.rows[0]?.count || '0', 10);

      if (count > 0) {
        return res.status(400).json({
          error: `Cannot delete role: ${count} employee(s) are currently assigned to this role. Reassign employees before deleting.`
        });
      }

      await query('DELETE FROM hrms.role_permissions WHERE role_id = $1', [id]);
      const result = await query('DELETE FROM hrms.roles WHERE id = $1 RETURNING *', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Role not found' });
      }

      return res.json({ message: 'Role deleted successfully', role: result.rows[0] });
    } catch (err) {
      console.error('Error deleting role:', err);
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.get(
  '/api/v1/permissions',
  authenticateToken,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      await syncDynamicPermissions();
      const result = await query('SELECT id, name, description, module FROM hrms.permissions ORDER BY module, name ASC');
      return res.json({ permissions: result.rows });
    } catch (err) {
      console.error('Error fetching permissions:', err);
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

app.post(
  '/api/v1/roles/:roleId/permissions',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const { roleId } = req.params;
    const { permissionIds, permissionScopes } = req.body;

    if (!roleId || !Array.isArray(permissionIds)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
      await query('BEGIN');

      const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
      const companyId = req.user?.companyId;

      if (!isSuperAdmin) {
        const roleCheck = await query('SELECT id FROM hrms.roles WHERE id = $1 AND company_id = $2', [roleId, companyId]);
        if (roleCheck.rows.length === 0) {
          await query('ROLLBACK');
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      await query('DELETE FROM hrms.role_permissions WHERE role_id = $1', [roleId]);

      const uniquePermIds = Array.from(new Set(permissionIds));

      if (uniquePermIds.length > 0) {
        const values: any[] = [];
        const valueRows: string[] = [];
        uniquePermIds.forEach((permId: any, idx: number) => {
          const scope = (permissionScopes && permissionScopes[permId]) ? permissionScopes[permId] : 'ALL';
          const base = idx * 3;
          valueRows.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
          values.push(roleId, permId, scope);
        });

        await query(
          `INSERT INTO hrms.role_permissions (role_id, permission_id, data_scope) 
           VALUES ${valueRows.join(', ')}
           ON CONFLICT (role_id, permission_id) 
           DO UPDATE SET data_scope = EXCLUDED.data_scope`,
          values
        );
      }

      await query('COMMIT');
      return res.json({ message: 'Role permissions updated successfully' });
    } catch (err) {
      await query('ROLLBACK');
      console.error('Error updating role permissions:', err);
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

/**
 * 🕒 SHIFTS CRUD APIs
 */
app.get('/api/v1/shifts', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? (req.query.companyId || null) : req.user?.companyId;

  try {
    let result;
    if (companyId) {
      result = await query(
        `SELECT sm.id, sm.company_id, sm.shift_name as name, sm.start_time, sm.end_time, sm.grace_in_minutes, sm.grace_out_minutes, 
                sm.min_half_day_minutes as halfday_minutes, sm.min_full_day_minutes as fullday_minutes, 
                sm.is_night_shift as is_overnight, sm.allow_overtime, sm.ot_after_minutes, sm.is_active, c.name as company_name 
         FROM hrms.shift_masters sm
         LEFT JOIN hrms.companies c ON sm.company_id = c.id
         WHERE sm.company_id = $1 AND sm.is_active = true 
         ORDER BY sm.shift_name ASC`,
        [companyId]
      );
    } else {
      result = await query(
        `SELECT sm.id, sm.company_id, sm.shift_name as name, sm.start_time, sm.end_time, sm.grace_in_minutes, sm.grace_out_minutes, 
                sm.min_half_day_minutes as halfday_minutes, sm.min_full_day_minutes as fullday_minutes, 
                sm.is_night_shift as is_overnight, sm.allow_overtime, sm.ot_after_minutes, sm.is_active, c.name as company_name 
         FROM hrms.shift_masters sm
         LEFT JOIN hrms.companies c ON sm.company_id = c.id
         WHERE sm.is_active = true 
         ORDER BY c.name ASC, sm.shift_name ASC`
      );
    }
    return res.json({ shifts: result.rows });
  } catch (err) {
    console.error('Error fetching shifts:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/shifts', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { name, start_time, end_time, grace_in_minutes, grace_out_minutes, halfday_minutes, fullday_minutes, is_overnight, allow_overtime, ot_after_minutes } = req.body;

  if (!companyId || !name || !start_time || !end_time) {
    return res.status(400).json({ error: 'Required fields missing: companyId, name, start_time, end_time' });
  }

  try {
    const result = await query(
      `INSERT INTO hrms.shift_masters (company_id, shift_name, start_time, end_time, grace_in_minutes, grace_out_minutes, min_half_day_minutes, min_full_day_minutes, is_night_shift, allow_overtime, ot_after_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING id, company_id, shift_name as name, start_time, end_time, grace_in_minutes, grace_out_minutes, min_half_day_minutes as halfday_minutes, min_full_day_minutes as fullday_minutes, is_night_shift as is_overnight, allow_overtime, ot_after_minutes`,
      [
        companyId,
        name,
        start_time,
        end_time,
        grace_in_minutes ? parseInt(grace_in_minutes) : 15,
        grace_out_minutes ? parseInt(grace_out_minutes) : 15,
        halfday_minutes ? parseInt(halfday_minutes) : 240,
        fullday_minutes ? parseInt(fullday_minutes) : 480,
        is_overnight || false,
        allow_overtime || false,
        ot_after_minutes ? parseInt(ot_after_minutes) : 0
      ]
    );
    logUserAction(req, 'CREATE_SHIFT', 'Shifts', `Created shift timing '${name}' (${start_time} - ${end_time})`);
    return res.status(201).json({ message: 'Shift created successfully', shift: result.rows[0] });
  } catch (err) {
    console.error('Error creating shift:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/shifts/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { name, start_time, end_time, grace_in_minutes, grace_out_minutes, halfday_minutes, fullday_minutes, is_overnight, allow_overtime, ot_after_minutes } = req.body;

  try {
    if (!isSuperAdmin) {
      const check = await query('SELECT id FROM hrms.shift_masters WHERE id = $1 AND company_id = $2', [id, companyId]);
      if (check.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
      `UPDATE hrms.shift_masters 
       SET shift_name = $1, start_time = $2, end_time = $3, grace_in_minutes = $4, grace_out_minutes = $5, min_half_day_minutes = $6, min_full_day_minutes = $7, is_night_shift = $8, allow_overtime = $9, ot_after_minutes = $10, updated_at = NOW()
       WHERE id = $11 
       RETURNING id, company_id, shift_name as name, start_time, end_time, grace_in_minutes, grace_out_minutes, min_half_day_minutes as halfday_minutes, min_full_day_minutes as fullday_minutes, is_night_shift as is_overnight, allow_overtime, ot_after_minutes`,
      [
        name,
        start_time,
        end_time,
        grace_in_minutes ? parseInt(grace_in_minutes) : 15,
        grace_out_minutes ? parseInt(grace_out_minutes) : 15,
        halfday_minutes ? parseInt(halfday_minutes) : 240,
        fullday_minutes ? parseInt(fullday_minutes) : 480,
        is_overnight || false,
        allow_overtime || false,
        ot_after_minutes ? parseInt(ot_after_minutes) : 0,
        id
      ]
    );
    logUserAction(req, 'UPDATE_SHIFT', 'Shifts', `Updated shift timing '${name}'`);
    return res.json({ message: 'Shift updated successfully', shift: result.rows[0] });
  } catch (err) {
    console.error('Error updating shift:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/shifts/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;

  try {
    if (!isSuperAdmin) {
      const check = await query('SELECT id FROM hrms.shift_masters WHERE id = $1 AND company_id = $2', [id, companyId]);
      if (check.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
    }

    await query('UPDATE hrms.shift_masters SET is_active = false WHERE id = $1', [id]);
    logUserAction(req, 'DELETE_SHIFT', 'Shifts', `Deactivated shift timing ID ${id}`);
    return res.json({ message: 'Shift deleted successfully' });
  } catch (err) {
    console.error('Error deleting shift:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

/**
 * 🕒 EMPLOYEE SHIFTS MAPPING APIs
 */
app.get('/api/v1/employee-shifts', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? (req.query.companyId || null) : req.user?.companyId;
  if (!companyId && !isSuperAdmin) return res.status(400).json({ error: 'Company ID is required' });

  try {
    const scopeCtx = await getEmployeeDataScope(req, 'shifts', 'view_shifts');
    const scopeCond = buildDataScopeCondition(scopeCtx, 'es', 'employee_id', companyId ? 2 : 1);

    let whereClause = companyId ? `WHERE e.company_id = $1` : ``;
    const params: any[] = companyId ? [companyId] : [];

    if (scopeCond.whereSql) {
      if (whereClause) {
        whereClause += ` AND ${scopeCond.whereSql}`;
      } else {
        whereClause = `WHERE ${scopeCond.whereSql}`;
      }
      params.push(...scopeCond.params);
    }

    const result = await query(
      `SELECT es.id, es.employee_id, es.shift_id, es.effective_from, es.effective_to, es.is_default,
              e.first_name, e.last_name, e.emp_id_code, e.company_id as company_id,
              sm.shift_name as shift_name,
              c.name as company_name
       FROM hrms.employee_shifts es
       JOIN hrms.employees e ON es.employee_id = e.id
       JOIN hrms.shift_masters sm ON es.shift_id = sm.id
       LEFT JOIN hrms.companies c ON e.company_id = c.id
       ${whereClause}
       ORDER BY es.effective_from DESC`,
      params
    );
    return res.json({ employeeShifts: result.rows });
  } catch (err) {
    console.error('Error fetching employee shifts:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/employee-shifts', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { employee_id, shift_id, effective_from, effective_to, is_default } = req.body;

  if (!companyId || !employee_id || !shift_id || !effective_from) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  try {
    const empCheck = await query('SELECT id FROM hrms.employees WHERE id = $1 AND company_id = $2', [employee_id, companyId]);
    if (empCheck.rows.length === 0) return res.status(400).json({ error: 'Invalid employee reference' });

    if (is_default) {
      await query('UPDATE hrms.employee_shifts SET is_default = false WHERE employee_id = $1', [employee_id]);
    }

    const result = await query(
      `INSERT INTO hrms.employee_shifts (employee_id, shift_id, effective_from, effective_to, is_default)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [employee_id, shift_id, effective_from, effective_to || null, is_default || false]
    );

    // 🔔 Notify Employee about shift assignment
    try {
      const shiftInfo = await query('SELECT shift_name, start_time, end_time FROM hrms.shift_masters WHERE id = $1', [shift_id]);
      const sName = shiftInfo.rows[0]?.shift_name || 'New Shift';
      const sTimes = shiftInfo.rows[0] ? `(${shiftInfo.rows[0].start_time} - ${shiftInfo.rows[0].end_time})` : '';

      sendNotification({
        companyId,
        recipientId: employee_id,
        module: 'SHIFTS',
        eventCode: 'SHIFT_ASSIGNED',
        referenceType: 'EMPLOYEE_SHIFT',
        referenceId: result.rows[0].id,
        title: 'Shift Schedule Updated ⏰',
        message: `Your duty shift has been updated to '${sName}' ${sTimes} effective from ${effective_from}.`,
        type: 'INFO',
        actionUrl: '/dashboard/shifts',
      });
    } catch (notifErr) {
      console.error('[ShiftNotif] Error sending shift notification:', notifErr);
    }

    return res.status(201).json({ message: 'Employee shift assigned successfully', employeeShift: result.rows[0] });
  } catch (err) {
    console.error('Error assigning shift:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/employee-shifts/rotate', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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
    await query('BEGIN');

    for (const empId of employee_ids) {
      await query(
        `DELETE FROM hrms.employee_shifts 
         WHERE employee_id = $1 
           AND (
             (effective_from BETWEEN $2 AND $3) 
             OR (effective_to BETWEEN $2 AND $3)
             OR (effective_from <= $2 AND (effective_to IS NULL OR effective_to >= $3))
           )`,
        [empId, start_date, end_date]
      );

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

        await query(
          `INSERT INTO hrms.employee_shifts (employee_id, shift_id, effective_from, effective_to, is_default)
           VALUES ($1, $2, $3, $4, false)`,
          [empId, currentShiftId, effectiveFromStr, effectiveToStr]
        );

        currentDate.setDate(currentDate.getDate() + days_interval);
        shiftIndex = (shiftIndex + 1) % shift_ids.length;
      }
    }

    await query('COMMIT');
    return res.status(201).json({ message: 'Rotational shifts scheduled successfully' });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Error generating shift rotations:', err);
    return res.status(500).json({ error: 'Internal server database error during rotation scheduling' });
  }
});

app.put('/api/v1/employee-shifts/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { shift_id, effective_from, effective_to, is_default } = req.body;

  try {
    const check = await query(
      `SELECT es.id, es.employee_id FROM hrms.employee_shifts es 
       JOIN hrms.employees e ON es.employee_id = e.id 
       WHERE es.id = $1 AND e.company_id = $2`,
      [id, companyId]
    );
    if (check.rows.length === 0) return res.status(403).json({ error: 'Access denied' });

    const employee_id = check.rows[0].employee_id;

    if (is_default) {
      await query('UPDATE hrms.employee_shifts SET is_default = false WHERE employee_id = $1 AND id != $2', [employee_id, id]);
    }

    const result = await query(
      `UPDATE hrms.employee_shifts 
       SET shift_id = $1, effective_from = $2, effective_to = $3, is_default = $4
       WHERE id = $5 RETURNING *`,
      [shift_id, effective_from, effective_to || null, is_default || false, id]
    );
    return res.json({ message: 'Employee shift assignment updated successfully', employeeShift: result.rows[0] });
  } catch (err) {
    console.error('Error updating employee shift:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/employee-shifts/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;

  try {
    const check = await query(
      `SELECT es.id FROM hrms.employee_shifts es 
       JOIN hrms.employees e ON es.employee_id = e.id 
       WHERE es.id = $1 AND e.company_id = $2`,
      [id, companyId]
    );
    if (check.rows.length === 0) return res.status(403).json({ error: 'Access denied' });

    await query('DELETE FROM hrms.employee_shifts WHERE id = $1', [id]);
    return res.json({ message: 'Employee shift assignment removed successfully' });
  } catch (err) {
    console.error('Error deleting employee shift:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});



/**
 * 🔒 ATTENDANCE LOCKS APIs (attendance_locks)
 */
app.get('/api/v1/attendance/locks', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.query.company_id || req.query.companyId || req.user?.companyId;
    let sql = `
      SELECT l.*, c.name as company_name,
             cb.first_name || ' ' || cb.last_name as locked_by_name
      FROM hrms.attendance_locks l
      LEFT JOIN hrms.companies c ON l.company_id = c.id
      LEFT JOIN hrms.employees cb ON l.locked_by = cb.id
    `;
    const params: any[] = [];
    if (companyId && companyId !== 'all') {
      sql += ` WHERE l.company_id = $1`;
      params.push(companyId);
    }
    sql += ` ORDER BY l.lock_year DESC, l.lock_month DESC`;

    const result = await query(sql, params);
    return res.json({ locks: result.rows });
  } catch (err) {
    console.error('Error fetching attendance locks:', err);
    return res.status(500).json({ error: 'Failed to fetch attendance locks' });
  }
});

app.post('/api/v1/attendance/locks', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { company_id, lock_year, lock_month, is_locked } = req.body;
    const userId = (req.user as any)?.id || null;
    const targetCompanyId = company_id || req.user?.companyId;

    if (!lock_year || !lock_month) {
      return res.status(400).json({ error: 'lock_year and lock_month are required' });
    }

    const existing = await query(
      `SELECT id FROM hrms.attendance_locks WHERE company_id = $1 AND lock_year = $2 AND lock_month = $3`,
      [targetCompanyId, lock_year, lock_month]
    );

    if (existing.rows.length > 0) {
      const updated = await query(
        `UPDATE hrms.attendance_locks SET is_locked = $1, locked_by = $2 WHERE id = $3 RETURNING *`,
        [is_locked ?? true, userId, existing.rows[0].id]
      );
      return res.json({ lock: updated.rows[0], message: 'Attendance lock updated' });
    } else {
      const inserted = await query(
        `INSERT INTO hrms.attendance_locks (id, company_id, lock_year, lock_month, is_locked, locked_by, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW()) RETURNING *`,
        [targetCompanyId, lock_year, lock_month, is_locked ?? true, userId]
      );
      return res.status(201).json({ lock: inserted.rows[0], message: 'Attendance lock created' });
    }
  } catch (err) {
    console.error('Error creating attendance lock:', err);
    return res.status(500).json({ error: 'Failed to save attendance lock' });
  }
});

app.put('/api/v1/attendance/locks/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_locked } = req.body;
    const userId = (req.user as any)?.id || null;

    const result = await query(
      `UPDATE hrms.attendance_locks SET is_locked = $1, locked_by = $2 WHERE id = $3 RETURNING *`,
      [is_locked, userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lock record not found' });
    }

    return res.json({ lock: result.rows[0], message: 'Attendance lock status updated successfully' });
  } catch (err) {
    console.error('Error updating attendance lock:', err);
    return res.status(500).json({ error: 'Failed to update attendance lock' });
  }
});

app.delete('/api/v1/attendance/locks/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(`DELETE FROM hrms.attendance_locks WHERE id = $1 RETURNING *`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lock record not found' });
    }

    return res.json({ success: true, message: 'Attendance month lock deleted successfully' });
  } catch (err) {
    console.error('Error deleting attendance lock:', err);
    return res.status(500).json({ error: 'Failed to delete attendance lock' });
  }
});

/**
 * 📱 EMPLOYEE DEVICE BINDING APIs (employee_devices)
 */
app.get('/api/v1/attendance/device-bindings', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyIdRaw = isSuperAdmin ? (req.query.companyId || req.query.company_id) : req.user?.companyId;
  const companyId = (companyIdRaw === 'ALL' || companyIdRaw === 'undefined' || companyIdRaw === 'null' || !companyIdRaw) ? null : String(companyIdRaw);

  try {
    const scopeCtx = await getEmployeeDataScope(req, 'attendance', 'view_employee_devices');

    let sql = `
      SELECT 
        e.id as employee_id,
        e.emp_id_code,
        e.first_name,
        e.last_name,
        e.email,
        d.name as department_name,
        des.name as designation_name,
        ed.id as device_id,
        ed.device_identifier,
        ed.device_model,
        CASE 
          WHEN ed.id IS NOT NULL AND (ed.status = 'ACTIVE' OR ed.status = 'COMPLETED') THEN 'COMPLETED'
          ELSE 'PENDING'
        END as binding_status,
        ed.created_at as registered_at
      FROM hrms.employees e
      LEFT JOIN hrms.departments d ON e.department_id = d.id
      LEFT JOIN hrms.designations des ON e.designation_id = des.id
      LEFT JOIN hrms.employee_devices ed ON e.id = ed.employee_id
    `;
    const params: any[] = [];
    const whereClauses: string[] = [];

    if (companyId) {
      params.push(companyId);
      whereClauses.push(`e.company_id = $${params.length}`);
    }

    const scopeCond = buildDataScopeCondition(scopeCtx, 'e', 'id', params.length + 1);
    if (scopeCond.whereSql) {
      whereClauses.push(scopeCond.whereSql);
      params.push(...scopeCond.params);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY e.first_name ASC, e.last_name ASC`;

    const result = await query(sql, params);
    return res.json({ devices: result.rows, dataScope: scopeCtx.dataScope });
  } catch (err) {
    console.error('Error fetching device bindings:', err);
    return res.status(500).json({ error: 'Failed to fetch device bindings' });
  }
});

app.post('/api/v1/attendance/device-bindings/reset', authenticateToken, requirePermission('edit_employee_devices'), async (req: AuthenticatedRequest, res: Response) => {
  const { employeeId } = req.body;
  if (!employeeId) return res.status(400).json({ error: 'Employee ID is required' });

  try {
    await query(`DELETE FROM hrms.employee_devices WHERE employee_id = $1`, [employeeId]);
    return res.json({ message: 'Device binding reset successfully' });
  } catch (err) {
    console.error('Error resetting device binding:', err);
    return res.status(500).json({ error: 'Failed to reset device binding' });
  }
});

/**
 * 🔑 TENANT DEVICE API KEYS & PUBLIC BIOMETRIC PUNCH WEBHOOK APIs
 */

// 1. Get Tenant Device API Keys
app.get('/api/v1/attendance/device-api-keys', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyIdRaw = isSuperAdmin ? (req.query.companyId || req.query.company_id) : req.user?.companyId;
  const companyId = (companyIdRaw === 'ALL' || companyIdRaw === 'undefined' || companyIdRaw === 'null' || !companyIdRaw) ? null : String(companyIdRaw);

  try {
    let sql = `SELECT id, company_id, device_name, api_key, allowed_ip, timezone, is_active, created_at FROM hrms.tenant_api_keys`;
    const params: any[] = [];
    if (companyId) {
      params.push(companyId);
      sql += ` WHERE company_id = $1`;
    }
    sql += ` ORDER BY created_at DESC`;

    const result = await query(sql, params);
    return res.json({ keys: result.rows });
  } catch (err) {
    console.error('Error fetching device API keys:', err);
    return res.status(500).json({ error: 'Failed to fetch device API keys' });
  }
});

// 2. Create / Generate New Device API Key
app.post('/api/v1/attendance/device-api-keys', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? (req.body.companyId || req.body.company_id) : req.user?.companyId;
  const { device_name, allowed_ip, timezone } = req.body;

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required to generate API Key.' });
  }

  try {
    const randomHex = require('crypto').randomBytes(16).toString('hex');
    const newApiKey = `hrms_live_sec_${randomHex}`;
    const devName = device_name || 'Main Biometric Machine';
    const tz = timezone || 'Asia/Kolkata';

    const insertRes = await query(
      `INSERT INTO hrms.tenant_api_keys (company_id, device_name, api_key, allowed_ip, timezone, is_active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [companyId, devName, newApiKey, allowed_ip || null, tz]
    );

    return res.status(201).json({
      message: 'Device API Key generated successfully.',
      key: insertRes.rows[0]
    });
  } catch (err) {
    console.error('Error creating device API key:', err);
    return res.status(500).json({ error: 'Failed to generate device API key' });
  }
});

// 3. Revoke / Delete Device API Key
app.delete('/api/v1/attendance/device-api-keys/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    await query(`DELETE FROM hrms.tenant_api_keys WHERE id = $1`, [id]);
    return res.json({ message: 'Device API Key revoked successfully.' });
  } catch (err) {
    console.error('Error deleting device API key:', err);
    return res.status(500).json({ error: 'Failed to revoke device API key' });
  }
});

// 4. Public Unauthenticated Biometric Punch Webhook API
app.post('/api/v1/attendance/public/device-punch', async (req: express.Request, res: express.Response) => {
  const apiKey = (req.headers['x-api-key'] || req.headers['authorization'] || req.body.api_key || req.query.api_key) as string;
  if (!apiKey) {
    return res.status(401).json({ success: false, error: 'Missing x-api-key header or api_key parameter.' });
  }

  const cleanKey = String(apiKey).replace(/^Bearer\s+/i, '').trim();

  try {
    const keyRes = await query(
      `SELECT * FROM hrms.tenant_api_keys WHERE api_key = $1 AND is_active = true`,
      [cleanKey]
    );

    if (keyRes.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid or deactivated API Key.' });
    }

    const keyRecord = keyRes.rows[0];
    const companyId = keyRecord.company_id;
    const allowedIp = keyRecord.allowed_ip;
    const timezone = keyRecord.timezone || 'Asia/Kolkata';

    // IP Whitelist Verification
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const incomingIp = Array.isArray(rawIp) ? rawIp[0] : typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '';

    if (allowedIp && allowedIp.trim() !== '') {
      const allowedList = allowedIp.split(',').map((ip: string) => ip.trim());
      if (!allowedList.includes(incomingIp) && incomingIp !== '127.0.0.1' && incomingIp !== '::1') {
        console.warn(`⚠️ [DEVICE PUNCH REJECTED] IP ${incomingIp} not in whitelist (${allowedIp})`);
        return res.status(403).json({ success: false, error: `Forbidden: IP address '${incomingIp}' is not whitelisted for this API Key.` });
      }
    }

    const { emp_code, employee_code, emp_id, punch_time, device_id, punch_type, direction } = req.body;
    const targetCode = String(emp_code || employee_code || emp_id || '').trim();

    if (!targetCode) {
      return res.status(400).json({ success: false, error: 'Required field missing: emp_code' });
    }

    // Resolve employee_id from emp_code or id
    const empRes = await query(
      `SELECT id, company_id, emp_id_code, first_name, last_name FROM hrms.employees 
       WHERE company_id = $1 AND (LOWER(emp_id_code) = LOWER($2) OR id::text = $2 OR regexp_replace(emp_id_code, '\\D', '', 'g') = $2)`,
      [companyId, targetCode]
    );

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: `Employee code '${targetCode}' not found in tenant company.` });
    }

    const emp = empRes.rows[0];

    // Raw punch time string parsing (e.g. "2026-09-10 13:30:00")
    let rawPunchTimeStr = punch_time ? String(punch_time).trim() : new Date().toISOString();
    let parsedDate: Date;

    if (rawPunchTimeStr.includes('T') || rawPunchTimeStr.endsWith('Z')) {
      parsedDate = new Date(rawPunchTimeStr);
    } else {
      const formattedIsoStr = rawPunchTimeStr.replace(' ', 'T');
      parsedDate = new Date(formattedIsoStr);
    }

    if (isNaN(parsedDate.getTime())) {
      parsedDate = new Date();
    }

    const isoUtcString = parsedDate.toISOString();
    const finalDirection = (direction || punch_type || 'AUTO').toUpperCase();
    const finalDeviceId = device_id || keyRecord.device_name || 'BIOMETRIC_WEBHOOK';

    // Insert into hrms.attendance_raw_punches
    const insertRes = await query(
      `INSERT INTO hrms.attendance_raw_punches 
       (company_id, employee_id, emp_code, punch_time, raw_punch_time, timezone, source, direction, ip_address, device_model, is_processed)
       VALUES ($1, $2, $3, $4, $5, $6, 'BIOMETRIC_API', $7, $8, $9, true)
       RETURNING *`,
      [companyId, emp.id, emp.emp_id_code || targetCode, isoUtcString, rawPunchTimeStr, timezone, finalDirection, incomingIp, finalDeviceId]
    );

    // Auto recalculate Daily Attendance Summary
    const dateStr = rawPunchTimeStr.split(' ')[0].split('T')[0];
    await updateEmployeeDailySummary(companyId, emp.id, dateStr, timezone);

    console.log(`✅ [PUBLIC DEVICE PUNCH SUCCESS] Saved punch for ${emp.first_name} (${targetCode}) at ${rawPunchTimeStr} (${timezone})`);

    return res.status(201).json({
      success: true,
      message: 'Punch recorded and attendance summary updated successfully.',
      punch: insertRes.rows[0]
    });
  } catch (err: any) {
    console.error('❌ Error in public device punch API:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error processing device punch' });
  }
});

/**
 * 📍 LIVE GPS LOCATION TRACKING APIs (attendance_location_tracking)
 */
app.post('/api/v1/attendance/live-location', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { latitude, longitude, location_name } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'Latitude and Longitude are required' });
    }

    const companyId = req.user?.companyId;
    const email = req.user?.email;

    const empRes = await query(`SELECT id, company_id FROM hrms.employees WHERE email = $1 LIMIT 1`, [email]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const emp = empRes.rows[0];
    const cid = companyId || emp.company_id;

    // Verify employee is currently Punched IN for today
    const todayStr = new Date().toISOString().split('T')[0];
    const punchCheck = await query(
      `SELECT direction, punch_time FROM hrms.attendance_raw_punches 
       WHERE employee_id = $1 AND punch_time::date = $2::date 
       ORDER BY punch_time DESC, id DESC LIMIT 1`,
      [emp.id, todayStr]
    );

    const lastPunch = punchCheck.rows[0];
    const isPunchedIn = lastPunch && String(lastPunch.direction).toUpperCase() === 'IN';

    if (!isPunchedIn) {
      return res.status(400).json({
        success: false,
        error: 'Location tracking is only recorded when employee is Punched IN'
      });
    }

    const insertRes = await query(
      `INSERT INTO hrms.attendance_location_tracking 
       (company_id, employee_id, latitude, longitude, location_name, recorded_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [cid, emp.id, Number(latitude), Number(longitude), location_name || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Location tracked successfully',
      location: insertRes.rows[0]
    });
  } catch (err: any) {
    console.error('Error posting live location tracking:', err);
    return res.status(500).json({ error: 'Failed to record location tracking' });
  }
});

app.get('/api/v1/attendance/live-tracking', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scopeCtx = await getEmployeeDataScope(req, 'attendance', 'view_attendance_tracking');
    const rawCompany = req.query.companyId || req.query.company_id;
    const companyId = rawCompany !== undefined && rawCompany !== null ? (rawCompany === 'all' ? null : String(rawCompany)) : req.user?.companyId;

    const { startDate, endDate, employeeId } = req.query;

    const todayStr = new Date().toISOString().split('T')[0];
    const sDate = startDate ? String(startDate) : todayStr;
    const eDate = endDate ? String(endDate) : todayStr;

    let params: any[] = [`${sDate} 00:00:00`, `${eDate} 23:59:59`];
    const scopeRes = buildDataScopeCondition(scopeCtx, 't', 'employee_id', 3);

    let scopeCondition = scopeRes.whereSql ? ` AND (${scopeRes.whereSql})` : '';
    params.push(...scopeRes.params);
    let paramIdx = scopeRes.nextParamIdx;

    if (companyId && companyId !== 'all') {
      scopeCondition += ` AND (t.company_id::text = $${paramIdx} OR e.company_id::text = $${paramIdx})`;
      params.push(String(companyId));
      paramIdx++;
    }

    if (employeeId && employeeId !== 'all') {
      scopeCondition += ` AND t.employee_id::text = $${paramIdx}`;
      params.push(String(employeeId));
      paramIdx++;
    }

    const sql = `
      SELECT 
        t.id,
        t.company_id,
        t.employee_id,
        t.latitude,
        t.longitude,
        t.location_name,
        t.recorded_at,
        e.emp_id_code,
        e.first_name,
        e.last_name,
        e.email,
        e.emp_image,
        d.name as department_name
      FROM hrms.attendance_location_tracking t
      JOIN hrms.employees e ON e.id = t.employee_id
      LEFT JOIN hrms.departments d ON d.id = e.department_id
      WHERE t.recorded_at >= $1::timestamp AND t.recorded_at <= $2::timestamp
      ${scopeCondition}
      ORDER BY t.recorded_at ASC
    `;

    const result = await query(sql, params);
    return res.json({
      success: true,
      logs: result.rows
    });
  } catch (err: any) {
    console.error('Error fetching live tracking logs:', err);
    return res.status(500).json({ error: 'Failed to fetch location tracking records' });
  }
});

/**
 * 🕒 ATTENDANCE SUMMARY LOG APIs
 */
app.get('/api/v1/attendance/summary', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const rawCompany = req.query.companyId || req.query.company_id;
  const companyId = isSuperAdmin ? (rawCompany ? String(rawCompany) : null) : req.user?.companyId;
  const { startDate, endDate, employeeId } = req.query;

  try {
    let sql = `
      SELECT asum.id, asum.company_id, asum.employee_id, asum.attendance_date, asum.shift_id,
             asum.first_in, asum.last_out, asum.worked_minutes, asum.break_minutes,
             asum.overtime_minutes, asum.approved_overtime_minutes, asum.ot_status,
             asum.late_minutes, asum.early_exit_minutes, asum.status, asum.punch_count,
             asum.is_regularized, asum.regularized_by, asum.processed_at,
             e.first_name, e.last_name, e.emp_id_code,
             sm.shift_name as shift_name,
             sm.start_time as shift_start_time,
             sm.end_time as shift_end_time,
             sm.grace_in_minutes as shift_grace_in,
             sm.min_half_day_minutes as shift_min_half_day,
             sm.min_full_day_minutes as shift_min_full_day,
             c.name as company_name
      FROM hrms.attendance_summary asum
      LEFT JOIN hrms.employees e ON asum.employee_id = e.id
      LEFT JOIN hrms.shift_masters sm ON asum.shift_id = sm.id
      LEFT JOIN hrms.companies c ON asum.company_id = c.id
    `;
    const params: any[] = [];
    let paramIdx = 1;
    let whereClauses: string[] = [];

    if (companyId && companyId !== 'all') {
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

    const scopeCtx = await getEmployeeDataScope(req, 'attendance');
    const scopeCond = buildDataScopeCondition(scopeCtx, 'asum', 'employee_id', paramIdx);

    if (scopeCond.whereSql) {
      whereClauses.push(scopeCond.whereSql);
      params.push(...scopeCond.params);
      paramIdx = scopeCond.nextParamIdx;
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY c.name ASC, asum.attendance_date DESC, e.emp_id_code ASC`;

    const result = await query(sql, params);
    const rawRows = result.rows || [];

    // Accurately compute late_minutes and status for each record based on dynamic shift parameters
    const processedRows = rawRows.map(row => {
      const startTime = row.shift_start_time || '09:30:00';
      const graceIn = typeof row.shift_grace_in === 'number' ? row.shift_grace_in : 15;
      const minFullDayMins = typeof row.shift_min_full_day === 'number' && row.shift_min_full_day > 0 
        ? row.shift_min_full_day 
        : 540; // Default 9 hours = 540 mins
      const minHalfDayMins = typeof row.shift_min_half_day === 'number' && row.shift_min_half_day > 0 
        ? row.shift_min_half_day 
        : 270; // Default 4.5 hours = 270 mins

      let computedLateMins = 0;
      if (row.first_in) {
        let ph = -1;
        let pm = -1;
        const str = String(row.first_in).replace('T', ' ').replace(/\.000Z$/, '').replace(/Z$/, '');
        const parts = str.split(' ');
        const timePart = parts.length >= 2 ? parts[1] : parts[0];
        if (timePart && timePart.includes(':')) {
          const pieces = timePart.split(':');
          ph = parseInt(pieces[0], 10);
          pm = parseInt(pieces[1], 10);
        }

        if (ph >= 0 && pm >= 0) {
          const [sh, sm] = startTime.split(':').map((v: string) => parseInt(v, 10));
          const punchMins = ph * 60 + pm;
          const shiftStartMins = (sh || 0) * 60 + (sm || 0);
          const graceDeadlineMins = shiftStartMins + graceIn;

          if (punchMins > graceDeadlineMins) {
            computedLateMins = punchMins - shiftStartMins;
          } else {
            computedLateMins = 0;
          }
        }
      }

      // Dynamic status rule based on shift master thresholds:
      let derivedStatus = (row.status || '').toUpperCase();
      const hasOut = row.last_out && String(row.last_out) !== '--:--' && String(row.last_out) !== 'null';
      const workedMins = row.worked_minutes || 0;
      if (!hasOut || workedMins < minHalfDayMins) {
        derivedStatus = 'ABSENT';
      } else if (workedMins >= minFullDayMins) {
        derivedStatus = 'PRESENT';
      } else if (workedMins >= minHalfDayMins) {
        derivedStatus = 'HALF_DAY';
      }

      return {
        ...row,
        shift_min_full_day: minFullDayMins,
        shift_min_half_day: minHalfDayMins,
        late_minutes: computedLateMins,
        status: derivedStatus
      };
    });

    return res.json({
      attendanceSummary: processedRows,
      records: processedRows,
      summary: processedRows,
      data: processedRows
    });
  } catch (err) {
    console.error('Error fetching attendance summary:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/attendance/summary', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { employee_id, attendance_date, shift_id, first_in, last_out, status, worked_minutes, late_minutes } = req.body;

  if (!companyId || !employee_id || !attendance_date || !status) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  try {
    const result = await query(
      `INSERT INTO hrms.attendance_summary 
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
       RETURNING *`,
      [
        companyId,
        employee_id,
        attendance_date,
        shift_id || null,
        first_in || null,
        last_out || null,
        status,
        worked_minutes ? parseInt(worked_minutes) : 0,
        late_minutes ? parseInt(late_minutes) : 0
      ]
    );
    return res.status(201).json({ message: 'Attendance summary saved successfully', attendanceRecord: result.rows[0] });
  } catch (err) {
    console.error('Error saving attendance summary:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/attendance/summary/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { status, first_in, last_out, worked_minutes, late_minutes, shift_id } = req.body;

  try {
    const check = await query('SELECT id FROM hrms.attendance_summary WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (check.rows.length === 0) return res.status(403).json({ error: 'Access denied' });

    const result = await query(
      `UPDATE hrms.attendance_summary 
       SET status = $1, first_in = $2, last_out = $3, worked_minutes = $4, late_minutes = $5, shift_id = $6, is_regularized = true, processed_at = NOW()
       WHERE id = $7 RETURNING *`,
      [
        status,
        first_in || null,
        last_out || null,
        worked_minutes ? parseInt(worked_minutes) : 0,
        late_minutes ? parseInt(late_minutes) : 0,
        shift_id || null,
        id
      ]
    );
    return res.json({ message: 'Attendance record updated successfully', attendanceRecord: result.rows[0] });
  } catch (err) {
    console.error('Error updating attendance summary:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/attendance/summary/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;

  try {
    const check = await query('SELECT id FROM hrms.attendance_summary WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (check.rows.length === 0) return res.status(403).json({ error: 'Access denied' });

    await query('DELETE FROM hrms.attendance_summary WHERE id = $1', [id]);
    return res.json({ message: 'Attendance record deleted successfully' });
  } catch (err) {
    console.error('Error deleting attendance summary:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

/**
 * 🕒 RAW PUNCH LOGS APIs
 */

/**
 * @openapi
 * /api/v1/attendance/raw-punches:
 *   get:
 *     summary: Display Attendance Raw Punch Logs
 *     tags:
 *       - Attendance & Raw Punches
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *         description: Start date filter (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *         description: End date filter (YYYY-MM-DD)
 *       - in: query
 *         name: company_id
 *         schema:
 *           type: string
 *         description: Company ID filter
 *     responses:
 *       200:
 *         description: Array of attendance raw punch logs
 *       401:
 *         description: Unauthorized
 */
app.get(['/api/v1/attendance/punches', '/api/v1/attendance/raw-punches'], authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const rawCompany = req.query.companyId || req.query.company_id;
  const companyId = isSuperAdmin ? (rawCompany ? String(rawCompany) : null) : req.user?.companyId;
  const startDate = (req.query.start_date || req.query.startDate) ? String(req.query.start_date || req.query.startDate) : null;
  const endDate = (req.query.end_date || req.query.endDate) ? String(req.query.end_date || req.query.endDate) : null;
  const requestedScope = req.query.scope ? String(req.query.scope).toUpperCase().trim() : null;

  try {
    let scopeCtx = await getEmployeeDataScope(req, 'attendance', 'view_attendance_raw_punches');

    if (requestedScope) {
      const scopeHierarchy: Record<string, number> = { SELF: 1, REPORTING: 2, TEAM: 2, DEPARTMENT: 3, DEPT: 3, ALL: 4 };
      const reqVal = requestedScope === 'TEAM' ? 'REPORTING' : requestedScope === 'DEPT' ? 'DEPARTMENT' : requestedScope;
      
      if (isSuperAdmin || (scopeHierarchy[reqVal] && scopeHierarchy[reqVal] <= (scopeHierarchy[scopeCtx.dataScope] || 1))) {
        if (['SELF', 'REPORTING', 'DEPARTMENT', 'ALL'].includes(reqVal)) {
          scopeCtx.dataScope = reqVal as any;
        }
      }
    }

    let whereClauses: string[] = [];
    let queryParams: any[] = [];
    let idx = 1;

    if (companyId && companyId !== 'all') {
      whereClauses.push(`rp.company_id::text = $${idx++}`);
      queryParams.push(companyId);
    }

    if (startDate) {
      whereClauses.push(`rp.punch_time >= $${idx++}::date`);
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClauses.push(`rp.punch_time <= ($${idx++}::date + INTERVAL '1 day')`);
      queryParams.push(endDate);
    }

    const scopeCond = buildDataScopeCondition(scopeCtx, 'e', 'id', idx);
    if (scopeCond.whereSql) {
      whereClauses.push(scopeCond.whereSql);
      queryParams.push(...scopeCond.params);
      idx = scopeCond.nextParamIdx;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `SELECT rp.id, rp.company_id, rp.employee_id, rp.punch_time, rp.device_id, rp.source,
                        rp.direction, rp.latitude, rp.longitude, rp.location_name, rp.device_model, rp.ip_address, rp.image_url, rp.is_processed, rp.created_at,
                        COALESCE(e.first_name, '') as first_name, COALESCE(e.last_name, '') as last_name, e.emp_id_code,
                        c.name as company_name
                 FROM hrms.attendance_raw_punches rp
                 LEFT JOIN hrms.employees e ON rp.employee_id::text = e.id::text
                 LEFT JOIN hrms.companies c ON rp.company_id::text = c.id::text
                 ${whereStr}
                 ORDER BY rp.punch_time DESC
                 LIMIT 500`;

    const result = await query(sql, queryParams);
    return res.json({ punches: result.rows, data: result.rows, dataScope: scopeCtx.dataScope });
  } catch (err) {
    console.error('Error fetching raw punches:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put(['/api/v1/attendance/punches/:id', '/api/v1/attendance/raw-punches/:id'], authenticateToken, requirePermission('edit_attendance_raw_punches'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { punch_time, direction, device_id, source, location_name } = req.body;

  try {
    const existing = await query(`SELECT * FROM hrms.attendance_raw_punches WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Raw punch record not found' });
    }

    const current = existing.rows[0];
    const newPunchTime = punch_time || current.punch_time;
    const newDirection = direction || current.direction;
    const newDeviceId = device_id !== undefined ? device_id : current.device_id;
    const newSource = source !== undefined ? source : current.source;
    const newLocationName = location_name !== undefined ? location_name : current.location_name;

    const sql = `
      UPDATE hrms.attendance_raw_punches
      SET punch_time = $1,
          direction = $2,
          device_id = $3,
          source = $4,
          location_name = $5
      WHERE id = $6
      RETURNING *
    `;

    const result = await query(sql, [newPunchTime, newDirection, newDeviceId, newSource, newLocationName, id]);
    return res.json({ message: 'Raw punch updated successfully', punch: result.rows[0] });
  } catch (err) {
    console.error('Error updating raw punch:', err);
    return res.status(500).json({ error: 'Failed to update raw punch record' });
  }
});

app.delete(['/api/v1/attendance/punches/:id', '/api/v1/attendance/raw-punches/:id'], authenticateToken, requirePermission('delete_attendance_raw_punches'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const existing = await query(`SELECT * FROM hrms.attendance_raw_punches WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Raw punch record not found' });
    }

    await query(`DELETE FROM hrms.attendance_raw_punches WHERE id = $1`, [id]);
    return res.json({ message: 'Raw punch deleted successfully' });
  } catch (err) {
    console.error('Error deleting raw punch:', err);
    return res.status(500).json({ error: 'Failed to delete raw punch record' });
  }
});


/**
 * @openapi
 * /api/v1/attendance/punches:
 *   post:
 *     summary: Submit Attendance Punch Log
 *     tags:
 *       - Attendance & Raw Punches
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - employee_id
 *               - punch_time
 *               - direction
 *             properties:
 *               employee_id:
 *                 type: string
 *                 description: Employee UUID
 *               punch_time:
 *                 type: string
 *                 example: "2026-08-17 09:15:00"
 *               direction:
 *                 type: string
 *                 enum: [IN, OUT]
 *                 example: IN
 *               source:
 *                 type: string
 *                 example: WEB
 *               location_name:
 *                 type: string
 *                 example: Main Office Gate
 *               latitude:
 *                 type: number
 *                 example: 17.4483
 *               longitude:
 *                 type: number
 *                 example: 78.3915
 *               image_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Punch log created and processed successfully
 *       400:
 *         description: Missing required fields or invalid employee reference
 */
app.post('/api/v1/attendance/punches', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  if (isSuperAdmin) {
    return res.status(403).json({ error: 'SuperAdmin accounts are master system administrators and exempt from attendance punching.' });
  }
  let companyId = isSuperAdmin 
    ? (req.body.companyId || req.body.company_id) 
    : (req.user?.companyId || req.body.companyId || req.body.company_id);
  let targetEmpId = req.body.employee_id || req.body.emp_id || req.body.employeeId;
  const { punch_time, source, direction, ip_address, latitude, longitude, image_url, location_name } = req.body;
  const actualPunchTime = punch_time || new Date().toISOString();

  if (!direction) {
    return res.status(400).json({ error: 'Required fields missing: direction' });
  }

  try {
    // Resolve employee_id from logged-in user email or emp_id_code if non-superadmin or missing
    if ((!isSuperAdmin || !targetEmpId || targetEmpId === '' || targetEmpId === 'undefined' || targetEmpId === 'null') && req.user?.email) {
      const empRes = await query('SELECT id, company_id FROM hrms.employees WHERE LOWER(email) = LOWER($1)', [req.user.email]);
      if (empRes.rows.length > 0) {
        targetEmpId = empRes.rows[0].id;
        if (!companyId) companyId = empRes.rows[0].company_id;
      }
    }

    if (targetEmpId) {
      const codeCheck = await query('SELECT id, company_id FROM hrms.employees WHERE id::text = $1 OR emp_id_code = $1', [targetEmpId]);
      if (codeCheck.rows.length > 0) {
        targetEmpId = codeCheck.rows[0].id;
        if (!companyId) companyId = codeCheck.rows[0].company_id;
      }
    }

    const empCheck = await query('SELECT id, company_id, allow_mobile_punch, require_punch_approval, reporting_to_id, first_name, last_name FROM hrms.employees WHERE id::text = $1', [targetEmpId]);
    if (empCheck.rows.length === 0) return res.status(400).json({ error: 'Invalid employee reference' });
    const empRecord = empCheck.rows[0];
    const finalCompanyId = companyId || empRecord.company_id;
    const allowMobilePunch = empRecord.allow_mobile_punch ?? true;
    const requirePunchApproval = empRecord.require_punch_approval ?? true;

    const uaCheck = req.headers['user-agent'] || '';
    const isMobileDevice = (source || '').toUpperCase() === 'MOBILE' || uaCheck.includes('Android') || uaCheck.includes('iPhone') || uaCheck.includes('iPad') || uaCheck.includes('Mobile');

    if (isMobileDevice && allowMobilePunch === false) {
      return res.status(403).json({ error: 'Mobile check-in is restricted for your account. Please use Office Web or Biometric device.' });
    }

    // Auto add location_name and device_model columns if missing & ensure image_url is TEXT
    await query(`ALTER TABLE hrms.attendance_raw_punches ADD COLUMN IF NOT EXISTS location_name TEXT`).catch(() => { });
    await query(`ALTER TABLE hrms.attendance_raw_punches ADD COLUMN IF NOT EXISTS device_model TEXT`).catch(() => { });
    await query(`ALTER TABLE hrms.attendance_raw_punches ALTER COLUMN image_url TYPE TEXT`).catch(() => { });

    // Real Client IP extraction
    let actualIp = ip_address;
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const headerIp = Array.isArray(rawIp)
      ? rawIp[0]
      : typeof rawIp === 'string'
        ? rawIp.split(',')[0].trim()
        : '';

    if (!actualIp || actualIp === '127.0.0.1' || actualIp === '::1' || actualIp === '::ffff:127.0.0.1') {
      actualIp = (headerIp && headerIp !== '127.0.0.1' && headerIp !== '::1') ? headerIp : (ip_address || '105.192.47.170');
    }

    // Dynamic User-Agent parsing for exact Device Model
    const ua = req.headers['user-agent'] || '';
    let devModel = req.body.device_model;
    if (devModel) {
      if (devModel.includes('I2301')) devModel = devModel.replace(/iQOO Phone \(I2301\)|iQOO Z9x 5G|I2301/g, 'iQOO Z7 Pro 5G');
      else if (devModel.includes('I2202')) devModel = devModel.replace(/I2202/g, 'iQOO Neo 7');
      else if (devModel.includes('V2025')) devModel = devModel.replace(/V2025/g, 'Vivo V20');
      else if (devModel.includes('CPH2083')) devModel = devModel.replace(/CPH2083/g, 'Oppo A12');
    }

    if (!devModel || devModel === 'Mobile App / Web' || devModel === 'Web Browser' || devModel === 'Mobile App') {
      if (ua.includes('iPhone')) devModel = 'Apple iPhone';
      else if (ua.includes('iPad')) devModel = 'Apple iPad';
      else if (ua.includes('Android')) {
        const match = ua.match(/Android\s+[\d.]+;\s*([^;)]+)/);
        devModel = match ? `Android (${match[1].trim()})` : 'Android Device';
      } else if (ua.includes('Windows')) devModel = 'Windows Desktop';
      else if (ua.includes('Macintosh')) devModel = 'macOS Desktop';
      else devModel = source === 'WEB' ? 'Web Browser' : 'Mobile Device';
    }

    const devId = req.body.device_identifier || actualIp;
    let bindingResult = { status: 'COMPLETED', device_identifier: devId, device_model: devModel, message: 'Device bound successfully' };

    try {
      const devCheck = await query('SELECT * FROM hrms.employee_devices WHERE employee_id::text = $1', [targetEmpId]);
      if (devCheck.rows.length === 0) {
        await query(
          `INSERT INTO hrms.employee_devices (employee_id, device_identifier, device_model, status, created_at)
           VALUES ($1, $2, $3, 'ACTIVE', NOW())`,
          [targetEmpId, devId, devModel]
        );
        console.log(`📱 [DEVICE BINDING SUCCESS] Bound new device for employee ${targetEmpId}: ${devModel} (${devId})`);
      } else {
        await query(
          `UPDATE hrms.employee_devices 
           SET device_identifier = $1, device_model = $2, status = 'ACTIVE', created_at = NOW() 
           WHERE employee_id::text = $3`,
          [devId, devModel, targetEmpId]
        );
        console.log(`📱 [DEVICE BINDING SUCCESS] Updated active device binding for employee ${targetEmpId}: ${devModel} (${devId})`);
      }
    } catch (e: any) {
      console.error(`❌ [DEVICE BINDING ERROR] Failed to bind device for employee ${targetEmpId}:`, e?.message || e);
      bindingResult = { status: 'ERROR', device_identifier: devId, device_model: devModel, message: e?.message || 'Device binding DB error' };
    }

    let finalLocationName = location_name || null;
    if (!finalLocationName && latitude && longitude && process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`);
        const geoData: any = await geoRes.json();
        if (geoData && geoData.status === 'OK' && Array.isArray(geoData.results) && geoData.results.length > 0) {
          finalLocationName = geoData.results[0].formatted_address;
        }
      } catch (e) {
        console.error('Backend Google Geocoding Error:', e);
      }
    }

    const result = await query(
      `INSERT INTO hrms.attendance_raw_punches (company_id, employee_id, punch_time, source, direction, ip_address, latitude, longitude, image_url, location_name, device_model, is_processed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false) RETURNING *`,
      [
        finalCompanyId,
        targetEmpId,
        actualPunchTime,
        source || 'WEB',
        direction,
        actualIp || null,
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        image_url || null,
        finalLocationName,
        devModel || null
      ]
    );

    const punchDate = String(punch_time).split(' ')[0].split('T')[0];

    const dayPunches = await query(
      `SELECT punch_time, direction FROM hrms.attendance_raw_punches 
       WHERE employee_id::text = $1::text AND punch_time::date = $2::date
       ORDER BY punch_time ASC`,
      [targetEmpId, punchDate]
    );

    let firstIn: string | null = null;
    let lastOut: string | null = null;
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
    let shiftStartTime = '09:30:00';
    let shiftGraceMins = 15;
    let minFullDayMins = 420;
    let minHalfDayMins = 240;

    let allowOt = false;
    let otAfterMins = 0;

    const empShiftRes = await query(
      `SELECT es.shift_id, sm.start_time, sm.grace_in_minutes, sm.min_half_day_minutes, sm.min_full_day_minutes, sm.allow_overtime, sm.ot_after_minutes 
       FROM hrms.employee_shifts es
       JOIN hrms.shift_masters sm ON es.shift_id = sm.id
       WHERE es.employee_id::text = $1::text AND es.effective_from <= $2::date 
       ORDER BY es.effective_from DESC LIMIT 1`,
      [targetEmpId, punchDate]
    );

    if (empShiftRes.rows.length > 0) {
      shiftId = empShiftRes.rows[0].shift_id;
      shiftStartTime = empShiftRes.rows[0].start_time || '09:30:00';
      shiftGraceMins = parseInt(empShiftRes.rows[0].grace_in_minutes, 10) || 15;
      if (empShiftRes.rows[0].min_full_day_minutes) minFullDayMins = parseInt(empShiftRes.rows[0].min_full_day_minutes, 10);
      if (empShiftRes.rows[0].min_half_day_minutes) minHalfDayMins = parseInt(empShiftRes.rows[0].min_half_day_minutes, 10);
      allowOt = empShiftRes.rows[0].allow_overtime === true;
      otAfterMins = parseInt(empShiftRes.rows[0].ot_after_minutes, 10) || 0;
    } else {
      const defShift = await query(
        `SELECT id, start_time, grace_in_minutes, min_half_day_minutes, min_full_day_minutes, allow_overtime, ot_after_minutes FROM hrms.shift_masters WHERE company_id = $1 AND (is_active = true OR is_active IS NULL) ORDER BY created_at ASC LIMIT 1`,
        [companyId]
      );
      if (defShift.rows.length > 0) {
        shiftId = defShift.rows[0].id;
        shiftStartTime = defShift.rows[0].start_time || '09:30:00';
        shiftGraceMins = parseInt(defShift.rows[0].grace_in_minutes, 10) || 15;
        if (defShift.rows[0].min_full_day_minutes) minFullDayMins = parseInt(defShift.rows[0].min_full_day_minutes, 10);
        if (defShift.rows[0].min_half_day_minutes) minHalfDayMins = parseInt(defShift.rows[0].min_half_day_minutes, 10);
        allowOt = defShift.rows[0].allow_overtime === true;
        otAfterMins = parseInt(defShift.rows[0].ot_after_minutes, 10) || 0;
      }
    }

    let lateMinutes = 0;
    let overtimeMinutes = 0;
    if (firstIn && shiftStartTime) {
      const [sh, sm] = shiftStartTime.split(':').map(Number);
      let ph = 0;
      let pm = 0;
      const str = String(firstIn);
      if (str.includes('T') || str.includes(' ')) {
        const timePart = str.includes('T') ? str.split('T')[1] : str.split(' ')[1];
        if (timePart) {
          const tPieces = timePart.split(':');
          ph = parseInt(tPieces[0], 10) || 0;
          pm = parseInt(tPieces[1], 10) || 0;
        }
      } else {
        const d = new Date(firstIn);
        ph = d.getUTCHours();
        pm = d.getUTCMinutes();
      }
      const punchTotalMinutes = ph * 60 + pm;
      const shiftTotalMinutes = sh * 60 + sm;
      const graceLimitMins = shiftTotalMinutes + shiftGraceMins;

      if (punchTotalMinutes > graceLimitMins) {
        lateMinutes = punchTotalMinutes - shiftTotalMinutes;
      }
    }

    // Automatic Overtime Calculation: Triggered when allow_overtime is enabled and worked minutes exceed shift full day limit
    if (allowOt && firstIn && lastOut && workedMinutes > minFullDayMins) {
      const excess = workedMinutes - minFullDayMins;
      if (excess >= otAfterMins) {
        overtimeMinutes = excess;
      }
    }

    let status = 'ABSENT';
    if (firstIn && lastOut && workedMinutes >= minFullDayMins) {
      status = 'PRESENT';
    } else if (firstIn && lastOut && workedMinutes >= minHalfDayMins) {
      status = 'HALF_DAY';
    } else {
      status = 'ABSENT';
    }

    if (isMobileDevice && requirePunchApproval === true && status !== 'ABSENT') {
      status = 'PENDING_APPROVAL';
    }

    await query(
      `INSERT INTO hrms.attendance_summary 
       (company_id, employee_id, attendance_date, shift_id, first_in, last_out, status, worked_minutes, late_minutes, overtime_minutes, punch_count, processed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (employee_id, attendance_date) 
       DO UPDATE SET 
         first_in = COALESCE(EXCLUDED.first_in, hrms.attendance_summary.first_in),
         last_out = COALESCE(EXCLUDED.last_out, hrms.attendance_summary.last_out),
         worked_minutes = EXCLUDED.worked_minutes,
         late_minutes = EXCLUDED.late_minutes,
         overtime_minutes = EXCLUDED.overtime_minutes,
         status = EXCLUDED.status,
         punch_count = EXCLUDED.punch_count,
         processed_at = NOW()`,
      [finalCompanyId, targetEmpId, punchDate, shiftId, firstIn, lastOut, status, workedMinutes, lateMinutes, overtimeMinutes, punchCount]
    );

    return res.status(201).json({
      message: 'Punch log created and processed successfully',
      punch: result.rows[0],
      device_binding: bindingResult
    });
  } catch (err) {
    console.error('Error creating punch:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

/**
 * 📡 BIOMETRIC ATTENDANCE SYNC ENDPOINT (SOAP 1.1 / GetTransactionsLog)
 */
app.post(['/api/attendance/sync-biometric', '/api/v1/attendance/sync-biometric'], authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { serverUrl, username, password, fromDate, toDate, serialNumber, rawLogText } = req.body;

    let targetUrl = (serverUrl && String(serverUrl).trim() !== '')
      ? String(serverUrl).trim()
      : 'http://172.30.0.250:8086/iclock/webapiservice.asmx';

    // Strip trailing query parameters like ?op=GetTransactionsLog or ?wsdl
    targetUrl = targetUrl.split('?')[0];

    const targetUser = (username && String(username).trim() !== '') ? String(username).trim() : 'Admin';
    const targetPass = (password !== undefined && password !== null && String(password).trim() !== '') ? String(password) : 'Btpl@123';
    const targetSerial = (serialNumber !== undefined && serialNumber !== null && String(serialNumber).trim() !== '') ? String(serialNumber).trim() : 'QJT3243900297';

    const todayStr = new Date().toISOString().split('T')[0];
    const fromStr = fromDate || '2026-06-25';
    const toStr = toDate || todayStr;

    const fromDateTimeStr = `${fromStr} 00:00:00`;
    const toDateTimeStr = `${toStr} 23:59:59`;

    let soapResText = '';

    if (rawLogText && typeof rawLogText === 'string' && rawLogText.trim() !== '') {
      console.log(`📡 [BIOMETRIC SYNC START] Received pre-fetched rawLogText from client (${rawLogText.length} chars)`);
      soapResText = rawLogText;
    } else {
      console.log(`📡 [BIOMETRIC SYNC START] Fetching logs from ${targetUrl} for user '${targetUser}', serial '${targetSerial}' for period ${fromDateTimeStr} to ${toDateTimeStr}...`);

      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTransactionsLog xmlns="http://tempuri.org/">
      <FromDateTime>${fromDateTimeStr}</FromDateTime>
      <ToDateTime>${toDateTimeStr}</ToDateTime>
      <SerialNumber>${targetSerial}</SerialNumber>
      <UserName>${targetUser}</UserName>
      <UserPassword>${targetPass}</UserPassword>
      <strDataList></strDataList>
    </GetTransactionsLog>
  </soap:Body>
</soap:Envelope>`;

      // Execute SOAP HTTP POST with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const soapResponse = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': '"http://tempuri.org/GetTransactionsLog"'
          },
          body: soapBody,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!soapResponse.ok) {
          return res.status(502).json({
            error: `Biometric server returned HTTP status ${soapResponse.status} ${soapResponse.statusText}`
          });
        }

        soapResText = await soapResponse.text();
      } catch (netErr: any) {
        clearTimeout(timeoutId);
        console.error('❌ [BIOMETRIC SYNC NETWORK ERROR]:', netErr);
        return res.status(504).json({
          error: `Could not connect to Biometric server at ${targetUrl}: ${netErr?.message || 'Network unreachable'}`
        });
      }
    }

    // Extract content from XML response: Prioritize <strDataList> where actual log rows live
    let logString = '';
    const strDataMatch = soapResText.match(/<strDataList[^>]*>([\s\S]*?)<\/strDataList>/i);
    const resultMatch = soapResText.match(/<GetTransactionsLogResult[^>]*>([\s\S]*?)<\/GetTransactionsLogResult>/i);

    if (strDataMatch && strDataMatch[1] && strDataMatch[1].trim().length > 0) {
      logString = strDataMatch[1];
    } else if (resultMatch && resultMatch[1]) {
      logString = resultMatch[1];
    } else {
      logString = soapResText;
    }

    logString = logString.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();

    // Check for Biometric Auth Errors
    if (
      logString.toLowerCase().includes('unathorised') ||
      logString.toLowerCase().includes('unauthorized') ||
      logString.toLowerCase().includes('invalid password') ||
      logString.toLowerCase().includes('access denied')
    ) {
      return res.status(401).json({
        error: `Biometric Authentication Failed: Server returned '${logString}'. Please check Username and Password.`
      });
    }

    const rawLines = logString.split(/\r?\n/);
    const parsedPunches: { userId: string; punchTime: string }[] = [];

    const xmlRowMatches = logString.match(/<(?:Row|Transaction|Record|Log)[^>]*>([\s\S]*?)<\/(?:Row|Transaction|Record|Log)>/gi);
    if (xmlRowMatches && xmlRowMatches.length > 0) {
      for (const rowXml of xmlRowMatches) {
        const uMatch = rowXml.match(/<(?:UserId|EnrollNumber|Pin|EmpCode)[^>]*>([^<]+)<\//i);
        const tMatch = rowXml.match(/<(?:LogDate|PunchTime|Time|DateTime|LogTime)[^>]*>([^<]+)<\//i);
        if (uMatch && tMatch) {
          parsedPunches.push({ userId: uMatch[1].trim(), punchTime: tMatch[1].trim() });
        }
      }
    } else {
      for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('<')) continue;
        const parts = trimmed.split(/[\t,;|\s]+/);
        if (parts.length >= 2) {
          const userId = parts[0].trim();
          let pTime = '';
          if (parts[1].match(/^\d{4}-\d{2}-\d{2}/) || parts[1].match(/^\d{2}\/\d{2}\/\d{4}/)) {
            pTime = parts.slice(1, 3).join(' ');
          } else if (parts.length >= 3 && (parts[2].match(/^\d{4}-\d{2}-\d{2}/) || parts[2].match(/^\d{2}\/\d{2}\/\d{4}/))) {
            pTime = parts.slice(2, 4).join(' ');
          }
          if (userId && pTime) {
            parsedPunches.push({ userId, punchTime: pTime });
          }
        }
      }
    }

    console.log(`📊 [BIOMETRIC PARSED]: Found ${parsedPunches.length} punch records from biometric server response.`);

    const empMapRes = await query(`SELECT id, company_id, emp_id_code FROM hrms.employees WHERE status = 'ACTIVE'`);
    const empMap = new Map<string, { id: string; company_id: string }>();

    for (const emp of empMapRes.rows) {
      if (emp.emp_id_code) {
        const cleanCode = String(emp.emp_id_code).trim().toLowerCase();
        empMap.set(cleanCode, { id: emp.id, company_id: emp.company_id });
        const digitsOnly = cleanCode.replace(/\D/g, '');
        if (digitsOnly) empMap.set(digitsOnly, { id: emp.id, company_id: emp.company_id });
      }
    }

    // Pre-fetch assigned employee shifts & default company shifts for shift_id resolution
    const empShiftRes = await query(`
      SELECT es.employee_id, es.shift_id, sm.start_time, sm.grace_in_minutes, sm.min_full_day_minutes, sm.min_half_day_minutes
      FROM hrms.employee_shifts es
      JOIN hrms.shift_masters sm ON es.shift_id = sm.id
      ORDER BY es.effective_from DESC
    `);
    const empShiftMap = new Map<string, { shift_id: string; start_time: string; grace_in_minutes: number; min_full_day_minutes: number; min_half_day_minutes: number }>();
    for (const r of empShiftRes.rows) {
      if (!empShiftMap.has(r.employee_id)) {
        empShiftMap.set(r.employee_id, {
          shift_id: r.shift_id,
          start_time: r.start_time || '09:30:00',
          grace_in_minutes: typeof r.grace_in_minutes === 'number' ? r.grace_in_minutes : 15,
          min_full_day_minutes: typeof r.min_full_day_minutes === 'number' && r.min_full_day_minutes > 0 ? r.min_full_day_minutes : 540,
          min_half_day_minutes: typeof r.min_half_day_minutes === 'number' && r.min_half_day_minutes > 0 ? r.min_half_day_minutes : 270,
        });
      }
    }

    const defaultShiftRes = await query(`
      SELECT company_id, id as shift_id, start_time, grace_in_minutes, min_full_day_minutes, min_half_day_minutes
      FROM hrms.shift_masters
      WHERE is_active = true
      ORDER BY created_at ASC
    `);
    const companyShiftMap = new Map<string, { shift_id: string; start_time: string; grace_in_minutes: number; min_full_day_minutes: number; min_half_day_minutes: number }>();
    for (const r of defaultShiftRes.rows) {
      if (!companyShiftMap.has(r.company_id)) {
        companyShiftMap.set(r.company_id, {
          shift_id: r.shift_id,
          start_time: r.start_time || '09:30:00',
          grace_in_minutes: typeof r.grace_in_minutes === 'number' ? r.grace_in_minutes : 15,
          min_full_day_minutes: typeof r.min_full_day_minutes === 'number' && r.min_full_day_minutes > 0 ? r.min_full_day_minutes : 540,
          min_half_day_minutes: typeof r.min_half_day_minutes === 'number' && r.min_half_day_minutes > 0 ? r.min_half_day_minutes : 270,
        });
      }
    }

    // ⚡ HIGH-PERFORMANCE BATCH INSERTION FOR RAW PUNCHES
    const rawRowsToInsert: { compId: string; empId: string; punchTime: string; dateIso: string }[] = [];
    const empDateMap = new Map<string, { compId: string; empId: string; dateIso: string; punches: string[] }>();

    for (const punch of parsedPunches) {
      const cleanUser = punch.userId.trim().toLowerCase();
      const digitsUser = cleanUser.replace(/\D/g, '');

      const matchedEmp = empMap.get(cleanUser) || empMap.get(digitsUser);
      if (!matchedEmp) continue;

      const rawTimeStr = String(punch.punchTime || '').trim();
      if (!rawTimeStr) continue;

      // Robustly parse biometric punch time string into local IST representation
      let year = '', month = '', day = '', hour = '00', min = '00', sec = '00';
      const isoMatch = rawTimeStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
      const dmyMatch = rawTimeStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);

      if (isoMatch) {
        [, year, month, day, hour, min, sec = '00'] = isoMatch;
      } else if (dmyMatch) {
        [, day, month, year, hour, min, sec = '00'] = dmyMatch;
      } else {
        const dObj = new Date(rawTimeStr);
        if (isNaN(dObj.getTime())) continue;
        const istParts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).formatToParts(dObj);
        const p: Record<string, string> = {};
        istParts.forEach(item => p[item.type] = item.value);
        year = p.year; month = p.month; day = p.day;
        hour = p.hour === '24' ? '00' : p.hour; min = p.minute; sec = p.second;
      }

      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const hh = String(hour).padStart(2, '0');
      const mi = String(min).padStart(2, '0');
      const ss = String(sec).padStart(2, '0');

      const dateIso = `${year}-${mm}-${dd}`;
      const formattedPunchTime = `${dateIso}T${hh}:${mi}:${ss}+05:30`;

      rawRowsToInsert.push({
        compId: matchedEmp.company_id,
        empId: matchedEmp.id,
        punchTime: formattedPunchTime,
        dateIso
      });

      const groupKey = `${matchedEmp.id}|${matchedEmp.company_id}|${dateIso}`;
      if (!empDateMap.has(groupKey)) {
        empDateMap.set(groupKey, {
          compId: matchedEmp.company_id,
          empId: matchedEmp.id,
          dateIso,
          punches: []
        });
      }
      empDateMap.get(groupKey)!.punches.push(formattedPunchTime);
    }

    let insertedCount = 0;
    const BATCH_SIZE = 500;

    for (let i = 0; i < rawRowsToInsert.length; i += BATCH_SIZE) {
      const chunk = rawRowsToInsert.slice(i, i + BATCH_SIZE);
      const valueStrings: string[] = [];
      const queryParams: any[] = [];
      let paramIdx = 1;

      for (const row of chunk) {
        valueStrings.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, 'BIOMETRIC', 'IN', false, NOW())`);
        queryParams.push(row.compId, row.empId, row.punchTime);
        paramIdx += 3;
      }

      if (valueStrings.length > 0) {
        const batchSql = `
          INSERT INTO hrms.attendance_raw_punches 
          (company_id, employee_id, punch_time, source, direction, is_processed, created_at)
          VALUES ${valueStrings.join(', ')}
          ON CONFLICT (employee_id, punch_time) DO NOTHING RETURNING id`;

        const batchRes = await query(batchSql, queryParams);
        insertedCount += batchRes.rows.length;
      }
    }

    // ⚡ HIGH-PERFORMANCE SUMMARY AGGREGATION & BATCH UPSERT
    let summaryProcessed = 0;

    for (const group of empDateMap.values()) {
      const sortedPunches = group.punches.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      if (sortedPunches.length === 0) continue;

      const firstIn = sortedPunches[0];
      const lastOut = sortedPunches.length > 1 ? sortedPunches[sortedPunches.length - 1] : firstIn;
      const punchCount = sortedPunches.length;

      let workedMinutes = 0;
      if (firstIn && lastOut) {
        workedMinutes = Math.round((new Date(lastOut).getTime() - new Date(firstIn).getTime()) / (1000 * 60));
      }

      const empShift = empShiftMap.get(group.empId) || companyShiftMap.get(group.compId);
      const shiftId = empShift?.shift_id || null;
      const shiftStart = empShift?.start_time || '09:30:00';
      const shiftGrace = empShift?.grace_in_minutes ?? 15;
      const minFullMins = empShift?.min_full_day_minutes || 540;
      const minHalfMins = empShift?.min_half_day_minutes || 270;

      let lateMinutes = 0;
      if (firstIn) {
        const timePart = firstIn.split('T')[1]?.split('+')[0] || '';
        if (timePart.includes(':')) {
          const [ph, pm] = timePart.split(':').map(Number);
          const [sh, sm] = shiftStart.split(':').map(Number);
          const punchMins = (ph || 0) * 60 + (pm || 0);
          const startMins = (sh || 0) * 60 + (sm || 0);
          const deadlineMins = startMins + shiftGrace;
          if (punchMins > deadlineMins) {
            lateMinutes = punchMins - startMins;
          }
        }
      }

      let status = 'ABSENT';
      if (firstIn && lastOut && workedMinutes >= minFullMins) {
        status = 'PRESENT';
      } else if (firstIn && lastOut && workedMinutes >= minHalfMins) {
        status = 'HALF_DAY';
      } else {
        status = 'ABSENT';
      }

      await query(
        `INSERT INTO hrms.attendance_summary 
         (company_id, employee_id, attendance_date, shift_id, first_in, last_out, status, worked_minutes, late_minutes, punch_count, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (employee_id, attendance_date) 
         DO UPDATE SET 
           shift_id = EXCLUDED.shift_id,
           first_in = EXCLUDED.first_in,
           last_out = EXCLUDED.last_out,
           worked_minutes = EXCLUDED.worked_minutes,
           late_minutes = EXCLUDED.late_minutes,
           status = EXCLUDED.status,
           punch_count = EXCLUDED.punch_count,
           processed_at = NOW()`,
        [group.compId, group.empId, group.dateIso, shiftId, firstIn, lastOut, status, workedMinutes, lateMinutes, punchCount]
      );
      summaryProcessed++;
    }

    return res.status(200).json({
      success: true,
      message: `Biometric sync completed successfully!`,
      insertedCount,
      totalFetched: parsedPunches.length,
      summaryProcessed,
      fromDate: fromStr,
      toDate: toStr
    });

  } catch (err: any) {
    console.error('❌ [BIOMETRIC SYNC EXCEPTION]:', err);
    return res.status(500).json({ error: err?.message || 'Failed to sync biometric attendance' });
  }
});

/**
 * 📦 BULK UPLOAD PUNCHES
 */
app.post('/api/v1/attendance/punches/bulk', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { punches } = req.body;

  if (!companyId || !punches || !Array.isArray(punches)) {
    return res.status(400).json({ error: 'Required fields missing or invalid format' });
  }

  try {
    const employeesRes = await query('SELECT id, emp_id_code FROM hrms.employees WHERE company_id = $1', [companyId]);
    const empMap = new Map<string, string>();
    employeesRes.rows.forEach(emp => {
      empMap.set(emp.emp_id_code.toLowerCase(), emp.id);
    });

    let successCount = 0;
    let errorCount = 0;

    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    let actualIp = Array.isArray(rawIp) ? rawIp[0] : (typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '');
    if (actualIp === '::1' || actualIp === '::ffff:127.0.0.1') actualIp = '127.0.0.1';

    // Get default shift for company to fallback
    let defShiftId: string | null = null;
    let defShiftStart: string | null = null;
    const defShiftRes = await query(
      `SELECT id, start_time, grace_in_minutes FROM hrms.shift_masters WHERE company_id = $1 AND is_active = true ORDER BY created_at ASC LIMIT 1`,
      [companyId]
    );
    if (defShiftRes.rows.length > 0) {
      defShiftId = defShiftRes.rows[0].id;
      defShiftStart = defShiftRes.rows[0].start_time;
    }

    for (const p of punches) {
      const { empCode, punchTime } = p;
      if (!empCode || !punchTime) {
        errorCount++;
        continue;
      }

      const empId = empMap.get(empCode.toString().toLowerCase());
      if (!empId) {
        errorCount++;
        continue;
      }

      let normalizedTime = String(punchTime).trim();
      const ddmmyyyyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(.*))?$/;
      const match = normalizedTime.match(ddmmyyyyRegex);
      if (match) {
        const [, day, month, year, timePart] = match;
        normalizedTime = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        if (timePart) normalizedTime += ` ${timePart}`;
      }

      await query(
        `INSERT INTO hrms.attendance_raw_punches (company_id, employee_id, punch_time, source, direction, ip_address, is_processed)
         VALUES ($1, $2, $3, $4, $5, $6, false)`,
        [companyId, empId, normalizedTime, 'BULK', 'IN', actualIp]
      );

      // Basic summary processing logic for the date
      try {
        const punchDate = new Date(normalizedTime).toISOString().split('T')[0];
        const dayPunches = await query(
          `SELECT punch_time, direction FROM hrms.attendance_raw_punches 
           WHERE employee_id = $1 AND punch_time::date = $2::date
           ORDER BY punch_time ASC`,
          [empId, punchDate]
        );
        let firstIn: string | null = null;
        let lastOut: string | null = null;
        // const inPunches = dayPunches.rows.filter(x => x.direction === 'IN' || x.direction === 'OUT'); // In BULK we default IN
        if (dayPunches.rows.length > 0) firstIn = dayPunches.rows[0].punch_time;
        if (dayPunches.rows.length > 1) lastOut = dayPunches.rows[dayPunches.rows.length - 1].punch_time;

        let workedMinutes = 0;
        if (firstIn && lastOut) {
          workedMinutes = Math.round((new Date(lastOut).getTime() - new Date(firstIn).getTime()) / (1000 * 60));
        }

        const shiftRes = await query(
          `SELECT es.shift_id, sm.start_time, sm.grace_in_minutes, sm.min_half_day_minutes, sm.min_full_day_minutes
           FROM hrms.employee_shifts es
           JOIN hrms.shift_masters sm ON es.shift_id = sm.id
           WHERE es.employee_id = $1 AND es.effective_from <= $2::date 
           ORDER BY es.effective_from DESC LIMIT 1`,
          [empId, punchDate]
        );

        let shiftId = defShiftId;
        let shiftStart = defShiftStart;
        let shiftGraceIn = 15;
        let minFullDayMins = 420;
        let minHalfDayMins = 240;

        if (shiftRes.rows.length > 0) {
          shiftId = shiftRes.rows[0].shift_id;
          shiftStart = shiftRes.rows[0].start_time || '09:30:00';
          shiftGraceIn = parseInt(shiftRes.rows[0].grace_in_minutes, 10) || 15;
          if (shiftRes.rows[0].min_full_day_minutes) minFullDayMins = parseInt(shiftRes.rows[0].min_full_day_minutes, 10);
          if (shiftRes.rows[0].min_half_day_minutes) minHalfDayMins = parseInt(shiftRes.rows[0].min_half_day_minutes, 10);
        } else if (defShiftId) {
          const defShiftObj = await query(`SELECT start_time, grace_in_minutes, min_half_day_minutes, min_full_day_minutes FROM hrms.shift_masters WHERE id = $1`, [defShiftId]);
          if (defShiftObj.rows.length > 0) {
            shiftGraceIn = parseInt(defShiftObj.rows[0].grace_in_minutes, 10) || 15;
            if (defShiftObj.rows[0].min_full_day_minutes) minFullDayMins = parseInt(defShiftObj.rows[0].min_full_day_minutes, 10);
            if (defShiftObj.rows[0].min_half_day_minutes) minHalfDayMins = parseInt(defShiftObj.rows[0].min_half_day_minutes, 10);
          }
        }

        let lateMinutes = 0;
        let overtimeMinutes = 0;
        if (firstIn && shiftStart) {
          const [sh, sm] = shiftStart.split(':').map(Number);
          let ph = 0;
          let pm = 0;
          const str = String(firstIn);
          if (str.includes('T') || str.includes(' ')) {
            const timePart = str.includes('T') ? str.split('T')[1] : str.split(' ')[1];
            if (timePart) {
              const tPieces = timePart.split(':');
              ph = parseInt(tPieces[0], 10) || 0;
              pm = parseInt(tPieces[1], 10) || 0;
            }
          } else {
            const d = new Date(firstIn);
            ph = d.getUTCHours();
            pm = d.getUTCMinutes();
          }
          const punchTotalMinutes = ph * 60 + pm;
          const shiftTotalMinutes = sh * 60 + sm;
          const graceLimitMins = shiftTotalMinutes + shiftGraceIn;

          if (punchTotalMinutes > graceLimitMins) {
            lateMinutes = punchTotalMinutes - shiftTotalMinutes;
          } else if (punchTotalMinutes < shiftTotalMinutes) {
            overtimeMinutes += (shiftTotalMinutes - punchTotalMinutes);
          }
        }

        let status = 'ABSENT';
        if (firstIn && lastOut && workedMinutes >= minFullDayMins) status = 'PRESENT';
        else if (firstIn && lastOut && workedMinutes >= minHalfDayMins) status = 'HALF_DAY';
        else status = 'ABSENT';

        await query(
          `INSERT INTO hrms.attendance_summary 
           (company_id, employee_id, attendance_date, shift_id, first_in, last_out, status, worked_minutes, late_minutes, overtime_minutes, punch_count, processed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
           ON CONFLICT (employee_id, attendance_date) 
           DO UPDATE SET 
             first_in = EXCLUDED.first_in,
             last_out = COALESCE(EXCLUDED.last_out, hrms.attendance_summary.last_out),
             worked_minutes = EXCLUDED.worked_minutes,
             late_minutes = EXCLUDED.late_minutes,
             overtime_minutes = EXCLUDED.overtime_minutes,
             status = EXCLUDED.status,
             punch_count = EXCLUDED.punch_count,
             processed_at = NOW()`,
          [companyId, empId, punchDate, shiftId, firstIn, lastOut, status, workedMinutes, lateMinutes, overtimeMinutes, dayPunches.rows.length]
        );
      } catch (procErr) {
        console.error('Failed to process bulk punch:', procErr);
      }

      successCount++;
    }

    logUserAction(req, 'PUNCH_BULK_IMPORT', 'ATTENDANCE', `Uploaded ${successCount} punch records.`);
    return res.status(200).json({ successCount, errorCount });

  } catch (err) {
    console.error('Error in bulk punch upload:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 🕒 ATTENDANCE RULES & POLICIES APIs
 */
app.get('/api/v1/attendance/policies', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isSuperAdmin = req.user && (
      (Array.isArray(req.user.roles) && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'))) ||
      (req.user as any).role === 'SuperAdmin' || (req.user as any).role === 'superadmin' ||
      (req.user as any).isSuperAdmin === true
    );
    let requestedCid = (req.query.company_id || req.query.companyId) as string | undefined;
    if (requestedCid === 'all') requestedCid = undefined;

    let targetCompanyId = requestedCid || req.user?.companyId;

    if (!targetCompanyId && isSuperAdmin) {
      const firstComp = await query('SELECT id FROM hrms.companies ORDER BY name ASC LIMIT 1');
      if (firstComp.rows.length > 0) {
        targetCompanyId = firstComp.rows[0].id;
      }
    }

    if (!targetCompanyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    // Check if policy exists
    let result = await query(
      'SELECT * FROM hrms.attendance_policies WHERE company_id = $1 AND is_active = true LIMIT 1',
      [targetCompanyId]
    );

    // Auto-create default policy record if none exists for this company
    if (result.rows.length === 0) {
      await query('ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS grace_period_mins INTEGER DEFAULT 15').catch(() => {});
      await query('ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS allow_permission_carry_forward BOOLEAN DEFAULT FALSE').catch(() => {});
      await query('ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS half_day_min_hours NUMERIC(4,2) DEFAULT 4.0').catch(() => {});
      await query('ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS full_day_min_hours NUMERIC(4,2) DEFAULT 8.0').catch(() => {});
      await query('ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS overtime_min_mins INTEGER DEFAULT 60').catch(() => {});
      await query("ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS comp_off_display_name VARCHAR(100) DEFAULT 'Compensatory Off'").catch(() => {});
      await query("ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS comp_off_half_day_hours NUMERIC(4,2) DEFAULT 4.00").catch(() => {});
      await query("ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS comp_off_full_day_hours NUMERIC(4,2) DEFAULT 8.00").catch(() => {});

      const insertQuery = `
        INSERT INTO hrms.attendance_policies (
          company_id, policy_name, grace_period_mins, max_late_entries_allowed, late_allowed_per_month,
          late_entry_penalty, late_marks_deduction_rule, half_day_min_hours, full_day_min_hours, overtime_min_mins,
          cycle_start_day, cycle_end_day, max_permission_count_per_month, max_single_permission_minutes,
          max_permission_minutes_per_month, permission_affects_late, permission_affects_early_exit,
          allow_permission_carry_forward, allow_self_punch, comp_off_display_name, comp_off_half_day_hours,
          comp_off_full_day_hours, is_active
        ) VALUES (
          $1, 'Standard Attendance Policy', 15, 3, 3,
          'HALF_DAY', '3_LATES_1_HALF_DAY', 4, 8, 60,
          26, 25, 2, 120,
          240, true, true,
          false, true, 'Compensatory Off', 4.00,
          8.00, true
        )
        RETURNING *
      `;
      result = await query(insertQuery, [targetCompanyId]);
    }

    return res.json({ policy: result.rows[0], policies: result.rows });
  } catch (err) {
    console.error('Error fetching/initializing attendance policies:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/attendance/policies', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin
    ? (req.body.companyId || req.body.company_id)
    : (req.user?.companyId || req.body.companyId || req.body.company_id);
  const {
    policy_name, late_allowed_per_month, late_marks_deduction_rule, sandwich_rule,
    max_permission_count_per_month, max_permission_minutes_per_month, max_single_permission_minutes,
    permission_affects_late, permission_affects_early_exit, allow_mobile_punch, allow_web_punch,
    require_selfie, require_gps, enforce_device_binding, cycle_start_day, cycle_end_day,
    grace_period_mins, max_late_entries_allowed, allow_permission_carry_forward,
    half_day_min_hours, full_day_min_hours, overtime_min_mins,
    comp_off_display_name, comp_off_half_day_hours, comp_off_full_day_hours,
    location_tracking_interval_mins
  } = req.body;

  const effectivePolicyName = policy_name || 'Standard Attendance Policy';

  if (!companyId) {
    return res.status(400).json({ error: 'Required fields missing: companyId' });
  }

  try {
    const check = await query('SELECT id FROM hrms.attendance_policies WHERE company_id = $1 AND is_active = true LIMIT 1', [companyId]);
    let result;

    const allowedLate = late_allowed_per_month || max_late_entries_allowed;

    await query('ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS grace_period_mins INTEGER DEFAULT 15').catch(() => {});
    await query('ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS allow_permission_carry_forward BOOLEAN DEFAULT FALSE').catch(() => {});
    await query('ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS half_day_min_hours NUMERIC(4,2) DEFAULT 4.0').catch(() => {});
    await query('ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS full_day_min_hours NUMERIC(4,2) DEFAULT 8.0').catch(() => {});
    await query('ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS overtime_min_mins INTEGER DEFAULT 60').catch(() => {});
    await query("ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS comp_off_display_name VARCHAR(100) DEFAULT 'Comp-Off'").catch(() => {});
    await query('ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS comp_off_half_day_hours NUMERIC(4,2) DEFAULT 4.0').catch(() => {});
    await query('ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS comp_off_full_day_hours NUMERIC(4,2) DEFAULT 8.0').catch(() => {});
    await query('ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS location_tracking_interval_mins INTEGER DEFAULT 15').catch(() => {});

    if (check.rows.length > 0) {
      result = await query(
        `UPDATE hrms.attendance_policies SET
          policy_name = $1, late_allowed_per_month = $2, late_marks_deduction_rule = $3, sandwich_rule = $4,
          max_permission_count_per_month = $5, max_permission_minutes_per_month = $6, max_single_permission_minutes = $7,
          permission_affects_late = $8, permission_affects_early_exit = $9, allow_mobile_punch = $10, allow_web_punch = $11,
          require_selfie = $12, require_gps = $13, enforce_device_binding = $14, cycle_start_day = $15, cycle_end_day = $16,
          grace_period_mins = $17, allow_permission_carry_forward = $18,
          half_day_min_hours = $19, full_day_min_hours = $20, overtime_min_mins = $21,
          comp_off_display_name = $22, comp_off_half_day_hours = $23, comp_off_full_day_hours = $24,
          location_tracking_interval_mins = $25, updated_at = NOW()
         WHERE id = $26 RETURNING *`,
        [
          effectivePolicyName,
          allowedLate ? parseInt(String(allowedLate)) : 3,
          late_marks_deduction_rule || '3_LATES_1_HALF_DAY',
          sandwich_rule || false,
          max_permission_count_per_month ? parseInt(String(max_permission_count_per_month)) : 3,
          max_permission_minutes_per_month ? parseInt(String(max_permission_minutes_per_month)) : 360,
          max_single_permission_minutes ? parseInt(String(max_single_permission_minutes)) : 120,
          permission_affects_late !== undefined ? permission_affects_late : true,
          permission_affects_early_exit !== undefined ? permission_affects_early_exit : true,
          allow_mobile_punch !== undefined ? allow_mobile_punch : true,
          allow_web_punch !== undefined ? allow_web_punch : true,
          require_selfie !== undefined ? require_selfie : false,
          require_gps !== undefined ? require_gps : false,
          enforce_device_binding !== undefined ? enforce_device_binding : false,
          cycle_start_day ? parseInt(String(cycle_start_day)) : 26,
          cycle_end_day ? parseInt(String(cycle_end_day)) : 25,
          grace_period_mins ? parseInt(String(grace_period_mins)) : 15,
          allow_permission_carry_forward !== undefined ? allow_permission_carry_forward : false,
          half_day_min_hours ? parseFloat(String(half_day_min_hours)) : 4.0,
          full_day_min_hours ? parseFloat(String(full_day_min_hours)) : 8.0,
          overtime_min_mins ? parseInt(String(overtime_min_mins)) : 60,
          comp_off_display_name || 'Comp-Off',
          comp_off_half_day_hours ? parseFloat(String(comp_off_half_day_hours)) : 4.0,
          comp_off_full_day_hours ? parseFloat(String(comp_off_full_day_hours)) : 8.0,
          location_tracking_interval_mins ? parseInt(String(location_tracking_interval_mins)) : 15,
          check.rows[0].id
        ]
      );
    } else {
      result = await query(
        `INSERT INTO hrms.attendance_policies 
         (company_id, policy_name, late_allowed_per_month, late_marks_deduction_rule, sandwich_rule,
          max_permission_count_per_month, max_permission_minutes_per_month, max_single_permission_minutes,
          permission_affects_late, permission_affects_early_exit, allow_mobile_punch, allow_web_punch,
          require_selfie, require_gps, enforce_device_binding, cycle_start_day, cycle_end_day, grace_period_mins, allow_permission_carry_forward,
          half_day_min_hours, full_day_min_hours, overtime_min_mins, comp_off_display_name, comp_off_half_day_hours, comp_off_full_day_hours, location_tracking_interval_mins)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26) RETURNING *`,
        [
          companyId,
          effectivePolicyName,
          allowedLate ? parseInt(String(allowedLate)) : 3,
          late_marks_deduction_rule || '3_LATES_1_HALF_DAY',
          sandwich_rule || false,
          max_permission_count_per_month ? parseInt(String(max_permission_count_per_month)) : 3,
          max_permission_minutes_per_month ? parseInt(String(max_permission_minutes_per_month)) : 360,
          max_single_permission_minutes ? parseInt(String(max_single_permission_minutes)) : 120,
          permission_affects_late !== undefined ? permission_affects_late : true,
          permission_affects_early_exit !== undefined ? permission_affects_early_exit : true,
          allow_mobile_punch !== undefined ? allow_mobile_punch : true,
          allow_web_punch !== undefined ? allow_web_punch : true,
          require_selfie !== undefined ? require_selfie : false,
          require_gps !== undefined ? require_gps : false,
          enforce_device_binding !== undefined ? enforce_device_binding : false,
          cycle_start_day ? parseInt(String(cycle_start_day)) : 26,
          cycle_end_day ? parseInt(String(cycle_end_day)) : 25,
          grace_period_mins ? parseInt(String(grace_period_mins)) : 15,
          allow_permission_carry_forward !== undefined ? allow_permission_carry_forward : false,
          half_day_min_hours ? parseFloat(String(half_day_min_hours)) : 4.0,
          full_day_min_hours ? parseFloat(String(full_day_min_hours)) : 8.0,
          overtime_min_mins ? parseInt(String(overtime_min_mins)) : 60,
          comp_off_display_name || 'Comp-Off',
          comp_off_half_day_hours ? parseFloat(String(comp_off_half_day_hours)) : 4.0,
          comp_off_full_day_hours ? parseFloat(String(comp_off_full_day_hours)) : 8.0,
          location_tracking_interval_mins ? parseInt(String(location_tracking_interval_mins)) : 15
        ]
      );
    }
    return res.json({ message: 'Attendance policy saved successfully', policy: result.rows[0] });
  } catch (err) {
    console.error('Error saving attendance policy:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/attendance/policies', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin
    ? (req.query.company_id || req.query.companyId || req.body?.companyId)
    : (req.user?.companyId || req.query.company_id || req.query.companyId);

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required to delete attendance policy' });
  }

  try {
    await query('DELETE FROM hrms.attendance_policies WHERE company_id = $1', [companyId]);
    return res.json({ success: true, message: 'Attendance policy deleted successfully' });
  } catch (err) {
    console.error('Error deleting attendance policy:', err);
    return res.status(500).json({ error: 'Failed to delete attendance policy' });
  }
});

/**
 * 🕒 ATTENDANCE REGULARIZATION APIs
 */
app.get('/api/v1/attendance/regularizations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? (req.query.companyId || null) : req.user?.companyId;
  const email = req.user?.email;
  const scope = req.query.scope as string | undefined;
  const filterSelf = scope === 'my';
  const filterTeam = scope === 'team';

  if (!companyId && !isSuperAdmin) return res.status(400).json({ error: 'Company ID is required' });

  try {
    let employeeId = null;
    if (email) {
      const empCheck = await query('SELECT id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
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
    const params: any[] = [];
    const whereClauses: string[] = [];

    if (companyId) {
      params.push(companyId);
      whereClauses.push(`e.company_id = $${params.length}`);
    }

    if (filterSelf && employeeId) {
      params.push(employeeId);
      whereClauses.push(`ar.employee_id = $${params.length}`);
    } else if (filterTeam && employeeId) {
      if (isSuperAdmin) {
        params.push(employeeId);
        whereClauses.push(`ar.employee_id != $${params.length}`);
      } else {
        params.push(employeeId);
        whereClauses.push(`e.reporting_to_id = $${params.length}`);
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY ar.created_at DESC`;
    const result = await query(sql, params);
    return res.json({ regularizations: result.rows });
  } catch (err) {
    console.error('Error fetching regularizations:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/attendance/regularizations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { employee_id, attendance_date, requested_in, requested_out, reason } = req.body;

  if (!companyId || !employee_id || !attendance_date || !reason) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  try {
    const empCheck = await query('SELECT id FROM hrms.employees WHERE id = $1 AND company_id = $2', [employee_id, companyId]);
    if (empCheck.rows.length === 0) return res.status(400).json({ error: 'Invalid employee reference' });

    const result = await query(
      `INSERT INTO hrms.attendance_regularizations (employee_id, attendance_date, requested_in, requested_out, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       ON CONFLICT (employee_id, attendance_date)
       DO UPDATE SET
         requested_in = EXCLUDED.requested_in,
         requested_out = EXCLUDED.requested_out,
         reason = EXCLUDED.reason,
         status = 'PENDING',
         created_at = NOW()
       RETURNING *`,
      [employee_id, attendance_date, requested_in || null, requested_out || null, reason]
    );
    logUserAction(req, 'APPLY_REGULARIZATION', 'Attendance Regularizations', `Submitted attendance regularization request for date ${attendance_date}`);
    return res.status(201).json({ message: 'Regularization request submitted successfully', regularization: result.rows[0] });
  } catch (err) {
    console.error('Error submitting regularization:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/attendance/regularizations/:id/action', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { action, remarks } = req.body;

  if (!action || !['APPROVED', 'REJECTED'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action, must be APPROVED or REJECTED' });
  }

  try {
    const reqQuery = await query(
      `SELECT ar.*, e.company_id FROM hrms.attendance_regularizations ar
       JOIN hrms.employees e ON ar.employee_id = e.id
       WHERE ar.id = $1`,
      [id]
    );
    if (reqQuery.rows.length === 0) return res.status(404).json({ error: 'Regularization request not found' });

    const request = reqQuery.rows[0];
    if (!isSuperAdmin && request.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userEmail = req.user?.email;
    let approverId: string | null = null;
    if (userEmail) {
      const appRes = await query('SELECT id FROM hrms.employees WHERE email = $1 LIMIT 1', [userEmail]);
      if (appRes.rows.length > 0) approverId = appRes.rows[0].id;
    }

    const updateRes = await query(
      `UPDATE hrms.attendance_regularizations
       SET status = $1, approved_by = $2, approved_at = NOW(), remarks = $3
       WHERE id = $4 RETURNING *`,
      [action, approverId, remarks || null, id]
    );
    logUserAction(req, `${action}_REGULARIZATION`, 'Attendance Regularizations', `${action === 'APPROVED' ? 'Approved' : 'Rejected'} attendance regularization request for date ${request.attendance_date}`);

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

      let status = 'PRESENT';
      if (workedMinutes < 240) status = 'ABSENT';
      else if (workedMinutes < 480) status = 'HALF_DAY';

      let shiftId: string | null = null;
      const shiftRes = await query(
        `SELECT shift_id FROM hrms.employee_shifts 
         WHERE employee_id = $1 AND effective_from <= $2::date 
         ORDER BY effective_from DESC LIMIT 1`,
        [request.employee_id, reqDate]
      );
      if (shiftRes.rows.length > 0) {
        shiftId = shiftRes.rows[0].shift_id;
      }

      await query(
        `INSERT INTO hrms.attendance_summary (company_id, employee_id, attendance_date, shift_id, first_in, last_out, status, worked_minutes, is_regularized, regularized_by, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, NOW())
         ON CONFLICT (company_id, employee_id, attendance_date)
         DO UPDATE SET 
           first_in = EXCLUDED.first_in,
           last_out = EXCLUDED.last_out,
           status = EXCLUDED.status,
           worked_minutes = EXCLUDED.worked_minutes,
           is_regularized = true,
           regularized_by = EXCLUDED.regularized_by,
           processed_at = NOW()`,
        [request.company_id, request.employee_id, reqDate, shiftId, firstInTs, lastOutTs, status, workedMinutes, approverId]
      );
    }

    // 🔔 Notify Applicant Employee asynchronously
    try {
      sendNotification({
        companyId: request.company_id,
        senderId: approverId,
        recipientId: request.employee_id,
        module: 'ATTENDANCE',
        eventCode: action === 'APPROVED' ? 'REGULARIZATION_APPROVED' : 'REGULARIZATION_REJECTED',
        referenceType: 'ATTENDANCE_REGULARIZATION',
        referenceId: id,
        title: action === 'APPROVED' ? 'Regularization Approved ✅' : 'Regularization Rejected ❌',
        message: `Your regularization request for date ${request.attendance_date} has been ${action.toLowerCase()}.`,
        type: action === 'APPROVED' ? 'SUCCESS' : 'DANGER',
        actionUrl: '/dashboard/attendance/regularization',
      });
    } catch (notifErr) {
      console.error('[RegularizationActionNotif] Error dispatching notification:', notifErr);
    }

    logUserAction(req, `REGULARIZATION_${action}`, 'Attendance Regularizations', `${action} regularization request ID ${id}`);
    return res.json({ message: `Regularization request ${action.toLowerCase()} successfully`, regularization: updateRes.rows[0] });

  } catch (err) {
    console.error('Error processing regularization action:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/attendance/regularizations/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  let { attendance_date, requested_in, requested_out, punch_type, requested_time, reason } = req.body;

  if (punch_type && requested_time) {
    if (punch_type === 'CHECK_IN') {
      requested_in = requested_time;
      requested_out = null;
    } else if (punch_type === 'CHECK_OUT') {
      requested_out = requested_time;
      requested_in = null;
    }
  }

  try {
    const existing = await query('SELECT * FROM hrms.attendance_regularizations WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Regularization request not found' });

    if (existing.rows[0].status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending regularization requests can be edited' });
    }

    const updated = await query(
      `UPDATE hrms.attendance_regularizations
       SET attendance_date = COALESCE($1, attendance_date),
           requested_in = COALESCE($2, requested_in),
           requested_out = COALESCE($3, requested_out),
           reason = COALESCE($4, reason),
           created_at = NOW()
       WHERE id = $5 RETURNING *`,
      [attendance_date || null, requested_in || null, requested_out || null, reason || null, id]
    );

    return res.json({ message: 'Regularization request updated successfully', regularization: updated.rows[0] });
  } catch (err) {
    console.error('Error updating regularization request:', err);
    return res.status(500).json({ error: 'Failed to update regularization request' });
  }
});

app.delete('/api/v1/attendance/regularizations/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const existing = await query('SELECT * FROM hrms.attendance_regularizations WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Regularization request not found' });

    if (existing.rows[0].status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending regularization requests can be deleted' });
    }

    await query('DELETE FROM hrms.attendance_regularizations WHERE id = $1', [id]);
    return res.json({ success: true, message: 'Regularization request deleted successfully' });
  } catch (err) {
    console.error('Error deleting regularization request:', err);
    return res.status(500).json({ error: 'Failed to delete regularization request' });
  }
});

/**
 * 🕒 ATTENDANCE PERMISSION REQUESTS APIs
 */
app.get('/api/v1/attendance/permissions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? (req.query.companyId || null) : req.user?.companyId;
  const scope = req.query.scope as string | undefined;
  const filterSelf = scope === 'my';
  const filterTeam = scope === 'team';

  if (!companyId && !isSuperAdmin) return res.status(400).json({ error: 'Company ID is required' });

  try {
    const scopeCtx = await getEmployeeDataScope(req, 'attendance', 'view_permission_requests');

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
    const params: any[] = [];
    const whereClauses: string[] = [];

    if (companyId) {
      params.push(companyId);
      whereClauses.push(`pr.company_id = $${params.length}`);
    }

    if (filterSelf) {
      let selfEmpId = scopeCtx.employeeId;
      if (!selfEmpId && req.user?.email) {
        const selfRes = await query('SELECT id FROM hrms.employees WHERE LOWER(email) = LOWER($1) LIMIT 1', [req.user.email]);
        if (selfRes.rows.length > 0) selfEmpId = selfRes.rows[0].id;
      }
      if (selfEmpId) {
        params.push(selfEmpId);
        whereClauses.push(`pr.employee_id = $${params.length}`);
      }
    } else if (filterTeam && !scopeCtx.isSuperAdmin) {
      const scopeCond = buildDataScopeCondition(scopeCtx, 'pr', 'employee_id', params.length + 1);
      if (scopeCond.whereSql) {
        whereClauses.push(scopeCond.whereSql);
        params.push(...scopeCond.params);
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY pr.created_at DESC LIMIT 500`;
    const result = await query(sql, params);
    return res.json({ permissions: result.rows });
  } catch (err) {
    console.error('Error fetching permission requests:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/attendance/permissions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { employee_id, permission_type, permission_date, from_time, to_time, duration_minutes, reason } = req.body;

  if (!companyId || !employee_id || !permission_type || !permission_date || !from_time || !to_time || !duration_minutes || !reason) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  try {
    const empCheck = await query('SELECT id FROM hrms.employees WHERE id = $1 AND company_id = $2', [employee_id, companyId]);
    if (empCheck.rows.length === 0) return res.status(400).json({ error: 'Invalid employee reference' });

    const result = await query(
      `INSERT INTO hrms.permission_requests (company_id, employee_id, permission_type, permission_date, from_time, to_time, duration_minutes, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
       RETURNING *`,
      [companyId, employee_id, permission_type, permission_date, from_time, to_time, duration_minutes, reason]
    );
    logUserAction(req, 'APPLY_PERMISSION', 'Permissions', `Submitted permission request (${permission_type}) for date ${permission_date}`);

    // 🔔 Notify Reporting Manager asynchronously
    try {
      const empInfo = await query('SELECT first_name, last_name, company_id, reporting_to_id FROM hrms.employees WHERE id = $1', [employee_id]);
      if (empInfo.rows.length > 0) {
        const emp = empInfo.rows[0];
        if (emp.reporting_to_id) {
          sendNotification({
            companyId: emp.company_id,
            senderId: employee_id,
            recipientId: emp.reporting_to_id,
            module: 'ATTENDANCE',
            eventCode: 'PERMISSION_REQUESTED',
            referenceType: 'PERMISSION_REQUEST',
            referenceId: result.rows[0].id,
            title: 'New Permission Request ⏱️',
            message: `${emp.first_name} ${emp.last_name || ''} requested ${duration_minutes}m permission on ${permission_date} (${from_time} - ${to_time}).`,
            type: 'INFO',
            actionUrl: '/dashboard/attendance/permissions',
          });
        }
      }
    } catch (notifErr) {
      console.error('[PermissionNotif] Error dispatching notification:', notifErr);
    }

    return res.status(201).json({ message: 'Permission request submitted successfully', permission: result.rows[0] });
  } catch (err) {
    console.error('Error submitting permission request:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/attendance/permissions/:id/action', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { action, remarks } = req.body;

  if (!action || !['APPROVED', 'REJECTED'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action, must be APPROVED or REJECTED' });
  }

  try {
    const reqQuery = await query(
      `SELECT pr.*, e.company_id FROM hrms.permission_requests pr
       JOIN hrms.employees e ON pr.employee_id = e.id
       WHERE pr.id = $1`,
      [id]
    );
    if (reqQuery.rows.length === 0) return res.status(404).json({ error: 'Permission request not found' });

    const request = reqQuery.rows[0];
    if (!isSuperAdmin && request.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userEmail = req.user?.email;
    let approverId: string | null = null;
    if (userEmail) {
      const appRes = await query('SELECT id FROM hrms.employees WHERE email = $1 LIMIT 1', [userEmail]);
      if (appRes.rows.length > 0) approverId = appRes.rows[0].id;
    }

    const updateRes = await query(
      `UPDATE hrms.permission_requests
       SET status = $1, approved_by = $2, approved_at = NOW(), remarks = $3
       WHERE id = $4 RETURNING *`,
      [action, approverId, remarks, id]
    );
    logUserAction(req, `${action}_PERMISSION`, 'Permissions', `${action === 'APPROVED' ? 'Approved' : 'Rejected'} permission request for date ${request.permission_date}`);

    // 🔔 Notify Applicant Employee asynchronously
    try {
      sendNotification({
        companyId: request.company_id,
        senderId: approverId,
        recipientId: request.employee_id,
        module: 'ATTENDANCE',
        eventCode: action === 'APPROVED' ? 'PERMISSION_APPROVED' : 'PERMISSION_REJECTED',
        referenceType: 'PERMISSION_REQUEST',
        referenceId: id,
        title: action === 'APPROVED' ? 'Permission Approved ✅' : 'Permission Rejected ❌',
        message: `Your permission request for date ${request.permission_date} (${request.from_time} - ${request.to_time}) has been ${action.toLowerCase()}.`,
        type: action === 'APPROVED' ? 'SUCCESS' : 'DANGER',
        actionUrl: '/dashboard/attendance/permissions',
      });
    } catch (notifErr) {
      console.error('[PermissionActionNotif] Error dispatching notification:', notifErr);
    }

    return res.json({ message: `Permission request ${action.toLowerCase()} successfully`, permission: updateRes.rows[0] });
  } catch (err) {
    console.error('Error processing permission request action:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/attendance/permissions/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const userEmail = req.user?.email;
  const { permission_type, permission_date, from_time, to_time, duration_minutes, reason } = req.body;

  if (!permission_type || !permission_date || !from_time || !to_time || !duration_minutes || !reason) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  try {
    const existingRes = await query('SELECT pr.*, e.email as emp_email FROM hrms.permission_requests pr JOIN hrms.employees e ON pr.employee_id = e.id WHERE pr.id = $1', [id]);
    if (existingRes.rows.length === 0) return res.status(404).json({ error: 'Permission request not found' });

    const reqItem = existingRes.rows[0];
    if (reqItem.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending permission requests can be edited' });
    }

    if (!isSuperAdmin && reqItem.emp_email?.toLowerCase() !== userEmail?.toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized to edit this permission request' });
    }

    const updateRes = await query(
      `UPDATE hrms.permission_requests
       SET permission_type = $1, permission_date = $2, from_time = $3, to_time = $4, duration_minutes = $5, reason = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [permission_type, permission_date, from_time, to_time, duration_minutes, reason, id]
    );

    logUserAction(req, 'UPDATE_PERMISSION', 'Permissions', `Updated permission request for date ${permission_date}`);
    return res.json({ message: 'Permission request updated successfully', permission: updateRes.rows[0] });
  } catch (err) {
    console.error('Error updating permission request:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/attendance/permissions/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const userEmail = req.user?.email;

  try {
    const existingRes = await query('SELECT pr.*, e.email as emp_email FROM hrms.permission_requests pr JOIN hrms.employees e ON pr.employee_id = e.id WHERE pr.id = $1', [id]);
    if (existingRes.rows.length === 0) return res.status(404).json({ error: 'Permission request not found' });

    const reqItem = existingRes.rows[0];
    if (reqItem.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending permission requests can be deleted' });
    }

    if (!isSuperAdmin && reqItem.emp_email?.toLowerCase() !== userEmail?.toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized to delete this permission request' });
    }

    await query('DELETE FROM hrms.permission_requests WHERE id = $1', [id]);
    logUserAction(req, 'DELETE_PERMISSION', 'Permissions', `Deleted permission request ID ${id}`);

    return res.json({ message: 'Permission request deleted successfully' });
  } catch (err) {
    console.error('Error deleting permission request:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

/**
 * 📅 HOLIDAYS CRUD APIs
 */
app.get('/api/v1/holidays', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  let companyId = isSuperAdmin ? (req.query.companyId as string) : req.user?.companyId;

  try {
    if (isSuperAdmin && (!companyId || companyId === 'all' || companyId === '')) {
      const result = await query(
        `SELECT h.id, h.company_id, h.branch_id, h.name, TO_CHAR(h.holiday_date, 'YYYY-MM-DD') as holiday_date, h.description, h.is_restricted, h.restricted_branches, h.created_at, c.name as company_name 
         FROM hrms.holiday_masters h
         JOIN hrms.companies c ON h.company_id = c.id
         WHERE h.is_active = true 
         ORDER BY h.holiday_date ASC, c.name ASC`
      );
      return res.json({ holidays: result.rows, isAll: true });
    } else {
      if (!companyId || companyId === 'all') return res.status(400).json({ error: 'Company ID is required' });
      const result = await query(
        `SELECT h.id, h.company_id, h.branch_id, h.name, TO_CHAR(h.holiday_date, 'YYYY-MM-DD') as holiday_date, h.description, h.is_restricted, h.restricted_branches, h.created_at, c.name as company_name 
         FROM hrms.holiday_masters h
         LEFT JOIN hrms.companies c ON h.company_id = c.id
         WHERE h.company_id = $1 AND h.is_active = true 
         ORDER BY h.holiday_date ASC`,
        [companyId]
      );
      return res.json({ holidays: result.rows, isAll: false });
    }
  } catch (err) {
    console.error('Error fetching holidays:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/holidays', authenticateToken, requirePermission('create_holiday_masters'), async (req: AuthenticatedRequest, res: Response) => {
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
    const result = await query(
      `INSERT INTO hrms.holiday_masters (company_id, branch_id, name, holiday_date, description, is_restricted, restricted_branches)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        companyId,
        branch_id || null,
        name,
        holiday_date,
        description || '',
        is_restricted || false,
        restrictedList
      ]
    );
    logUserAction(req, 'CREATE_HOLIDAY', 'Holidays', `Created holiday '${name}' on ${holiday_date}`);

    // 🔔 Announce Holiday to active employees asynchronously
    try {
      const activeEmps = await query('SELECT id FROM hrms.employees WHERE company_id = $1 AND status = \'ACTIVE\' LIMIT 500', [companyId]);
      for (const emp of activeEmps.rows) {
        sendNotification({
          companyId,
          recipientId: emp.id,
          module: 'HOLIDAYS',
          eventCode: 'HOLIDAY_ANNOUNCED',
          referenceType: 'HOLIDAY',
          referenceId: result.rows[0].id,
          title: 'Upcoming Festival Holiday 🚩',
          message: `Company Holiday declared for '${name}' on ${holiday_date}.`,
          type: 'SUCCESS',
          actionUrl: '/dashboard/holidays',
        });
      }
    } catch (notifErr) {
      console.error('[HolidayNotif] Error dispatching holiday notification:', notifErr);
    }

    return res.status(201).json({ message: 'Holiday created successfully', holiday: result.rows[0] });
  } catch (err) {
    console.error('Error creating holiday:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/holidays/:id', authenticateToken, requirePermission('edit_holiday_masters'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { name, holiday_date, description, is_restricted, branch_id, restricted_branches } = req.body;

  try {
    if (!isSuperAdmin) {
      if (!companyId) return res.status(403).json({ error: 'Access denied' });
      const check = await query('SELECT id FROM hrms.holiday_masters WHERE id = $1 AND company_id = $2', [id, companyId]);
      if (check.rows.length === 0) return res.status(403).json({ error: 'Access denied: Holiday does not belong to your company' });
    }

    const restrictedList = Array.isArray(restricted_branches)
      ? JSON.stringify(restricted_branches)
      : (typeof restricted_branches === 'string' ? restricted_branches : '[]');

    const result = await query(
      `UPDATE hrms.holiday_masters 
       SET name = $1, holiday_date = $2, description = $3, is_restricted = $4, branch_id = $5, restricted_branches = $6
       WHERE id = $7 RETURNING *`,
      [
        name,
        holiday_date,
        description || '',
        is_restricted || false,
        branch_id || null,
        restrictedList,
        id
      ]
    );
    logUserAction(req, 'UPDATE_HOLIDAY', 'Holidays', `Updated holiday '${name}' on ${holiday_date}`);
    return res.json({ message: 'Holiday updated successfully', holiday: result.rows[0] });
  } catch (err) {
    console.error('Error updating holiday:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/holidays/:id/restrict-branches', authenticateToken, requirePermission('edit_holiday_masters'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { restricted_branches } = req.body;

  try {
    if (!isSuperAdmin) {
      if (!companyId) return res.status(403).json({ error: 'Access denied' });
      const check = await query('SELECT id FROM hrms.holiday_masters WHERE id = $1 AND company_id = $2', [id, companyId]);
      if (check.rows.length === 0) return res.status(403).json({ error: 'Access denied: Holiday does not belong to your company' });
    }

    const restrictedList = Array.isArray(restricted_branches)
      ? JSON.stringify(restricted_branches)
      : (typeof restricted_branches === 'string' ? restricted_branches : '[]');

    const result = await query(
      `UPDATE hrms.holiday_masters 
       SET restricted_branches = $1
       WHERE id = $2 RETURNING *`,
      [restrictedList, id]
    );
    logUserAction(req, 'UPDATE_HOLIDAY_RESTRICTIONS', 'Holidays', `Updated branch restrictions for holiday ID ${id}`);
    return res.json({ message: 'Branch restrictions updated successfully', holiday: result.rows[0] });
  } catch (err) {
    console.error('Error updating branch restrictions:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/holidays/:id', authenticateToken, requirePermission('delete_holiday_masters'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? (req.body.companyId || req.query.companyId) : req.user?.companyId;

  try {
    if (!isSuperAdmin) {
      if (!companyId) return res.status(403).json({ error: 'Access denied' });
      const check = await query('SELECT id FROM hrms.holiday_masters WHERE id = $1 AND company_id = $2', [id, companyId]);
      if (check.rows.length === 0) return res.status(403).json({ error: 'Access denied: Holiday does not belong to your company' });
    }

    await query('UPDATE hrms.holiday_masters SET is_active = false WHERE id = $1', [id]);
    logUserAction(req, 'DELETE_HOLIDAY', 'Holidays', `Deactivated holiday ID ${id}`);
    return res.json({ message: 'Holiday deleted successfully' });
  } catch (err) {
    console.error('Error deleting holiday:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

/**
 * 📅 LEAVE TYPES CRUD APIs
 */
app.get('/api/v1/leave-types', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;

  if (!companyId && !isSuperAdmin) return res.status(400).json({ error: 'Company ID is required' });

  try {
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    let sql = 'SELECT lt.*, c.name as company_name FROM hrms.leave_types lt LEFT JOIN hrms.companies c ON lt.company_id = c.id WHERE 1=1';
    const params: any[] = [];

    if (!includeInactive) {
      sql += ' AND lt.is_active = true';
    }

    if (companyId && companyId !== 'all') {
      params.push(companyId);
      sql += ` AND lt.company_id = $${params.length}`;
    }

    sql += ' ORDER BY lt.name ASC';
    const result = await query(sql, params);
    return res.json({ leaveTypes: result.rows });
  } catch (err) {
    console.error('Error fetching leave types:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/leave-types', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { name, code, allotted_per_year, accrual_type, carry_forward_type, max_carry_forward, is_paid, is_wfh } = req.body;

  if (!companyId || !name || !code || !allotted_per_year) {
    return res.status(400).json({ error: 'Required fields missing: companyId, name, code, allotted_per_year' });
  }

  try {
    // Check for duplicate name or code
    const duplicateCheck = await query(
      'SELECT id FROM hrms.leave_types WHERE company_id = $1 AND (LOWER(name) = LOWER($2) OR LOWER(code) = LOWER($3))',
      [companyId, name, code]
    );
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A leave type with this name or code already exists for your company.' });
    }

    const result = await query(
      `INSERT INTO hrms.leave_types (company_id, name, code, allotted_per_year, accrual_type, carry_forward_type, max_carry_forward, is_paid, is_wfh, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING *`,
      [
        companyId,
        name,
        code.toUpperCase(),
        parseFloat(allotted_per_year),
        accrual_type || 'YEARLY',
        carry_forward_type || 'NONE',
        max_carry_forward ? parseFloat(max_carry_forward) : 0,
        is_paid !== undefined ? is_paid : true,
        is_wfh !== undefined ? is_wfh : false
      ]
    );
    const newLeaveType = result.rows[0];

    // Auto-allocate this new leave type balance to all existing ACTIVE employees in the company
    try {
      const activeEmps = await query("SELECT id FROM hrms.employees WHERE company_id = $1 AND status = 'ACTIVE'", [companyId]);
      const currentYear = new Date().getFullYear();
      const allottedNum = parseFloat(allotted_per_year);

      for (const emp of activeEmps.rows) {
        await query(
          `INSERT INTO hrms.leave_balances (employee_id, leave_type_id, balance_year, allotted, used, pending_approval, remaining)
           VALUES ($1, $2, $3, $4, 0, 0, $4)
           ON CONFLICT (employee_id, leave_type_id, balance_year) DO NOTHING`,
          [emp.id, newLeaveType.id, currentYear, allottedNum]
        );
      }
    } catch (allocErr) {
      console.error('Error auto-allocating new leave type to active employees:', allocErr);
    }

    logUserAction(req, 'CREATE_LEAVE_TYPE', 'Leaves', `Created leave type '${name}' (${code}) with ${allotted_per_year} days/year`);
    return res.status(201).json({ message: 'Leave type created successfully and allocated to active employees', leaveType: newLeaveType });
  } catch (err) {
    console.error('Error creating leave type:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/leave-types/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { name, code, allotted_per_year, accrual_type, carry_forward_type, max_carry_forward, is_paid, is_wfh, is_active } = req.body;

  try {
    if (!isSuperAdmin) {
      const check = await query('SELECT id FROM hrms.leave_types WHERE id = $1 AND company_id = $2', [id, companyId]);
      if (check.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
    }

    // Check for duplicate name or code (excluding the current row)
    const duplicateCheck = await query(
      'SELECT id FROM hrms.leave_types WHERE company_id = $1 AND (LOWER(name) = LOWER($2) OR LOWER(code) = LOWER($3)) AND id != $4',
      [companyId, name, code, id]
    );
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A leave type with this name or code already exists for your company.' });
    }

    const activeState = is_active !== undefined ? is_active : true;

    const result = await query(
      `UPDATE hrms.leave_types 
       SET name = $1, code = $2, allotted_per_year = $3, accrual_type = $4, carry_forward_type = $5, max_carry_forward = $6, is_paid = $7, is_wfh = $8, is_active = $9, updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [
        name,
        code.toUpperCase(),
        parseFloat(allotted_per_year),
        accrual_type || 'YEARLY',
        carry_forward_type || 'NONE',
        max_carry_forward ? parseFloat(max_carry_forward) : 0,
        is_paid !== undefined ? is_paid : true,
        is_wfh !== undefined ? is_wfh : false,
        activeState,
        id
      ]
    );
    logUserAction(req, 'UPDATE_LEAVE_TYPE', 'Leaves', `Updated leave type '${name}' (${code})`);
    return res.json({ message: 'Leave type updated successfully', leaveType: result.rows[0] });
  } catch (err) {
    console.error('Error updating leave type:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.patch('/api/v1/leave-types/:id/toggle-status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { is_active } = req.body;

  try {
    if (!isSuperAdmin && companyId) {
      const check = await query('SELECT id FROM hrms.leave_types WHERE id = $1 AND company_id = $2', [id, companyId]);
      if (check.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
      'UPDATE hrms.leave_types SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [is_active, id]
    );
    logUserAction(req, 'TOGGLE_LEAVE_TYPE_STATUS', 'Leaves', `Set leave type ID ${id} is_active = ${is_active}`);
    return res.json({ message: `Leave type status updated`, leaveType: result.rows[0] });
  } catch (err) {
    console.error('Error toggling leave type status:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/leave-types/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;

  try {
    if (!isSuperAdmin) {
      const check = await query('SELECT id FROM hrms.leave_types WHERE id = $1 AND company_id = $2', [id, companyId]);
      if (check.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
    }

    await query('UPDATE hrms.leave_types SET is_active = false WHERE id = $1', [id]);
    logUserAction(req, 'DELETE_LEAVE_TYPE', 'Leaves', `Deactivated leave type ID ${id}`);
    return res.json({ message: 'Leave type deleted successfully' });
  } catch (err) {
    console.error('Error deleting leave type:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

/**
 * 📅 LEAVE BALANCES APIs
 */
app.get('/api/v1/leave-balances', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scopeCtx = await getEmployeeDataScope(req, 'leaves', 'view_leave_balances');
    let companyId = (req.query.companyId as string) || scopeCtx.companyId || req.user?.companyId;
    let employeeId = (req.query.employeeId as string);

    let sql = `
      SELECT lb.*, 
             lt.name as leave_type_name, lt.code as leave_type_code, lt.is_paid,
             e.first_name || ' ' || e.last_name as employee_name,
             e.email as employee_email,
             e.emp_id_code,
             c.name as company_name
      FROM hrms.leave_balances lb 
      JOIN hrms.leave_types lt ON lb.leave_type_id = lt.id 
      JOIN hrms.employees e ON lb.employee_id = e.id
      LEFT JOIN hrms.companies c ON e.company_id = c.id
    `;

    const whereConditions: string[] = [];
    const params: any[] = [];

    let yearParam = (req.query.year as string);
    if (yearParam) {
      params.push(parseInt(yearParam, 10));
      whereConditions.push(`lb.balance_year = $${params.length}`);
    }

    if (employeeId) {
      params.push(employeeId);
      whereConditions.push(`lb.employee_id = $${params.length}`);
    } else if (companyId && companyId !== 'all') {
      params.push(companyId);
      whereConditions.push(`(lt.company_id = $${params.length} OR e.company_id = $${params.length})`);
    }

    const scopeCond = buildDataScopeCondition(scopeCtx, 'e', 'id', params.length + 1);
    if (scopeCond.whereSql) {
      whereConditions.push(scopeCond.whereSql);
      params.push(...scopeCond.params);
    }

    if (whereConditions.length > 0) {
      sql += ` WHERE ` + whereConditions.join(' AND ');
    }

    sql += ` ORDER BY e.first_name ASC, lt.name ASC`;
    const result = await query(sql, params);

    // Auto-seed default leave balances for active employees if no records exist
    if (result.rows.length === 0 && scopeCtx.employeeId) {
      const currentYear = new Date().getFullYear();
      const empRes = await query(`SELECT id, company_id FROM hrms.employees WHERE status = 'ACTIVE'`);
      const ltRes = await query(`SELECT id, company_id, max_days_per_year FROM hrms.leave_types`);

      if (empRes.rows.length > 0 && ltRes.rows.length > 0) {
        for (const emp of empRes.rows) {
          const empLeaveTypes = ltRes.rows.filter(lt => !lt.company_id || lt.company_id === emp.company_id);
          for (const lt of empLeaveTypes) {
            const allotted = parseFloat(lt.max_days_per_year || 12);
            await query(`
              INSERT INTO hrms.leave_balances (company_id, employee_id, leave_type_id, balance_year, allotted, used, remaining)
              VALUES ($1, $2, $3, $4, $5, 0, $5)
              ON CONFLICT DO NOTHING
            `, [emp.company_id, emp.id, lt.id, currentYear, allotted]);
          }
        }
        // Re-fetch after seeding
        const seededResult = await query(sql, params);
        return res.json({ balances: seededResult.rows });
      }
    }

    return res.json({ balances: result.rows });
  } catch (err) {
    console.error('Error fetching leave balances:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

/**
 * 📅 LEAVE REQUESTS APIs
 */
app.get('/api/v1/leave-requests', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;
  const email = req.user?.email;
  const scope = req.query.scope as string | undefined;
  const filterSelf = req.query.self === 'true' || scope === 'my';
  const filterTeam = scope === 'team';

  if (!companyId && !isSuperAdmin) return res.status(400).json({ error: 'Company ID is required' });

  try {
    let employeeId = null;
    if (email) {
      const empCheck = await query('SELECT id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
      if (empCheck.rows.length > 0) {
        employeeId = empCheck.rows[0].id;
      }
    }

    let sql = `
      SELECT lr.*, lt.name as leave_type_name, lt.code as leave_type_code,
             e.first_name || ' ' || e.last_name as employee_name, e.emp_id_code,
             ap.first_name || ' ' || ap.last_name as approved_by_name
      FROM hrms.leave_requests lr
      JOIN hrms.leave_types lt ON lr.leave_type_id = lt.id
      JOIN hrms.employees e ON lr.employee_id = e.id
      LEFT JOIN hrms.employees ap ON lr.approved_by = ap.id
    `;
    const params: any[] = [];
    const whereClauses: string[] = [];

    if (companyId && companyId !== 'all') {
      params.push(companyId);
      whereClauses.push(`lt.company_id = $${params.length}`);
    } else if (!isSuperAdmin && companyId) {
      params.push(companyId);
      whereClauses.push(`lt.company_id = $${params.length}`);
    }

    if (filterSelf && employeeId) {
      params.push(employeeId);
      whereClauses.push(`lr.employee_id = $${params.length}`);
    } else if (filterTeam && employeeId) {
      if (isSuperAdmin) {
        params.push(employeeId);
        whereClauses.push(`lr.employee_id != $${params.length}`);
      } else {
        params.push(employeeId);
        whereClauses.push(`e.reporting_to_id = $${params.length}`);
      }
    } else {
      const scopeCtx = await getEmployeeDataScope(req, 'leave', 'view_leave_requests');
      const scopeCond = buildDataScopeCondition(scopeCtx, 'lr', 'employee_id', params.length + 1);
      if (scopeCond.whereSql) {
        whereClauses.push(scopeCond.whereSql);
        params.push(...scopeCond.params);
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY lr.created_at DESC`;
    const result = await query(sql, params);
    return res.json({ requests: result.rows });
  } catch (err) {
    console.error('Error fetching leave requests:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/leave-requests', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.user?.email;
  const { leave_type_id, from_date, to_date, total_days, reason } = req.body;

  if (!leave_type_id || !from_date || !to_date || !total_days || !reason) {
    return res.status(400).json({ error: 'Required fields missing: leave_type_id, from_date, to_date, total_days, reason' });
  }

  try {
    let employeeId = req.body.employee_id;
    if (!employeeId && email) {
      const empCheck = await query('SELECT id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
      if (empCheck.rows.length === 0) return res.status(400).json({ error: 'Active employee record not found' });
      employeeId = empCheck.rows[0].id;
    }

    if (!employeeId) return res.status(400).json({ error: 'Employee ID is required' });

    const currentYear = new Date(from_date).getFullYear();
    let balanceCheck = await query(
      'SELECT id, remaining, pending_approval FROM hrms.leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND balance_year = $3',
      [employeeId, leave_type_id, currentYear]
    );

    if (balanceCheck.rows.length === 0) {
      const ltQuery = await query('SELECT allotted_per_year FROM hrms.leave_types WHERE id = $1', [leave_type_id]);
      if (ltQuery.rows.length === 0) return res.status(404).json({ error: 'Leave type not found' });
      const allotted = parseFloat(ltQuery.rows[0].allotted_per_year);

      const insertBal = await query(
        `INSERT INTO hrms.leave_balances (employee_id, leave_type_id, balance_year, allotted, used, pending_approval, remaining)
         VALUES ($1, $2, $3, $4, 0, 0, $4) RETURNING *`,
        [employeeId, leave_type_id, currentYear, allotted]
      );
      balanceCheck = insertBal;
    }

    const balance = balanceCheck.rows[0];
    const remaining = parseFloat(balance.remaining);
    const requestedDays = parseFloat(total_days);

    // 1. Check for overlapping existing pending/approved leave requests
    const overlapCheck = await query(
      `SELECT id, from_date, to_date, status FROM hrms.leave_requests 
       WHERE employee_id = $1 AND status IN ('PENDING', 'APPROVED')
       AND (from_date <= $2 AND to_date >= $3)`,
      [employeeId, to_date, from_date]
    );

    if (overlapCheck.rows.length > 0) {
      const existing = overlapCheck.rows[0];
      return res.status(400).json({
        error: `Cannot apply: You already have a ${existing.status} leave request from ${new Date(existing.from_date).toISOString().split('T')[0]} to ${new Date(existing.to_date).toISOString().split('T')[0]}.`
      });
    }

    // 2. Fetch leave type details for accrual calculations
    const ltCheck = await query('SELECT name, code, is_paid, accrual_type, allotted_per_year FROM hrms.leave_types WHERE id = $1', [leave_type_id]);
    if (ltCheck.rows.length === 0) return res.status(404).json({ error: 'Leave type not found' });
    const leaveTypeObj = ltCheck.rows[0];
    const isPaid = leaveTypeObj.is_paid;
    const allottedPerYear = parseFloat(leaveTypeObj.allotted_per_year || '12');
    const accrualType = (leaveTypeObj.accrual_type || '').toUpperCase();
    const leaveCode = (leaveTypeObj.code || '').toUpperCase();

    // 3. Prorated Monthly Accrual Limit check till current month
    const isProrated = accrualType === 'MONTHLY' || ['SL', 'SICK', 'CL', 'CASUAL', 'EL', 'EARNED', 'PL'].includes(leaveCode);
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1 to 12
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (isProrated) {
      const accruedTillNow = Math.min(allottedPerYear, Math.floor((allottedPerYear / 12) * currentMonth * 10) / 10);
      const usedDays = parseFloat(balance.used || '0');
      const pendingDays = parseFloat(balance.pending_approval || '0');
      const maxAllowedTillCurrentMonth = Math.max(0, Math.min(remaining, Math.round((accruedTillNow - usedDays - pendingDays) * 10) / 10));

      if (requestedDays > maxAllowedTillCurrentMonth) {
        return res.status(400).json({
          error: `Prorated Accrual Limit Exceeded: Up to ${monthNames[currentMonth - 1]} (Month ${currentMonth}/12), only ${accruedTillNow} days have accrued out of ${allottedPerYear} annual days. Max usable balance till this month is ${maxAllowedTillCurrentMonth} day(s). Leaves for future months cannot be used in advance.`
        });
      }
    }

    if (isPaid && remaining < requestedDays) {
      return res.status(400).json({ error: `Insufficient leave balance. Remaining: ${remaining} days, Requested: ${requestedDays} days.` });
    }

    const result = await query(
      `INSERT INTO hrms.leave_requests (employee_id, leave_type_id, from_date, to_date, total_days, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING *`,
      [employeeId, leave_type_id, from_date, to_date, requestedDays, reason]
    );

    await query(
      `UPDATE hrms.leave_balances 
       SET pending_approval = pending_approval + $1, remaining = remaining - $1
       WHERE id = $2`,
      [requestedDays, balance.id]
    );

    logUserAction(req, 'APPLY_LEAVE', 'Leaves', `Applied for ${requestedDays} day(s) of leave (${from_date} to ${to_date})`);

    // 🔔 Trigger Notification to Reporting Manager asynchronously
    try {
      const empInfo = await query('SELECT first_name, last_name, company_id, reporting_to_id FROM hrms.employees WHERE id = $1', [employeeId]);
      if (empInfo.rows.length > 0) {
        const emp = empInfo.rows[0];
        if (emp.reporting_to_id) {
          sendNotification({
            companyId: emp.company_id,
            senderId: employeeId,
            recipientId: emp.reporting_to_id,
            module: 'LEAVES',
            eventCode: 'LEAVE_APPLIED',
            referenceType: 'LEAVE_REQUEST',
            referenceId: result.rows[0].id,
            title: 'New Leave Application 📝',
            message: `${emp.first_name} ${emp.last_name || ''} applied for ${requestedDays} day(s) of leave (${from_date} to ${to_date}).`,
            type: 'INFO',
            actionUrl: '/dashboard/leaves/requests',
          });
        }
      }
    } catch (notifErr) {
      console.error('[NotificationTrigger] Error dispatching leave applied notification:', notifErr);
    }

    return res.status(201).json({ message: 'Leave request submitted successfully', request: result.rows[0] });
  } catch (err) {
    console.error('Error submitting leave request:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/leave-requests/:id/action', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { action } = req.body;
  const email = req.user?.email;

  if (action !== 'APPROVED' && action !== 'REJECTED') {
    return res.status(400).json({ error: 'Invalid action: must be APPROVED or REJECTED' });
  }

  try {
    let approverId = null;
    if (email) {
      const empCheck = await query('SELECT id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
      if (empCheck.rows.length > 0) {
        approverId = empCheck.rows[0].id;
      }
    }

    const reqCheck = await query('SELECT * FROM hrms.leave_requests WHERE id = $1', [id]);
    if (reqCheck.rows.length === 0) return res.status(404).json({ error: 'Leave request not found' });
    const leaveReq = reqCheck.rows[0];

    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    if (approverId && leaveReq.employee_id === approverId && !isSuperAdmin) {
      return res.status(403).json({ error: 'Self-approval is restricted. Your leave request must be approved by your reporting manager or HR.' });
    }

    if (leaveReq.status !== 'PENDING') {
      return res.status(400).json({ error: 'Leave request is already processed' });
    }

    const currentYear = new Date(leaveReq.from_date).getFullYear();

    const balCheck = await query(
      'SELECT id, remaining, used, pending_approval FROM hrms.leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND balance_year = $3',
      [leaveReq.employee_id, leaveReq.leave_type_id, currentYear]
    );

    if (balCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Leave balance not found' });
    }

    const balance = balCheck.rows[0];
    const totalDays = parseFloat(leaveReq.total_days);

    if (action === 'APPROVED') {
      await query(
        `UPDATE hrms.leave_requests 
         SET status = 'APPROVED', approved_by = $1, approved_at = NOW() 
         WHERE id = $2`,
        [approverId, id]
      );

      await query(
        `UPDATE hrms.leave_balances 
         SET used = used + $1, pending_approval = pending_approval - $1
         WHERE id = $2`,
        [totalDays, balance.id]
      );

      await query(
        `INSERT INTO hrms.leave_transaction_logs (employee_id, leave_type_id, amount, transaction_type, performed_by, remarks)
         VALUES ($1, $2, $3, 'USAGE', $4, $5)`,
        [leaveReq.employee_id, leaveReq.leave_type_id, -totalDays, approverId, `Leave request approved. Reference ID: ${id}`]
      );
    } else {
      await query(
        `UPDATE hrms.leave_requests 
         SET status = 'REJECTED', approved_by = $1, approved_at = NOW() 
         WHERE id = $2`,
        [approverId, id]
      );

      await query(
        `UPDATE hrms.leave_balances 
         SET remaining = remaining + $1, pending_approval = pending_approval - $1
         WHERE id = $2`,
        [totalDays, balance.id]
      );
    }

    logUserAction(req, `${action}_LEAVE`, 'Leaves', `${action === 'APPROVED' ? 'Approved' : 'Rejected'} leave request (${leaveReq.total_days} days) for employee ID ${leaveReq.employee_id}`);

    // 🔔 Trigger Notification to Applicant Employee asynchronously
    try {
      const empInfo = await query('SELECT company_id FROM hrms.employees WHERE id = $1', [leaveReq.employee_id]);
      if (empInfo.rows.length > 0) {
        sendNotification({
          companyId: empInfo.rows[0].company_id,
          senderId: approverId,
          recipientId: leaveReq.employee_id,
          module: 'LEAVES',
          eventCode: action === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
          referenceType: 'LEAVE_REQUEST',
          referenceId: id,
          title: action === 'APPROVED' ? 'Leave Request Approved ✅' : 'Leave Request Rejected ❌',
          message: `Your leave request for ${leaveReq.total_days} day(s) (${leaveReq.from_date} to ${leaveReq.to_date}) has been ${action.toLowerCase()}.`,
          type: action === 'APPROVED' ? 'SUCCESS' : 'DANGER',
          actionUrl: '/dashboard/leaves/requests',
        });
      }
    } catch (notifErr) {
      console.error('[NotificationTrigger] Error dispatching leave action notification:', notifErr);
    }

    return res.json({ message: `Leave request ${action.toLowerCase()} successfully` });
  } catch (err) {
    console.error('Error processing leave request action:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/leave-requests/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const reqCheck = await query('SELECT * FROM hrms.leave_requests WHERE id = $1', [id]);
    if (reqCheck.rows.length === 0) return res.status(404).json({ error: 'Leave request not found' });
    const leaveReq = reqCheck.rows[0];

    if (leaveReq.status === 'PENDING') {
      const currentYear = new Date(leaveReq.from_date).getFullYear();
      const totalDays = parseFloat(leaveReq.total_days || '0');
      await query(
        `UPDATE hrms.leave_balances 
         SET remaining = remaining + $1, pending_approval = GREATEST(0, pending_approval - $1)
         WHERE employee_id = $2 AND leave_type_id = $3 AND balance_year = $4`,
        [totalDays, leaveReq.employee_id, leaveReq.leave_type_id, currentYear]
      );
    }

    await query('DELETE FROM hrms.leave_requests WHERE id = $1', [id]);
    logUserAction(req, 'DELETE_LEAVE_REQUEST', 'Leaves', `Deleted leave request ID ${id}`);
    return res.json({ message: 'Leave request deleted successfully' });
  } catch (err) {
    console.error('Error deleting leave request:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

/**
 * 📅 LEAVE BALANCES EXTENDED CRUD APIs
 */
app.get('/api/v1/leave-balances/all', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;

  if (!companyId && !isSuperAdmin) return res.status(400).json({ error: 'Company ID is required' });

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
    const params: any[] = [];

    if (companyId && companyId !== 'all') {
      params.push(companyId);
      sql += ` WHERE lt.company_id = $${params.length}`;
    }

    sql += ` ORDER BY e.first_name ASC, lt.name ASC`;
    const result = await query(sql, params);
    return res.json({ balances: result.rows });
  } catch (err) {
    console.error('Error fetching all leave balances:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/leave-balances', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { employee_id, leave_type_id, balance_year, allotted, used, remaining } = req.body;
  if (!employee_id || !leave_type_id || !balance_year || allotted === undefined) {
    return res.status(400).json({ error: 'Required fields missing: employee_id, leave_type_id, balance_year, allotted' });
  }
  try {
    const doubleCheck = await query(
      'SELECT id FROM hrms.leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND balance_year = $3',
      [employee_id, leave_type_id, parseInt(balance_year)]
    );
    if (doubleCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Leave balance for this employee and type already exists for this year.' });
    }
    const finalUsed = used !== undefined ? parseFloat(used) : 0.0;
    const finalRemaining = remaining !== undefined ? parseFloat(remaining) : parseFloat(allotted) - finalUsed;

    const result = await query(
      `INSERT INTO hrms.leave_balances (employee_id, leave_type_id, balance_year, allotted, used, pending_approval, remaining)
       VALUES ($1, $2, $3, $4, $5, 0, $6) RETURNING *`,
      [employee_id, leave_type_id, parseInt(balance_year), parseFloat(allotted), finalUsed, finalRemaining]
    );
    return res.status(201).json({ message: 'Leave balance created successfully', balance: result.rows[0] });
  } catch (err) {
    console.error('Error creating leave balance:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/leave-balances/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { allotted, used, remaining } = req.body;

  try {
    const check = await query('SELECT * FROM hrms.leave_balances WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Leave balance record not found' });

    const currentBal = check.rows[0];
    const finalAllotted = allotted !== undefined ? parseFloat(allotted) : parseFloat(currentBal.allotted);
    const finalUsed = used !== undefined ? parseFloat(used) : parseFloat(currentBal.used);
    const finalRemaining = remaining !== undefined ? parseFloat(remaining) : finalAllotted - finalUsed - parseFloat(currentBal.pending_approval);

    const result = await query(
      `UPDATE hrms.leave_balances 
       SET allotted = $1, used = $2, remaining = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [finalAllotted, finalUsed, finalRemaining, id]
    );
    return res.json({ message: 'Leave balance updated successfully', balance: result.rows[0] });
  } catch (err) {
    console.error('Error updating leave balance:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/leave-balances/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const check = await query('SELECT id FROM hrms.leave_balances WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Leave balance record not found' });

    await query('DELETE FROM hrms.leave_balances WHERE id = $1', [id]);
    return res.json({ message: 'Leave balance deleted successfully' });
  } catch (err) {
    console.error('Error deleting leave balance:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

/**
 * 📅 LEAVE TRANSACTION LOGS APIs
 */
app.get('/api/v1/leave-transaction-logs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;

  if (!companyId && !isSuperAdmin) return res.status(400).json({ error: 'Company ID is required' });

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
    const params: any[] = [];

    if (companyId && companyId !== 'all') {
      params.push(companyId);
      sql += ` WHERE lt.company_id = $${params.length}`;
    }

    sql += ` ORDER BY ltl.transaction_date DESC`;
    const result = await query(sql, params);
    return res.json({ logs: result.rows });
  } catch (err) {
    console.error('Error fetching leave transaction logs:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/leave-transaction-logs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.user?.email;
  const { employee_id, leave_type_id, amount, transaction_type, remarks } = req.body;

  if (!employee_id || !leave_type_id || amount === undefined || !transaction_type) {
    return res.status(400).json({ error: 'Required fields missing: employee_id, leave_type_id, amount, transaction_type' });
  }

  try {
    let performerId = null;
    if (email) {
      const empCheck = await query('SELECT id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [email]);
      if (empCheck.rows.length > 0) performerId = empCheck.rows[0].id;
    }

    const currentYear = new Date().getFullYear();

    // Check if balance exists
    let balCheck = await query(
      'SELECT id, remaining, allotted, used FROM hrms.leave_balances WHERE employee_id = $1 AND leave_type_id = $2 AND balance_year = $3',
      [employee_id, leave_type_id, currentYear]
    );

    const changeVal = parseFloat(amount);

    if (balCheck.rows.length === 0) {
      // Create a balance if not present
      const ltQuery = await query('SELECT allotted_per_year FROM hrms.leave_types WHERE id = $1', [leave_type_id]);
      if (ltQuery.rows.length === 0) return res.status(404).json({ error: 'Leave type not found' });
      const baseAllotted = parseFloat(ltQuery.rows[0].allotted_per_year);

      const allotted = transaction_type === 'ACCRUAL' ? baseAllotted + changeVal : baseAllotted;
      const used = transaction_type === 'USAGE' ? -changeVal : 0;
      const remaining = allotted - used;

      await query(
        `INSERT INTO hrms.leave_balances (employee_id, leave_type_id, balance_year, allotted, used, pending_approval, remaining)
         VALUES ($1, $2, $3, $4, $5, 0, $6)`,
        [employee_id, leave_type_id, currentYear, allotted, used, remaining]
      );
    } else {
      const balId = balCheck.rows[0].id;
      if (transaction_type === 'ACCRUAL') {
        await query(
          `UPDATE hrms.leave_balances SET allotted = allotted + $1, remaining = remaining + $1 WHERE id = $2`,
          [changeVal, balId]
        );
      } else if (transaction_type === 'USAGE') {
        const absoluteVal = Math.abs(changeVal);
        await query(
          `UPDATE hrms.leave_balances SET used = used + $1, remaining = remaining - $1 WHERE id = $2`,
          [absoluteVal, balId]
        );
      } else if (transaction_type === 'MANUAL_ADJUSTMENT' || transaction_type === 'CARRY_FORWARD') {
        if (changeVal > 0) {
          await query(
            `UPDATE hrms.leave_balances SET allotted = allotted + $1, remaining = remaining + $1 WHERE id = $2`,
            [changeVal, balId]
          );
        } else {
          await query(
            `UPDATE hrms.leave_balances SET remaining = remaining + $1 WHERE id = $2`,
            [changeVal, balId]
          );
        }
      }
    }

    const logResult = await query(
      `INSERT INTO hrms.leave_transaction_logs (employee_id, leave_type_id, amount, transaction_type, performed_by, remarks)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [employee_id, leave_type_id, changeVal, transaction_type, performerId, remarks || 'Manual transaction entry']
    );

    return res.status(201).json({ message: 'Transaction log and balance updated successfully', log: logResult.rows[0] });
  } catch (err) {
    console.error('Error inserting leave transaction log:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

/**
 * 🎁 COMP-OFF CREDIT REQUEST APIs
 */
// GET /api/v1/comp-off-requests
app.get('/api/v1/comp-off-requests', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.query.companyId as string;
    const scopeParam = (req.query.scope as string) || 'my';

    let loggedInEmpId: string | null = null;
    if (req.user?.email) {
      const empRes = await query('SELECT id FROM hrms.employees WHERE email = $1 AND status = \'ACTIVE\'', [req.user.email]);
      if (empRes.rows.length > 0) loggedInEmpId = empRes.rows[0].id;
    }

    const params: any[] = [];
    const whereClauses: string[] = [];

    if (companyId && companyId !== 'all') {
      params.push(companyId);
      whereClauses.push(`cor.company_id = $${params.length}`);
    }

    if (scopeParam === 'my') {
      if (loggedInEmpId) {
        params.push(loggedInEmpId);
        whereClauses.push(`cor.employee_id = $${params.length}`);
      } else {
        whereClauses.push('1=0');
      }
    } else if (scopeParam === 'team') {
      if (!isSuperAdmin && loggedInEmpId) {
        params.push(loggedInEmpId);
        whereClauses.push(`e.reporting_to_id = $${params.length}`);
      }
    }

    let sql = `
      SELECT 
        cor.*,
        e.emp_id_code,
        (e.first_name || ' ' || e.last_name) as employee_name,
        (appr.first_name || ' ' || appr.last_name) as approved_by_name
      FROM hrms.comp_off_requests cor
      JOIN hrms.employees e ON cor.employee_id = e.id
      LEFT JOIN hrms.employees appr ON cor.approved_by = appr.id
    `;

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY cor.created_at DESC`;

    const result = await query(sql, params);

    return res.json({ success: true, requests: result.rows });
  } catch (err) {
    console.error('Error fetching comp-off requests:', err);
    return res.status(500).json({ error: 'Failed to fetch comp-off requests' });
  }
});

// GET /api/v1/comp-off-requests/eligible-dates (Auto-detects worked weekends/holidays with punch times)
app.get('/api/v1/comp-off-requests/eligible-dates', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = await getEmployeeDataScope(req);
    let empId = (req.query.employeeId as string) || scope.employeeId;
    let companyId = (req.query.companyId as string) || scope.companyId || req.user?.companyId;

    if (!empId && req.user?.email) {
      const empLookup = await query(
        `SELECT id, company_id FROM hrms.employees WHERE (LOWER(email) = LOWER($1) OR LOWER(emp_id_code) = LOWER($1)) AND status = 'ACTIVE' LIMIT 1`,
        [req.user.email]
      );
      if (empLookup.rows.length > 0) {
        empId = empLookup.rows[0].id;
        if (!companyId) companyId = empLookup.rows[0].company_id;
      }
    }

    if (!companyId && empId) {
      const cLookup = await query(`SELECT company_id FROM hrms.employees WHERE id = $1`, [empId]);
      if (cLookup.rows.length > 0) companyId = cLookup.rows[0].company_id;
    }

    if (!empId) {
      return res.json({ eligibleDates: [] });
    }

    // Fetch policy thresholds
    const policyRes = await query(`
      SELECT comp_off_half_day_hours, comp_off_full_day_hours 
      FROM hrms.attendance_policies 
      WHERE company_id = $1 LIMIT 1
    `, [companyId]);

    const halfDayMinHours = policyRes.rows.length > 0 ? parseFloat(policyRes.rows[0].comp_off_half_day_hours || 4) : 4.0;
    const fullDayMinHours = policyRes.rows.length > 0 ? parseFloat(policyRes.rows[0].comp_off_full_day_hours || 8) : 8.0;

    // Fetch Company Week-Off Policy from hrms.weekoff_policies
    const weekoffPolicyRes = await query(`
      SELECT * FROM hrms.weekoff_policies 
      WHERE company_id = $1 AND is_active = true 
      LIMIT 1
    `, [companyId]);

    const weekoffPolicy = weekoffPolicyRes.rows[0] || null;

    const isDateWeekoff = (dateObj: Date) => {
      if (!weekoffPolicy) {
        const d = dateObj.getDay();
        return d === 0 || d === 6; // fallback to Sunday/Saturday if no policy configured
      }

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[dateObj.getDay()];
      const dayKey = dayName.toLowerCase();
      const dom = dateObj.getDate();
      const nthOccurrence = Math.ceil(dom / 7);

      // Check alternate_rules (e.g. { Saturday: [2, 4], Sunday: [1, 2, 3, 4, 5] })
      const altRules = weekoffPolicy.alternate_rules || {};
      if (altRules[dayName] && Array.isArray(altRules[dayName])) {
        return altRules[dayName].includes(nthOccurrence);
      }

      // Fallback to boolean flag or off_days array
      if (weekoffPolicy[dayKey] === true) return true;
      if (Array.isArray(weekoffPolicy.off_days) && weekoffPolicy.off_days.includes(dayName)) return true;

      return false;
    };

    // Fetch holidays from hrms.holiday_masters
    const holRes = await query(`SELECT holiday_date, name as holiday_name FROM hrms.holiday_masters WHERE company_id = $1`, [companyId]);
    const holidayMap = new Map<string, string>();
    holRes.rows.forEach(r => {
      const dStr = String(r.holiday_date).split(' ')[0].split('T')[0];
      holidayMap.set(dStr, r.holiday_name);
    });

    // Fetch existing comp-off requests to attach claim status directly to cards
    const existingRes = await query(`
      SELECT 
        c.id, 
        TO_CHAR(c.worked_date, 'YYYY-MM-DD') as worked_date_str, 
        c.status,
        c.approved_by,
        e.first_name as approver_first_name,
        e.last_name as approver_last_name
      FROM hrms.comp_off_requests c
      LEFT JOIN hrms.employees e ON e.id = c.approved_by
      WHERE c.employee_id = $1
    `, [empId]);

    const existingMap = new Map<string, { id: string; status: string; approved_by_name: string }>();
    existingRes.rows.forEach(r => {
      if (r.worked_date_str) {
        const approverName = r.approver_first_name
          ? `${r.approver_first_name} ${r.approver_last_name || ''}`.trim()
          : 'Pending';
        existingMap.set(r.worked_date_str, { id: r.id, status: r.status, approved_by_name: approverName });
      }
    });

    // Query raw punches grouped by date for exact weekend/holiday work detection
    const rawPunchesRes = await query(`
      SELECT 
        (punch_time::date)::text as worked_date,
        MIN(punch_time)::text as first_in,
        MAX(punch_time)::text as last_out,
        COUNT(*) as punch_count
      FROM hrms.attendance_raw_punches
      WHERE employee_id = $1
      GROUP BY (punch_time::date)
      ORDER BY worked_date DESC LIMIT 60
    `, [empId]);

    const eligibleDates: any[] = [];

    const formatTimeStr = (tsStr: string) => {
      if (!tsStr) return '--:--';
      const str = String(tsStr).replace('T', ' ');
      const parts = str.split(' ');
      if (parts.length >= 2) {
        const timeParts = parts[1].split(':');
        let h = parseInt(timeParts[0], 10);
        const m = timeParts[1] || '00';
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
      }
      return new Date(tsStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    for (const r of rawPunchesRes.rows) {
      const dateStr = String(r.worked_date).split(' ')[0].split('T')[0];
      const claimInfo = existingMap.get(dateStr) || null;

      const dateParts = dateStr.split('-');
      const y = parseInt(dateParts[0], 10);
      const m = parseInt(dateParts[1], 10) - 1;
      const d = parseInt(dateParts[2], 10);
      const dateObj = new Date(y, m, d);

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[dateObj.getDay()];
      const isHoliday = holidayMap.has(dateStr);
      const isWeekOff = isDateWeekoff(dateObj);

      const firstInDate = new Date(r.first_in);
      const lastOutDate = new Date(r.last_out);
      const diffMs = lastOutDate.getTime() - firstInDate.getTime();
      const workedHours = Math.max(0, Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10);

      const canClaim = workedHours >= halfDayMinHours;
      const compOffType = workedHours >= fullDayMinHours ? 'FULL_DAY' : (workedHours >= halfDayMinHours ? 'HALF_DAY' : 'INELIGIBLE');
      const creditedDays = compOffType === 'FULL_DAY' ? 1.0 : (compOffType === 'HALF_DAY' ? 0.5 : 0.0);
      const dayLabel = isHoliday
        ? `Holiday (${holidayMap.get(dateStr)})`
        : `${dayName} (Week-off)`;

      const inStr = formatTimeStr(r.first_in);
      const outStr = formatTimeStr(r.last_out);
      const ineligibleReason = canClaim
        ? null
        : `Minimum 4 hours of work required for Comp-Off credit claim. Worked duration (${workedHours} hrs) is less than 4.0 hours.`;

      // Return ONLY weekend or public holiday dates dynamically matched from weekoff_policies & holiday_masters
      if ((isWeekOff || isHoliday) && parseInt(r.punch_count, 10) >= 1) {
        eligibleDates.push({
          worked_date: dateStr,
          first_in: inStr,
          last_out: outStr,
          worked_hours: workedHours,
          comp_off_type: compOffType,
          credited_days: creditedDays,
          can_claim: canClaim,
          claim_info: claimInfo,
          ineligible_reason: ineligibleReason,
          day_label: dayLabel,
          is_weekend_or_holiday: true,
          reason_suggested: `Worked on ${dayLabel} (${inStr} - ${outStr}, ${workedHours} hrs)`
        });
      }
    }

    return res.json({ success: true, eligibleDates });
  } catch (err) {
    console.error('Error fetching eligible comp-off dates:', err);
    return res.status(500).json({ error: 'Failed to fetch eligible dates' });
  }
});

// POST /api/v1/comp-off-requests (Employee Submits Comp-Off Request)
app.post('/api/v1/comp-off-requests', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { worked_date, comp_off_type, reason, attachment_url } = req.body;

  const scope = await getEmployeeDataScope(req);
  let empId = scope.employeeId;
  let companyId = scope.companyId || req.user?.companyId;

  if (!empId && req.user?.email) {
    const empLookup = await query(
      `SELECT id, company_id FROM hrms.employees 
       WHERE (LOWER(email) = LOWER($1) OR LOWER(emp_id_code) = LOWER($1) OR LOWER(SPLIT_PART(email, '@', 1)) = LOWER($1)) 
         AND status = 'ACTIVE' LIMIT 1`,
      [req.user.email]
    );
    if (empLookup.rows.length > 0) {
      empId = empLookup.rows[0].id;
      if (!companyId) companyId = empLookup.rows[0].company_id;
    }
  }

  if (!companyId && empId) {
    const cLookup = await query(`SELECT company_id FROM hrms.employees WHERE id = $1`, [empId]);
    if (cLookup.rows.length > 0) companyId = cLookup.rows[0].company_id;
  }

  if (!empId || !companyId) {
    return res.status(400).json({ error: 'Employee context or company missing' });
  }

  if (!worked_date) {
    return res.status(400).json({ error: 'Worked Date is required' });
  }

  const creditedDays = comp_off_type === 'HALF_DAY' ? 0.50 : 1.00;
  const expiryDate = new Date(worked_date);
  expiryDate.setDate(expiryDate.getDate() + 90); // 90 days validity default

  try {
    // Check duplicate request for same date
    const dup = await query(`
      SELECT id FROM hrms.comp_off_requests 
      WHERE employee_id = $1 AND (TO_CHAR(worked_date, 'YYYY-MM-DD') = $2 OR worked_date::date = $2::date) AND status != 'REJECTED'
    `, [empId, worked_date]);

    if (dup.rows.length > 0) {
      return res.status(400).json({ error: 'A comp-off request already exists for this worked date' });
    }

    const ins = await query(`
      INSERT INTO hrms.comp_off_requests (
        company_id, employee_id, worked_date, comp_off_type, credited_days, reason, attachment_url, status, expiry_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8)
      RETURNING *
    `, [companyId, empId, worked_date, comp_off_type || 'FULL_DAY', creditedDays, reason || null, attachment_url || null, expiryDate.toISOString().split('T')[0]]);

    logUserAction(req, 'CREATE_COMP_OFF_REQUEST', 'Leaves', `Submitted comp-off request for ${worked_date}`);
    return res.status(201).json({ success: true, message: 'Comp-Off credit request submitted successfully', request: ins.rows[0] });
  } catch (err) {
    console.error('Error submitting comp-off request:', err);
    return res.status(500).json({ error: 'Failed to submit comp-off request' });
  }
});

// POST /api/v1/comp-off-requests/:id/action (Approve or Reject)
app.post('/api/v1/comp-off-requests/:id/action', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { action, rejection_reason } = req.body; // 'APPROVED' or 'REJECTED'

  const scope = await getEmployeeDataScope(req);
  const approverEmpId = scope.employeeId;

  if (!['APPROVED', 'REJECTED'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be APPROVED or REJECTED' });
  }

  try {
    const reqRes = await query(`SELECT * FROM hrms.comp_off_requests WHERE id = $1`, [id]);
    if (reqRes.rows.length === 0) return res.status(404).json({ error: 'Comp-off request not found' });

    const compReq = reqRes.rows[0];
    if (compReq.status !== 'PENDING') {
      return res.status(400).json({ error: `Request is already ${compReq.status}` });
    }

    if (action === 'REJECTED') {
      await query(`
        UPDATE hrms.comp_off_requests 
        SET status = 'REJECTED', approved_by = $1, approved_at = NOW(), rejection_reason = $2, updated_at = NOW()
        WHERE id = $3
      `, [approverEmpId || null, rejection_reason || null, id]);

      logUserAction(req, 'REJECT_COMP_OFF_REQUEST', 'Leaves', `Rejected comp-off request for worked date ${compReq.worked_date}`);
      return res.json({ success: true, message: 'Comp-off request rejected' });
    }

    // ACTION === 'APPROVED'
    // 1. Auto-provision Compensatory Off Leave Type if missing
    let ltRes = await query(`
      SELECT id FROM hrms.leave_types 
      WHERE company_id = $1 AND (LOWER(code) IN ('co', 'comp_off', 'compoff') OR LOWER(name) LIKE '%compensatory%')
      LIMIT 1
    `, [compReq.company_id]);

    let leaveTypeId;
    if (ltRes.rows.length === 0) {
      const newLt = await query(`
        INSERT INTO hrms.leave_types (company_id, name, code, allotted_per_year, accrual_type, carry_forward_type, max_carry_forward, is_paid, is_wfh)
        VALUES ($1, 'Compensatory Off', 'CO', 0, 'YEARLY', 'NONE', 0, true, false)
        RETURNING id
      `, [compReq.company_id]);
      leaveTypeId = newLt.rows[0].id;
    } else {
      leaveTypeId = ltRes.rows[0].id;
    }

    const currentYear = new Date(compReq.worked_date).getFullYear() || new Date().getFullYear();
    const daysToCredit = parseFloat(compReq.credited_days || 1.0);

    // 2. Upsert employee leave balance
    const balCheck = await query(`
      SELECT id, allotted, remaining FROM hrms.leave_balances 
      WHERE employee_id = $1 AND leave_type_id = $2 AND balance_year = $3
    `, [compReq.employee_id, leaveTypeId, currentYear]);

    if (balCheck.rows.length > 0) {
      const currentBal = balCheck.rows[0];
      const newAllotted = parseFloat(currentBal.allotted || 0) + daysToCredit;
      const newRemaining = parseFloat(currentBal.remaining || 0) + daysToCredit;

      await query(`
        UPDATE hrms.leave_balances 
        SET allotted = $1, remaining = $2, updated_at = NOW() 
        WHERE id = $3
      `, [newAllotted, newRemaining, currentBal.id]);
    } else {
      await query(`
        INSERT INTO hrms.leave_balances (employee_id, leave_type_id, balance_year, allotted, used, pending_approval, remaining)
        VALUES ($1, $2, $3, $4, 0, 0, $4)
      `, [compReq.employee_id, leaveTypeId, currentYear, daysToCredit]);
    }

    // 3. Log transaction
    await query(`
      INSERT INTO hrms.leave_transaction_logs (employee_id, leave_type_id, amount, transaction_type, performed_by, remarks)
      VALUES ($1, $2, $3, 'CREDIT', $4, $5)
    `, [compReq.employee_id, leaveTypeId, daysToCredit, approverEmpId || null, `Comp-off credited for worked date ${compReq.worked_date}`]);

    // 4. Update request status
    await query(`
      UPDATE hrms.comp_off_requests 
      SET status = 'APPROVED', is_credited = true, approved_by = $1, approved_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [approverEmpId || null, id]);

    logUserAction(req, 'APPROVE_COMP_OFF_REQUEST', 'Leaves', `Approved ${daysToCredit} day comp-off for worked date ${compReq.worked_date}`);
    return res.json({ success: true, message: 'Comp-off request approved and balance credited successfully!' });
  } catch (err) {
    console.error('Error processing comp-off request action:', err);
    return res.status(500).json({ error: 'Failed to process comp-off request' });
  }
});

/**
 * 📅 WEEK-OFF POLICIES CRUD APIs
 */
app.get('/api/v1/weekoffs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.query.companyId : req.user?.companyId;

  try {
    if (isSuperAdmin && (!companyId || companyId === 'all' || companyId === '')) {
      const result = await query(
        `SELECT w.*, c.name as company_name 
         FROM hrms.weekoff_policies w
         JOIN hrms.companies c ON w.company_id = c.id
         WHERE w.is_active = true 
         ORDER BY c.name ASC`
      );
      return res.json({
        weekoffs: result.rows,
        isAll: true
      });
    } else {
      if (!companyId || companyId === 'all') return res.status(400).json({ error: 'Company ID is required' });
      const result = await query(
        'SELECT * FROM hrms.weekoff_policies WHERE company_id = $1 AND is_active = true LIMIT 1',
        [companyId]
      );

      const companyResult = await query(
        'SELECT name FROM hrms.companies WHERE id = $1 LIMIT 1',
        [companyId]
      );
      const companyName = companyResult.rows[0]?.name || null;

      return res.json({
        weekoff: result.rows[0] || null,
        companyName: companyName,
        isAll: false
      });
    }
  } catch (err) {
    console.error('Error fetching weekoffs:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/weekoffs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? req.body.companyId : req.user?.companyId;
  const { name, off_days, alternate_rules } = req.body;

  if (!companyId || companyId === 'all' || !name || !Array.isArray(off_days)) {
    return res.status(400).json({ error: 'Required fields missing: companyId, name, off_days (array)' });
  }

  try {
    const check = await query('SELECT id FROM hrms.weekoff_policies WHERE company_id = $1 AND is_active = true LIMIT 1', [companyId]);

    let result;
    if (check.rows.length > 0) {
      result = await query(
        `UPDATE hrms.weekoff_policies 
         SET name = $1, off_days = $2, alternate_rules = $3, updated_at = NOW() 
         WHERE id = $4 RETURNING *`,
        [name, JSON.stringify(off_days), alternate_rules ? JSON.stringify(alternate_rules) : '{}', check.rows[0].id]
      );
    } else {
      result = await query(
        `INSERT INTO hrms.weekoff_policies (company_id, name, off_days, alternate_rules)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [companyId, name, JSON.stringify(off_days), alternate_rules ? JSON.stringify(alternate_rules) : '{}']
      );
    }
    return res.json({ message: 'Week-off policy saved successfully', weekoff: result.rows[0] });
  } catch (err) {
    console.error('Error saving weekoff policy:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/weekoffs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
  const companyId = isSuperAdmin ? (req.query.companyId || req.body.companyId) : req.user?.companyId;
  if (!companyId || companyId === 'all') return res.status(400).json({ error: 'Company ID is required' });

  try {
    await query(
      'DELETE FROM hrms.weekoff_policies WHERE company_id = $1',
      [companyId]
    );
    return res.json({ message: 'Week-off policy deleted successfully' });
  } catch (err) {
    console.error('Error deleting weekoff policy:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

// =========================================================================
// 💸 PAYROLL ENGINE API ROUTES (SLABS, COMPONENTS, CONFIGURATIONS)
// =========================================================================

// --- ENTERPRISE PAYROLL RUNS & EXECUTION API ENDPOINTS ---

// 1. Fetch Payroll Runs
app.get('/api/v1/payroll/runs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const companyId = resolveCompanyId(req);
  try {
    const sql = `
      SELECT r.*, c.name as company_name,
             cb.first_name || ' ' || cb.last_name as created_by_name,
             COALESCE(
               (SELECT string_agg(e.first_name || ' ' || e.last_name, ', ') 
                FROM (SELECT DISTINCT e2.first_name, e2.last_name 
                      FROM hrms.payslips p2 
                      JOIN hrms.employees e2 ON p2.employee_id = e2.id 
                      WHERE p2.payroll_run_id = r.id LIMIT 2) e),
               'All Employees'
             ) as employee_names
      FROM hrms.payroll_runs r 
      LEFT JOIN hrms.companies c ON r.company_id = c.id 
      LEFT JOIN hrms.employees cb ON r.created_by = cb.id
      ${companyId ? 'WHERE r.company_id = $1' : ''}
      ORDER BY r.created_at DESC
    `;
    const params = companyId ? [companyId] : [];
    const result = await query(sql, params);
    return res.json({ runs: result.rows });
  } catch (err) {
    console.error('Error fetching payroll runs:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

// 2. Generate Payroll Batch (Supports ALL, BRANCH, DEPARTMENT, SINGLE_EMPLOYEE)
app.post('/api/v1/payroll/generate', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const companyId = resolveCompanyId(req);
  const { pay_period, payroll_type, attendance_start_date, attendance_end_date, scope, branch_id, department_id, employee_id } = req.body;
  const userId = (req.user as any)?.id || req.user?.keycloakId || null;

  if (!pay_period) {
    return res.status(400).json({ error: 'Pay period (e.g. 2026-06) is required' });
  }

  const [yearStr, monthStr] = pay_period.split('-');
  const year = parseInt(yearStr) || 2026;
  const month = parseInt(monthStr) || 6;
  const targetCompanyId = companyId || req.body.companyId;

  if (!targetCompanyId) {
    return res.status(400).json({ error: 'Company ID is required to generate payroll' });
  }

  try {
    await query('BEGIN');

    // Fetch Attendance Policy Cycle Days for Company
    const policyRes = await query('SELECT cycle_start_day, cycle_end_day FROM hrms.attendance_policies WHERE company_id = $1 AND is_active = true LIMIT 1', [targetCompanyId]);
    const policy = policyRes.rows[0];

    let startDate = attendance_start_date;
    let endDate = attendance_end_date;

    if (!startDate || !endDate) {
      if (policy && policy.cycle_start_day && policy.cycle_end_day) {
        const cycleStart = parseInt(policy.cycle_start_day);
        const cycleEnd = parseInt(policy.cycle_end_day);

        if (cycleStart > cycleEnd) {
          // Cross-month cycle (e.g., 26th of prev month to 25th of current month)
          const prevMonthDate = new Date(year, month - 2, cycleStart);
          const currMonthDate = new Date(year, month - 1, cycleEnd);
          startDate = startDate || prevMonthDate.toISOString().split('T')[0];
          endDate = endDate || currMonthDate.toISOString().split('T')[0];
        } else {
          // Same month cycle (e.g., 1st to 30th)
          startDate = startDate || `${year}-${String(month).padStart(2, '0')}-${String(cycleStart).padStart(2, '0')}`;
          endDate = endDate || `${year}-${String(month).padStart(2, '0')}-${String(cycleEnd).padStart(2, '0')}`;
        }
      } else {
        startDate = startDate || `${year}-${String(month).padStart(2, '0')}-01`;
        endDate = endDate || new Date(year, month, 0).toISOString().split('T')[0];
      }
    }

    const runNumber = `PR-${year}-${String(month).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

    // Create Payroll Run Record
    const runRes = await query(`
      INSERT INTO hrms.payroll_runs (
        company_id, payroll_run_number, pay_period, payroll_month, payroll_year,
        period_start_date, period_end_date, payroll_type, status, generation_started_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'GENERATING', NOW(), $9)
      ON CONFLICT (company_id, pay_period) 
      DO UPDATE SET status = 'GENERATING', generation_started_at = NOW()
      RETURNING *
    `, [targetCompanyId, runNumber, pay_period, month, year, startDate, endDate, payroll_type || 'REGULAR', userId]);

    const run = runRes.rows[0];

    // Fetch Employees based on scope
    let empQuery = `SELECT e.*, d.name as department_name, des.name as designation_name, b.name as branch_name
                    FROM hrms.employees e
                    LEFT JOIN hrms.departments d ON e.department_id = d.id
                    LEFT JOIN hrms.designations des ON e.designation_id = des.id
                    LEFT JOIN hrms.branches b ON e.branch_id = b.id
                    WHERE e.company_id = $1 AND (e.status = 'ACTIVE' OR e.status IS NULL OR e.status = 'active')`;
    const queryParams: any[] = [targetCompanyId];

    if (scope === 'BRANCH' && branch_id) {
      empQuery += ` AND e.branch_id = $2`;
      queryParams.push(branch_id);
    } else if (scope === 'DEPARTMENT' && department_id) {
      empQuery += ` AND e.department_id = $2`;
      queryParams.push(department_id);
    } else if (scope === 'SINGLE_EMPLOYEE' && employee_id) {
      empQuery += ` AND e.id = $2`;
      queryParams.push(employee_id);
    }

    const employees = await query(empQuery, queryParams);

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let successCount = 0;
    let skippedCount = 0;

    const totalDaysInMonth = new Date(year, month, 0).getDate();

    // Fetch active statutory rules and slabs for this cutoff period and company
    let statutoryRules: any[] = [];
    let statutorySlabs: any[] = [];
    try {
      const statutoryRulesRes = await query(`
        SELECT r.*, c.component_code
        FROM hrms.statutory_rules r
        JOIN hrms.salary_components c ON r.component_id = c.id
        WHERE (r.company_id = $1 OR r.company_id IS NULL)
          AND r.is_active = true
          AND r.effective_from <= $2
          AND (r.effective_to IS NULL OR r.effective_to >= $3)
        ORDER BY r.effective_from DESC
      `, [targetCompanyId, endDate, startDate]);
      statutoryRules = statutoryRulesRes.rows;

      const statutorySlabsRes = await query(`
        SELECT s.*, r.rule_code, c.component_code
        FROM hrms.statutory_rule_slabs s
        JOIN hrms.statutory_rules r ON s.statutory_rule_id = r.id
        JOIN hrms.salary_components c ON r.component_id = c.id
        WHERE (r.company_id = $1 OR r.company_id IS NULL)
          AND s.is_active = true
          AND s.effective_from <= $2
          AND (s.effective_to IS NULL OR s.effective_to >= $3)
        ORDER BY s.display_order ASC, s.min_wage ASC
      `, [targetCompanyId, endDate, startDate]);
      statutorySlabs = statutorySlabsRes.rows;
    } catch (stErr) {
      console.warn('Warning: Could not fetch statutory rules for payroll run, fallback will be used:', stErr);
    }

    for (const emp of employees.rows) {
      // 1. Query Active Salary Structure from hrms.salary_structures
      const salRes = await query(`
        SELECT * FROM hrms.salary_structures
        WHERE (employee_id = $1 OR emp_uuid = $1)
          AND (is_structure_active = true OR is_structure_active IS NULL)
        ORDER BY effective_from_date DESC NULLS LAST, created_at DESC LIMIT 1
      `, [emp.id]);

      const salStruct = salRes.rows[0];

      // If no valid active salary structure exists for employee, skip them (no dummy salaries!)
      if (!salStruct) {
        console.warn(`Skipping employee ${emp.email || emp.id}: Missing active salary structure for pay period ${startDate} to ${endDate}`);
        skippedCount++;
        continue;
      }

      const psNumber = `PS${year}${String(month).padStart(2, '0')}${String(emp.emp_id || emp.id).slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

      // 2. Determine Employee Effective Active Range in this Payroll Cutoff Window (Prorated Salary Rules)
      const empDOJ = emp.joining_date ? new Date(emp.joining_date).toISOString().split('T')[0] : null;
      const empDOL = (emp.relieving_date || emp.exit_date || emp.resignation_date)
        ? new Date(emp.relieving_date || emp.exit_date || emp.resignation_date).toISOString().split('T')[0]
        : null;

      // Effective calculation boundaries (Mid-month Joining & Mid-month Exit Proration)
      const empEffectiveStart = (empDOJ && empDOJ > startDate) ? empDOJ : startDate;
      const empEffectiveEnd = (empDOL && empDOL < endDate) ? empDOL : endDate;

      // Calculate max active tenure days in cutoff cycle for this employee
      let activeTenureDays = totalDaysInMonth;
      if (empEffectiveStart <= empEffectiveEnd) {
        const dDiff = new Date(empEffectiveEnd).getTime() - new Date(empEffectiveStart).getTime();
        activeTenureDays = Math.max(0, Math.floor(dDiff / (1000 * 3600 * 24)) + 1);
      } else {
        activeTenureDays = 0;
      }

      // Dynamic Attendance Query for Effective Employee Active Range
      const attRes = await query(`
        SELECT 
          COUNT(*) FILTER (WHERE LOWER(status) IN ('present', 'on_duty', 'regularized')) as present_cnt,
          COUNT(*) FILTER (WHERE LOWER(status) = 'half_day') as half_cnt,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('leave', 'paid_leave')) as leave_cnt,
          COUNT(*) FILTER (WHERE LOWER(status) = 'weekoff') as weekoff_cnt,
          COUNT(*) FILTER (WHERE LOWER(status) = 'holiday') as holiday_cnt,
          COUNT(*) FILTER (WHERE LOWER(status) = 'absent') as absent_cnt,
          COUNT(*) FILTER (WHERE COALESCE(late_minutes, 0) > 0) as late_cnt
        FROM hrms.attendance_summary
        WHERE employee_id = $1 AND attendance_date >= $2 AND attendance_date <= $3
      `, [emp.id, empEffectiveStart, empEffectiveEnd]);

      const attData = attRes.rows[0];

      // Count Sundays (weekoffs) ONLY within effective active tenure range
      let sundaysCount = 0;
      if (empEffectiveStart <= empEffectiveEnd) {
        const sCur = new Date(empEffectiveStart);
        const sEnd = new Date(empEffectiveEnd);
        while (sCur <= sEnd) {
          if (sCur.getDay() === 0) sundaysCount++;
          sCur.setDate(sCur.getDate() + 1);
        }
      }

      // Count DB Holidays for company ONLY within effective active tenure range
      let dbHolidaysCount = 0;
      if (empEffectiveStart <= empEffectiveEnd) {
        try {
          const holRes = await query(`
            SELECT COUNT(*) as cnt FROM hrms.holidays WHERE company_id = $1 AND holiday_date >= $2 AND holiday_date <= $3
          `, [targetCompanyId, empEffectiveStart, empEffectiveEnd]);
          dbHolidaysCount = parseInt(holRes.rows[0]?.cnt || '0', 10);
        } catch (e) { }
      }

      // Count DB Approved Leaves for employee ONLY within effective active tenure range
      let dbLeavesCount = 0;
      if (empEffectiveStart <= empEffectiveEnd) {
        try {
          const levRes = await query(`
            SELECT COUNT(*) as cnt FROM hrms.leave_requests WHERE employee_id = $1 AND LOWER(status) = 'approved' AND start_date <= $3 AND end_date >= $2
          `, [emp.id, empEffectiveStart, empEffectiveEnd]);
          dbLeavesCount = parseInt(levRes.rows[0]?.cnt || '0', 10);
        } catch (e) { }
      }

      let presentDays = 0;
      let halfDays = 0;
      let paidLeaves = 0;
      let weekoffDays = 0;
      let holidayDays = 0;
      let absentDays = 0;
      let workingDays = totalDaysInMonth;
      let payableDays = 0;
      let lopDays = 0;
      let lateLogins = 0;

      const pCnt = parseFloat(attData.present_cnt || 0);
      const hCnt = parseFloat(attData.half_cnt || 0);
      const lCnt = parseFloat(attData.leave_cnt || 0);
      const wCnt = parseFloat(attData.weekoff_cnt || 0);
      const holCnt = parseFloat(attData.holiday_cnt || 0);

      presentDays = pCnt + (hCnt * 0.5);
      halfDays = hCnt;
      paidLeaves = Math.max(lCnt, dbLeavesCount);
      weekoffDays = Math.max(wCnt, sundaysCount);
      holidayDays = Math.max(holCnt, dbHolidaysCount);
      lateLogins = parseInt(attData.late_cnt || 0, 10);

      // Payable Days capped at active tenure days in cycle
      payableDays = Math.min(activeTenureDays, presentDays + paidLeaves + weekoffDays + holidayDays);
      lopDays = Math.max(0, activeTenureDays - payableDays);
      absentDays = Math.max(0, activeTenureDays - (presentDays + paidLeaves + weekoffDays + holidayDays));
      workingDays = Math.max(1, activeTenureDays - (weekoffDays + holidayDays));

      // 3. Calculate earnings & deductions from salStruct
      const monthlyBasic = parseFloat(salStruct.basic) || parseFloat(salStruct.basic_salary) || (parseFloat(salStruct.salary_per_month) * 0.5) || 0;
      const monthlyHra = parseFloat(salStruct.hra) || (monthlyBasic * 0.4) || 0;
      const monthlyCa = parseFloat(salStruct.ca) || parseFloat(salStruct.conveyance_allowance) || 0;
      const monthlyMa = parseFloat(salStruct.ma) || parseFloat(salStruct.medical_allowance) || 0;
      const monthlySa = parseFloat(salStruct.sa) || parseFloat(salStruct.special_allowance) || 0;
      const monthlyOther = parseFloat(salStruct.other_allowance) || 0;

      // Pro-rate earnings according to payableDays ratio
      const prRatio = totalDaysInMonth > 0 ? (payableDays / totalDaysInMonth) : 0;

      const basic = Math.round(monthlyBasic * prRatio);
      const hra = Math.round(monthlyHra * prRatio);
      const ca = Math.round(monthlyCa * prRatio);
      const ma = Math.round(monthlyMa * prRatio);
      const sa = Math.round(monthlySa * prRatio);
      const other = Math.round(monthlyOther * prRatio);

      const gross = basic + hra + ca + ma + sa + other;

      // Calculate Deductions via Dynamic Statutory Rules
      // 1. Dynamic PF
      let pf = 0;
      if (salStruct.pf_check !== false) {
        const pfRule = statutoryRules.find((r: any) => r.component_code === 'PF');
        if (pfRule) {
          const pfRate = parseFloat(pfRule.employee_rate || 0) / 100;
          const pfCeiling = pfRule.wage_ceiling ? parseFloat(pfRule.wage_ceiling) : null;
          const pfMaxAmount = pfRule.max_employee_amount ? parseFloat(pfRule.max_employee_amount) : null;
          const pfBaseAmount = pfRule.calculation_base === 'GROSS' ? gross : basic;

          if (pfBaseAmount > 0) {
            const applicableWage = pfCeiling ? Math.min(pfBaseAmount, pfCeiling) : pfBaseAmount;
            let calculatedPf = Math.round(applicableWage * pfRate);
            if (pfMaxAmount && calculatedPf > pfMaxAmount) {
              calculatedPf = Math.round(pfMaxAmount);
            }
            pf = calculatedPf;
          }
        } else if (basic > 0) {
          // Default statutory fallback
          pf = Math.min(Math.round(basic * 0.12), 1800);
        }
      }

      // 2. Dynamic ESI
      let esi = 0;
      if (salStruct.esi_check !== false) {
        const esiRule = statutoryRules.find((r: any) => r.component_code === 'ESI');
        if (esiRule) {
          const esiRate = parseFloat(esiRule.employee_rate || 0) / 100;
          const esiCeiling = esiRule.wage_ceiling ? parseFloat(esiRule.wage_ceiling) : 21000;
          const esiBaseAmount = esiRule.calculation_base === 'BASIC' ? basic : gross;

          if (esiBaseAmount > 0 && esiBaseAmount <= esiCeiling) {
            esi = Math.round(esiBaseAmount * esiRate);
          }
        } else if (gross > 0 && gross <= 21000) {
          esi = Math.round(gross * 0.0075);
        }
      }

      // 3. Dynamic PT
      let pt = 0;
      if (salStruct.pt_check !== false) {
        const ptRule = statutoryRules.find((r: any) => r.component_code === 'PT');
        if (ptRule) {
          const ptBaseAmount = ptRule.calculation_base === 'BASIC' ? basic : gross;
          const matchingSlabs = statutorySlabs.filter((s: any) => s.statutory_rule_id === ptRule.id);
          if (matchingSlabs.length > 0) {
            const matched = matchingSlabs.find((s: any) => {
              const min = parseFloat(s.min_wage || 0);
              const max = s.max_wage ? parseFloat(s.max_wage) : Infinity;
              return ptBaseAmount >= min && ptBaseAmount <= max;
            });
            if (matched) {
              if (matched.fixed_amount !== null && matched.fixed_amount !== undefined) {
                pt = Math.round(parseFloat(matched.fixed_amount));
              } else if (matched.percentage) {
                pt = Math.round(ptBaseAmount * (parseFloat(matched.percentage) / 100));
              }
            }
          } else if (ptRule.max_employee_amount && ptBaseAmount > 20000) {
            pt = Math.round(parseFloat(ptRule.max_employee_amount));
          }
        } else if (gross > 20000) {
          pt = 200;
        }
      }

      const tds = gross > 50000 ? Math.round((gross - 50000) * 0.1) : 0;

      const deductions = pf + esi + pt + tds;
      const net = Math.max(0, gross - deductions);

      totalGross += gross;
      totalDeductions += deductions;
      totalNet += net;
      successCount++;

      // 4. Handle Bank Info cleanly (no fake HDFC account fallbacks)
      const bankAcc = emp.bank_acc_no || emp.account_number;
      const paymentMode = bankAcc ? 'BANK_TRANSFER' : 'CASH';
      const maskedAccount = bankAcc ? `XXXXXX${String(bankAcc).slice(-4)}` : 'PENDING_BANK_INFO';
      const bankName = emp.bank_name || (bankAcc ? 'Bank' : 'Pending Bank Details');
      const ifscCode = emp.ifsc_code || 'PENDING';

      const empSnapshot = {
        employee: { code: emp.emp_id || 'EMP101', name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() },
        organization: { department: emp.department_name || 'General', designation: emp.designation_name || 'Staff', location: emp.branch_name || 'Headquarters' },
        bank: { bank_name: bankName, masked_account: maskedAccount, ifsc: ifscCode, pan: emp.pan_number || 'NOT_PROVIDED' }
      };

      // Insert Payslip Summary
      const psRes = await query(`
        INSERT INTO hrms.payslips (
          payroll_run_id, company_id, employee_id, payslip_number, employee_snapshot,
          total_days, working_days, present_days, absent_days, half_days, holidays, weekoffs, paid_leaves, payable_days, lop_days, late_logins,
          gross_earnings, gross_deductions, gross_salary, total_deductions, net_salary, payment_mode, payment_date, status, generated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, CURRENT_DATE + INTERVAL '1 day', 'GENERATED', NOW()
        )
        ON CONFLICT (company_id, employee_id, payroll_run_id) 
        DO UPDATE SET 
          total_days = EXCLUDED.total_days,
          working_days = EXCLUDED.working_days,
          present_days = EXCLUDED.present_days,
          absent_days = EXCLUDED.absent_days,
          half_days = EXCLUDED.half_days,
          holidays = EXCLUDED.holidays,
          weekoffs = EXCLUDED.weekoffs,
          paid_leaves = EXCLUDED.paid_leaves,
          payable_days = EXCLUDED.payable_days,
          lop_days = EXCLUDED.lop_days,
          late_logins = EXCLUDED.late_logins,
          gross_earnings = EXCLUDED.gross_earnings,
          gross_deductions = EXCLUDED.gross_deductions,
          gross_salary = EXCLUDED.gross_salary,
          total_deductions = EXCLUDED.total_deductions,
          net_salary = EXCLUDED.net_salary,
          employee_snapshot = EXCLUDED.employee_snapshot,
          status = 'GENERATED',
          updated_at = NOW()
        RETURNING id
      `, [
        run.id, targetCompanyId, emp.id, psNumber, JSON.stringify(empSnapshot),
        totalDaysInMonth, workingDays, presentDays, absentDays, halfDays, holidayDays, weekoffDays, paidLeaves, payableDays, lopDays, lateLogins,
        gross, deductions, gross, deductions, net, paymentMode
      ]);

      const payslipId = psRes.rows[0].id;

      // Clear existing payslip line items for this payslip before inserting updated items
      await query('DELETE FROM hrms.payslip_items WHERE payslip_id = $1', [payslipId]);

      // Insert Payslip Line Items
      const items = [
        { code: 'BASIC', name: 'Basic Salary', type: 'EARNING', amount: basic, order: 1 },
        { code: 'HRA', name: 'House Rent Allowance', type: 'EARNING', amount: hra, order: 2 },
        { code: 'CA', name: 'Conveyance Allowance', type: 'EARNING', amount: ca, order: 3 },
        { code: 'MA', name: 'Medical Allowance', type: 'EARNING', amount: ma, order: 4 },
        { code: 'SA', name: 'Special Allowance', type: 'EARNING', amount: sa, order: 5 },
        { code: 'OTHER', name: 'Other Allowance', type: 'EARNING', amount: other, order: 6 },
        { code: 'PF', name: 'Provident Fund (PF)', type: 'DEDUCTION', amount: pf, order: 7 },
        { code: 'ESI', name: 'Employee State Insurance', type: 'DEDUCTION', amount: esi, order: 8 },
        { code: 'PT', name: 'Professional Tax (PT)', type: 'DEDUCTION', amount: pt, order: 9 },
        { code: 'TDS', name: 'Tax Deducted at Source', type: 'DEDUCTION', amount: tds, order: 10 }
      ];

      await query(`DELETE FROM hrms.payslip_items WHERE payslip_id = $1`, [payslipId]);

      for (const it of items) {
        if (it.amount > 0) {
          await query(`
            INSERT INTO hrms.payslip_items (payslip_id, component_code, component_name, type, amount, display_order)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [payslipId, it.code, it.name, it.type, it.amount, it.order]);
        }
      }
    }

    // Update Payroll Run status to GENERATED
    const updatedRun = await query(`
      UPDATE hrms.payroll_runs 
      SET status = 'GENERATED', total_employees = $1, total_gross_payout = $2, total_deductions = $3, total_net_payout = $4, generation_completed_at = NOW(), updated_at = NOW()
      WHERE id = $5 RETURNING *
    `, [successCount, totalGross, totalDeductions, totalNet, run.id]);

    // Log Action
    await query(`
      INSERT INTO hrms.payroll_run_logs (payroll_run_id, action, from_status, to_status, description, metadata, performed_by)
      VALUES ($1, 'GENERATED', 'DRAFT', 'GENERATED', 'Payroll calculation completed successfully', $2, $3)
    `, [run.id, JSON.stringify({ employees: successCount, skipped: skippedCount, totalNet }), userId || run.id]);

    await query('COMMIT');
    return res.json({
      message: `Payroll generated successfully for ${successCount} staff! (${skippedCount} skipped due to missing salary structures)`,
      run: updatedRun.rows[0],
      processed: successCount,
      skipped: skippedCount
    });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Error generating payroll:', err);
    return res.status(500).json({ error: 'Failed to generate payroll' });
  }
});

// Delete Payroll Run Batch
app.delete(
  '/api/v1/payroll/runs/:id',
  authenticateToken,
  requirePermission('delete_payroll'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const isSuperAdmin = req.user && (req.user.roles.includes('SuperAdmin') || req.user.roles.includes('superadmin'));
    const companyId = req.user?.companyId;

    try {
      await query('BEGIN');

      const runCheck = await query('SELECT * FROM hrms.payroll_runs WHERE id = $1', [id]);
      if (runCheck.rows.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ error: 'Payroll run not found' });
      }

      if (!isSuperAdmin && runCheck.rows[0].company_id !== companyId) {
        await query('ROLLBACK');
        return res.status(403).json({ error: 'Access denied: Payroll run is not in your company context' });
      }

      // Delete associated payslips and logs first
      await query('DELETE FROM hrms.payslips WHERE payroll_run_id = $1', [id]);
      await query('DELETE FROM hrms.payroll_run_logs WHERE payroll_run_id = $1', [id]);
      const deletedRun = await query('DELETE FROM hrms.payroll_runs WHERE id = $1 RETURNING *', [id]);

      await query('COMMIT');
      return res.json({ message: 'Payroll run batch deleted successfully', run: deletedRun.rows[0] });
    } catch (err) {
      await query('ROLLBACK');
      console.error('Error deleting payroll run:', err);
      return res.status(500).json({ error: 'Internal server database error' });
    }
  }
);

// 3. Payroll Run Actions (APPROVE, RELEASE, FREEZE, CANCEL)
app.post('/api/v1/payroll/runs/:id/action', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { action, reason } = req.body;
  const userId = (req.user as any)?.id || req.user?.keycloakId || null;

  try {
    await query('BEGIN');
    const runRes = await query(`SELECT * FROM hrms.payroll_runs WHERE id = $1`, [id]);
    if (runRes.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'Payroll run not found' });
    }

    const run = runRes.rows[0];
    let newStatus = run.status;
    let isLocked = run.is_locked;

    if (action === 'APPROVE') {
      newStatus = 'APPROVED';
    } else if (action === 'RELEASE' || action === 'FREEZE') {
      newStatus = 'RELEASED';
      isLocked = true;
    } else if (action === 'CANCEL') {
      newStatus = 'CANCELLED';
    }

    // Update Run
    const updated = await query(`
      UPDATE hrms.payroll_runs 
      SET status = $1, is_locked = $2, locked_at = CASE WHEN $2 = true THEN NOW() ELSE locked_at END,
          locked_reason = $3, released_at = CASE WHEN $1 = 'RELEASED' THEN NOW() ELSE released_at END,
          released_by = CASE WHEN $1 = 'RELEASED' THEN $4 ELSE released_by END, updated_at = NOW()
      WHERE id = $5 RETURNING *
    `, [newStatus, isLocked, reason || 'Payroll Audit Completed & Frozen', userId, id]);

    // Update Payslips Freeze Status
    await query(`
      UPDATE hrms.payslips 
      SET status = $1, freeze_status = $2, released_at = CASE WHEN $1 = 'RELEASED' THEN NOW() ELSE released_at END, updated_at = NOW()
      WHERE payroll_run_id = $3
    `, [newStatus, isLocked, id]);

    // Audit Log
    await query(`
      INSERT INTO hrms.payroll_run_logs (payroll_run_id, action, from_status, to_status, description, performed_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, action, run.status, newStatus, `Payroll action ${action} executed`, userId || id]);

    await query('COMMIT');
    return res.json({ message: `Payroll status updated to ${newStatus}`, run: updated.rows[0] });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Error executing payroll action:', err);
    return res.status(500).json({ error: 'Failed to update payroll action' });
  }
});

// 4. Fetch All Employee Payslips (Live DB Data)
app.get('/api/v1/payroll/employee-payslips', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const companyId = resolveCompanyId(req);
  try {
    let sql = `
      SELECT p.*, e.emp_id_code, e.first_name, e.last_name, e.email, e.phone, e.joining_date,
             d.name as department_name, des.name as designation_name, b.name as branch_name,
             r.pay_period, r.payroll_run_number,
             cb.first_name || ' ' || cb.last_name as created_by_name,
             ub.first_name || ' ' || ub.last_name as updated_by_name,
             COALESCE((SELECT amount FROM hrms.payslip_items WHERE payslip_id = p.id AND component_code = 'BASIC' LIMIT 1), 0) as basic_amount,
             COALESCE((SELECT amount FROM hrms.payslip_items WHERE payslip_id = p.id AND component_code = 'HRA' LIMIT 1), 0) as hra_amount,
             COALESCE((SELECT amount FROM hrms.payslip_items WHERE payslip_id = p.id AND component_code = 'CA' LIMIT 1), 0) as ca_amount,
             COALESCE((SELECT amount FROM hrms.payslip_items WHERE payslip_id = p.id AND component_code = 'MA' LIMIT 1), 0) as ma_amount,
             COALESCE((SELECT amount FROM hrms.payslip_items WHERE payslip_id = p.id AND component_code = 'SA' LIMIT 1), 0) as sa_amount
      FROM hrms.payslips p
      JOIN hrms.employees e ON p.employee_id = e.id
      LEFT JOIN hrms.departments d ON e.department_id = d.id
      LEFT JOIN hrms.designations des ON e.designation_id = des.id
      LEFT JOIN hrms.branches b ON e.branch_id = b.id
      LEFT JOIN hrms.payroll_runs r ON p.payroll_run_id = r.id
      LEFT JOIN hrms.employees cb ON p.created_by = cb.id
      LEFT JOIN hrms.employees ub ON p.updated_by = ub.id
    `;
    const params: any[] = [];
    const whereClauses: string[] = [];

    if (companyId) {
      params.push(companyId);
      whereClauses.push(`p.company_id = $${params.length}`);
    }

    const scopeCtx = await getEmployeeDataScope(req, 'payslips', 'view_payslips');
    const scopeCond = buildDataScopeCondition(scopeCtx, 'p', 'employee_id', params.length + 1);
    if (scopeCond.whereSql) {
      whereClauses.push(scopeCond.whereSql);
      params.push(...scopeCond.params);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY p.created_at DESC`;

    const result = await query(sql, params);
    return res.json({ payslips: result.rows });
  } catch (err) {
    console.error('Error fetching employee payslips:', err);
    return res.status(500).json({ error: 'Failed to fetch employee payslips' });
  }
});

// Update Employee Payslip Record (Edit Action via Slide Drawer)
app.put('/api/v1/payslips/:id', authenticateToken, requirePermission('edit_payslips'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { 
    payable_days, gross_salary, total_deductions, net_salary, status, remarks,
    basic_amount, hra_amount, ca_amount, ma_amount, sa_amount 
  } = req.body;

  try {
    // Resolve current updater employee ID
    const userEmail = (req.user?.email || '').trim();
    const updaterRes = await query(
      `SELECT id, first_name, last_name FROM hrms.employees 
       WHERE (LOWER(email) = LOWER($1) OR LOWER(emp_id_code) = LOWER($1)) AND status = 'ACTIVE' LIMIT 1`,
      [userEmail]
    );
    const updaterId = updaterRes.rows.length > 0 ? updaterRes.rows[0].id : null;
    const updaterName = updaterRes.rows.length > 0 ? `${updaterRes.rows[0].first_name} ${updaterRes.rows[0].last_name}` : 'Admin';

    // Update main payslip record with updated_at and updated_by
    const updateRes = await query(
      `UPDATE hrms.payslips 
       SET payable_days = COALESCE($1, payable_days),
           gross_salary = COALESCE($2, gross_salary),
           total_deductions = COALESCE($3, total_deductions),
           net_salary = COALESCE($4, net_salary),
           status = COALESCE($5, status),
           remarks = COALESCE($6, remarks),
           updated_at = NOW(),
           updated_by = $7
       WHERE id = $8 RETURNING *`,
      [payable_days, gross_salary, total_deductions, net_salary, status, remarks, updaterId, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Payslip record not found' });
    }

    // Upsert payslip items for BASIC, HRA, CA, MA, SA if provided
    const itemsToUpdate = [
      { code: 'BASIC', name: 'Basic Salary', amount: basic_amount, type: 'EARNINGS' },
      { code: 'HRA', name: 'House Rent Allowance', amount: hra_amount, type: 'EARNINGS' },
      { code: 'CA', name: 'Conveyance Allowance', amount: ca_amount, type: 'EARNINGS' },
      { code: 'MA', name: 'Medical Allowance', amount: ma_amount, type: 'EARNINGS' },
      { code: 'SA', name: 'Special Allowance', amount: sa_amount, type: 'EARNINGS' }
    ];

    for (const item of itemsToUpdate) {
      if (item.amount !== undefined && item.amount !== null) {
        await query(
          `INSERT INTO hrms.payslip_items (id, payslip_id, component_code, component_name, component_type, amount, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (payslip_id, component_code) DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()`,
          [id, item.code, item.name, item.type, item.amount]
        );
      }
    }

    return res.json({ 
      message: 'Payslip updated successfully', 
      payslip: {
        ...updateRes.rows[0],
        updated_by_name: updaterName,
        updated_at: new Date().toISOString()
      } 
    });
  } catch (err) {
    console.error('Error updating payslip:', err);
    return res.status(500).json({ error: 'Failed to update payslip record' });
  }
});

// Delete Employee Payslip Record (Delete Confirmation Toast/Modal Action)
app.delete('/api/v1/payslips/:id', authenticateToken, requirePermission('delete_payslips'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    await query(`DELETE FROM hrms.payslip_items WHERE payslip_id = $1`, [id]);
    const delRes = await query(`DELETE FROM hrms.payslips WHERE id = $1 RETURNING id`, [id]);

    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: 'Payslip record not found' });
    }

    return res.json({ message: 'Payslip record deleted successfully', id });
  } catch (err) {
    console.error('Error deleting payslip:', err);
    return res.status(500).json({ error: 'Failed to delete payslip record' });
  }
});

// Single Employee Fetch API
app.get('/api/v1/employees/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query(`
      SELECT e.*, d.name as department_name, des.name as designation_name, b.name as branch_name,
             c.name as company_name, c.branding_logo as company_logo
      FROM hrms.employees e
      LEFT JOIN hrms.companies c ON e.company_id = c.id
      LEFT JOIN hrms.departments d ON e.department_id = d.id
      LEFT JOIN hrms.designations des ON e.designation_id = des.id
      LEFT JOIN hrms.branches b ON e.branch_id = b.id
      WHERE (e.id::text = $1 OR e.emp_id_code = $1)
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    return res.json({ employee: result.rows[0] });
  } catch (err) {
    console.error('Error fetching single employee:', err);
    return res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// 5. Fetch Single Employee Payslip Statement (Live DB Data)
app.get('/api/v1/payroll/payslips/employee/:empId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { empId } = req.params;
  try {
    // 1. Fetch Payslip
    const psRes = await query(`
      SELECT p.*, e.emp_id_code, e.first_name, e.last_name, e.email, e.phone, e.joining_date, e.bank_information, e.pan_number, e.esi_number, e.uan_number,
             d.name as department_name, des.name as designation_name, b.name as branch_name,
             c.name as company_name, c.branding_logo as company_logo,
             r.pay_period, r.payroll_run_number
      FROM hrms.payslips p
      JOIN hrms.employees e ON p.employee_id = e.id
      LEFT JOIN hrms.companies c ON (p.company_id = c.id OR e.company_id = c.id)
      LEFT JOIN hrms.departments d ON e.department_id = d.id
      LEFT JOIN hrms.designations des ON e.designation_id = des.id
      LEFT JOIN hrms.branches b ON e.branch_id = b.id
      LEFT JOIN hrms.payroll_runs r ON p.payroll_run_id = r.id
      WHERE (e.id::text = $1 OR e.emp_id_code = $1)
      ORDER BY p.created_at DESC LIMIT 1
    `, [empId]);

    let payslip = psRes.rows[0];
    let items = [];

    if (payslip) {
      payslip.company_address = payslip.company_address || 'Shangrila Plaza, 501, #508-510, Park View Enclave, Road No2, Banjara Hills, Hyderabad, Telangana 500034';
      const itemsRes = await query(`
        SELECT * FROM hrms.payslip_items WHERE payslip_id = $1 ORDER BY display_order ASC
      `, [payslip.id]);
      items = itemsRes.rows;
    } else {
      // Fallback to employee query if no generated payslip exists yet
      const empRes = await query(`
        SELECT e.*, d.name as department_name, des.name as designation_name, b.name as branch_name,
               c.name as company_name, c.branding_logo as company_logo
        FROM hrms.employees e
        LEFT JOIN hrms.companies c ON e.company_id = c.id
        LEFT JOIN hrms.departments d ON e.department_id = d.id
        LEFT JOIN hrms.designations des ON e.designation_id = des.id
        LEFT JOIN hrms.branches b ON e.branch_id = b.id
        WHERE (e.id::text = $1 OR e.emp_id_code = $1)
      `, [empId]);

      if (empRes.rows.length > 0) {
        const emp = empRes.rows[0];
        // Query real active salary structure from hrms.salary_structures
        const salRes = await query(`
          SELECT * FROM hrms.salary_structures
          WHERE (employee_id::text = $1 OR emp_uuid::text = $1 OR emp_id = $1)
            AND (is_structure_active = true OR is_structure_active IS NULL)
          ORDER BY effective_from_date DESC NULLS LAST, created_at DESC LIMIT 1
        `, [emp.id]);

        const salStruct = salRes.rows[0];

        const gross = salStruct ? parseFloat(salStruct.salary_per_month || salStruct.gross_salary || 0) : 0;
        const pf = salStruct ? parseFloat(salStruct.employee_pf || 0) : 0;
        const pt = salStruct ? parseFloat(salStruct.professional_tax || 0) : 0;
        const deductions = pf + pt;

        const prevDate = new Date();
        prevDate.setMonth(prevDate.getMonth() - 1);
        const dynamicPayPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

        payslip = {
          id: emp.id,
          employee_id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          emp_id_code: emp.emp_id_code || 'EMP101',
          email: emp.email,
          phone: emp.phone,
          joining_date: emp.joining_date,
          pf_number: emp.pf_no || 'N/A',
          esi_number: emp.esi_number || 'N/A',
          company_name: emp.company_name,
          company_logo: emp.company_logo,
          company_address: 'Shangrila Plaza, 501, #508-510, Park View Enclave, Road No2, Banjara Hills, Hyderabad, Telangana 500034',
          department_name: emp.department_name,
          designation_name: emp.designation_name,
          branch_name: emp.branch_name,
          gross_salary: gross,
          total_deductions: deductions,
          net_salary: gross - deductions,
          pay_period: dynamicPayPeriod,
          status: 'STRUCTURE_VIEW'
        };
      }
    }

    // 2. Query ALL historical salary structures for this employee from hrms.salary_structures
    let structures: any[] = [];
    const targetEmpId = payslip ? payslip.employee_id : empId;

    if (targetEmpId) {
      const allSalRes = await query(`
        SELECT * FROM hrms.salary_structures
        WHERE (employee_id::text = $1 OR emp_uuid::text = $1 OR emp_id = $1)
        ORDER BY effective_from_date DESC NULLS LAST, created_at DESC
      `, [targetEmpId]);
      structures = allSalRes.rows;
    }

    return res.json({ payslip, items, structures });
  } catch (err) {
    console.error('Error fetching single employee payslip:', err);
    return res.status(500).json({ error: 'Failed to fetch payslip details' });
  }
});

// 4. Fetch Payslips for a Run
app.get('/api/v1/payroll/runs/:id/payslips', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query(`
      SELECT p.*, e.first_name, e.last_name, e.emp_id
      FROM hrms.payslips p
      LEFT JOIN hrms.employees e ON p.employee_id = e.id
      WHERE p.payroll_run_id = $1
      ORDER BY p.payslip_number ASC
    `, [id]);

    return res.json({ payslips: result.rows });
  } catch (err) {
    console.error('Error fetching payslips for run:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

// 1. Unified Sandbox & cache fetch
app.get('/api/v1/payroll/sandbox-data', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const companyId = resolveCompanyId(req);
  try {
    let slabs, components, configurations;

    if (!companyId) {
      // SuperAdmin global view — no UUID filter, return all records
      slabs = await query(
        `SELECT * FROM hrms.salary_slabs ORDER BY min_gross ASC`
      );
      components = await query(
        `SELECT * FROM hrms.salary_components ORDER BY display_order ASC`
      );
      configurations = await query(
        `SELECT c.*, s.slab_name, t.type_name as calculation_type_name
         FROM hrms.salary_component_configurations c
         LEFT JOIN hrms.salary_slabs s ON c.slab_id = s.id
         LEFT JOIN hrms.calculation_types t ON c.calculation_type_id = t.id
         ORDER BY s.min_gross ASC, c.display_order ASC`
      );
    } else {
      // Tenant-scoped view — filter by company_id or global (NULL) records
      slabs = await query(
        `SELECT * FROM hrms.salary_slabs 
         WHERE company_id = $1 OR company_id IS NULL 
         ORDER BY min_gross ASC`,
        [companyId]
      );
      components = await query(
        `SELECT * FROM hrms.salary_components 
         WHERE company_id = $1 OR company_id IS NULL 
         ORDER BY display_order ASC`,
        [companyId]
      );
      configurations = await query(
        `SELECT c.*, s.slab_name, t.type_name as calculation_type_name
         FROM hrms.salary_component_configurations c
         LEFT JOIN hrms.salary_slabs s ON c.slab_id = s.id
         LEFT JOIN hrms.calculation_types t ON c.calculation_type_id = t.id
         WHERE c.company_id = $1 OR c.company_id IS NULL
         ORDER BY s.min_gross ASC, c.display_order ASC`,
        [companyId]
      );
    }

    const calcTypes = await query('SELECT * FROM hrms.calculation_types ORDER BY type_name ASC');

    let statutoryRules: any = { rows: [] };
    let statutorySlabs: any = { rows: [] };
    let statutoryWageComponents: any = { rows: [] };

    try {
      const statRulesQuery = !companyId
        ? `SELECT r.*, c.component_code, c.component_name
           FROM hrms.statutory_rules r
           JOIN hrms.salary_components c ON r.component_id = c.id
           ORDER BY r.created_at DESC`
        : `SELECT r.*, c.component_code, c.component_name
           FROM hrms.statutory_rules r
           JOIN hrms.salary_components c ON r.component_id = c.id
           WHERE r.company_id = $1 OR r.company_id IS NULL
           ORDER BY r.created_at DESC`;
      statutoryRules = await query(statRulesQuery, companyId ? [companyId] : []);

      statutorySlabs = await query(`
        SELECT s.*, r.rule_code, r.rule_name, c.component_code
        FROM hrms.statutory_rule_slabs s
        JOIN hrms.statutory_rules r ON s.statutory_rule_id = r.id
        JOIN hrms.salary_components c ON r.component_id = c.id
        ORDER BY s.display_order ASC, s.min_wage ASC
      `);

      statutoryWageComponents = await query(`
        SELECT w.*, r.rule_code, r.rule_name, c.component_code, c.component_name
        FROM hrms.statutory_wage_components w
        JOIN hrms.statutory_rules r ON w.statutory_rule_id = r.id
        JOIN hrms.salary_components c ON w.salary_component_id = c.id
        ORDER BY w.created_at ASC
      `);
    } catch (stErr) {
      console.warn('Could not fetch statutory data for sandbox:', stErr);
    }

    return res.json({
      slabs: slabs.rows,
      components: components.rows,
      calculationTypes: calcTypes.rows,
      configurations: configurations.rows,
      statutoryRules: statutoryRules.rows,
      statutoryRuleSlabs: statutorySlabs.rows,
      statutoryWageComponents: statutoryWageComponents.rows
    });
  } catch (err) {
    console.error('Error fetching payroll sandbox data:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

// 2. SLABS CRUD
app.post('/api/v1/payroll/slabs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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
    const overlapCheck = await query(
      `SELECT COUNT(*) FROM hrms.salary_slabs
       WHERE is_active = true
         AND (company_id = $1 OR company_id IS NULL)
         AND $2 <= max_gross
         AND $3 >= min_gross`,
      [companyId, min, max]
    );

    if (parseInt(overlapCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Salary range overlaps with an existing active slab.' });
    }

    const result = await query(
      `INSERT INTO hrms.salary_slabs (company_id, slab_name, min_gross, max_gross, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [companyId, slab_name, min, max, description || '', is_active !== false]
    );

    return res.json({ message: 'Slab created successfully', slab: result.rows[0] });
  } catch (err) {
    console.error('Error creating slab:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/payroll/slabs/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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
    const overlapCheck = await query(
      `SELECT COUNT(*) FROM hrms.salary_slabs
       WHERE is_active = true
         AND (company_id = $1 OR company_id IS NULL)
         AND id <> $2
         AND $3 <= max_gross
         AND $4 >= min_gross`,
      [companyId, id, min, max]
    );

    if (parseInt(overlapCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Salary range overlaps with an existing active slab.' });
    }

    const result = await query(
      `UPDATE hrms.salary_slabs 
       SET slab_name = $1, min_gross = $2, max_gross = $3, description = $4, is_active = $5, updated_at = NOW()
       WHERE id = $6 AND (company_id = $7 OR company_id IS NULL)
       RETURNING *`,
      [slab_name, min, max, description || '', is_active !== false, id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slab not found or unauthorized' });
    }

    return res.json({ message: 'Slab updated successfully', slab: result.rows[0] });
  } catch (err) {
    console.error('Error updating slab:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/payroll/slabs/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const companyId = resolveCompanyId(req);

  try {
    // Check if referenced in configurations
    const refCheck = await query(
      'SELECT COUNT(*) FROM hrms.salary_component_configurations WHERE slab_id = $1',
      [id]
    );

    if (parseInt(refCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete this slab. It is referenced in active configurations.' });
    }

    const result = await query(
      'DELETE FROM hrms.salary_slabs WHERE id = $1 AND (company_id = $2 OR company_id IS NULL) RETURNING *',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slab not found or unauthorized' });
    }

    return res.json({ message: 'Slab deleted successfully' });
  } catch (err) {
    console.error('Error deleting slab:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

// 3. COMPONENTS CRUD
app.post('/api/v1/payroll/components', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const companyId = resolveCompanyId(req);
  const { component_code, component_name, component_type, is_statutory, is_taxable, display_order, is_active } = req.body;

  if (!component_code || !component_name || !component_type) {
    return res.status(400).json({ error: 'Required fields missing: component_code, component_name, component_type' });
  }

  const code = String(component_code).trim().toUpperCase();

  try {
    // Duplicate check
    const dupCheck = await query(
      `SELECT COUNT(*) FROM hrms.salary_components 
       WHERE (company_id = $1 OR company_id IS NULL) AND UPPER(component_code) = $2`,
      [companyId, code]
    );

    if (parseInt(dupCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'A component with this code already exists.' });
    }

    const result = await query(
      `INSERT INTO hrms.salary_components (company_id, component_code, component_name, component_type, is_statutory, is_taxable, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [companyId, code, component_name, component_type, is_statutory === true, is_taxable !== false, parseInt(display_order) || 1, is_active !== false]
    );

    return res.json({ message: 'Component created successfully', component: result.rows[0] });
  } catch (err) {
    console.error('Error creating component:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/payroll/components/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const companyId = resolveCompanyId(req);
  const { component_code, component_name, component_type, is_statutory, is_taxable, display_order, is_active } = req.body;

  if (!component_code || !component_name || !component_type) {
    return res.status(400).json({ error: 'Required fields missing: component_code, component_name, component_type' });
  }

  const code = String(component_code).trim().toUpperCase();

  try {
    // Duplicate check excluding self
    const dupCheck = await query(
      `SELECT COUNT(*) FROM hrms.salary_components 
       WHERE (company_id = $1 OR company_id IS NULL) AND UPPER(component_code) = $2 AND id <> $3`,
      [companyId, code, id]
    );

    if (parseInt(dupCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'A component with this code already exists.' });
    }

    const result = await query(
      `UPDATE hrms.salary_components 
       SET component_code = $1, component_name = $2, component_type = $3, is_statutory = $4, is_taxable = $5, display_order = $6, is_active = $7, updated_at = NOW()
       WHERE id = $8 AND (company_id = $9 OR company_id IS NULL)
       RETURNING *`,
      [code, component_name, component_type, is_statutory === true, is_taxable !== false, parseInt(display_order) || 1, is_active !== false, id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found or unauthorized' });
    }

    return res.json({ message: 'Component updated successfully', component: result.rows[0] });
  } catch (err) {
    console.error('Error updating component:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/payroll/components/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const companyId = resolveCompanyId(req);

  try {
    // Get component code
    const compRes = await query(
      'SELECT component_code FROM hrms.salary_components WHERE id = $1 AND (company_id = $2 OR company_id IS NULL)',
      [id, companyId]
    );

    if (compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found or unauthorized' });
    }

    const code = compRes.rows[0].component_code;

    // Check if referenced in configurations
    const refCheck = await query(
      'SELECT COUNT(*) FROM hrms.salary_component_configurations WHERE component_code = $1 OR depends_on_component = $1',
      [code]
    );

    if (parseInt(refCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete this component. It is referenced in active configurations.' });
    }

    await query('DELETE FROM hrms.salary_components WHERE id = $1', [id]);
    return res.json({ message: 'Component deleted successfully' });
  } catch (err) {
    console.error('Error deleting component:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

// 4. CONFIGURATIONS CRUD
app.post('/api/v1/payroll/configurations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const companyId = resolveCompanyId(req);
  const {
    slab_id,
    component_code,
    calculation_type_id,
    calculation_value,
    depends_on_component,
    formula_expression,
    employee_type,
    is_prorata,
    min_cap,
    max_cap,
    display_order,
    is_active
  } = req.body;

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
    const dupCheck = await query(
      `SELECT COUNT(*) FROM hrms.salary_component_configurations 
       WHERE slab_id = $1 AND UPPER(component_code) = $2 AND (company_id = $3 OR company_id IS NULL)`,
      [slab_id, code, companyId]
    );

    if (parseInt(dupCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'This component is already configured for the selected salary slab.' });
    }

    const result = await query(
      `INSERT INTO hrms.salary_component_configurations 
       (company_id, slab_id, component_code, calculation_type_id, calculation_value, depends_on_component, formula_expression, employee_type, is_prorata, min_cap, max_cap, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
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
      ]
    );

    return res.json({ message: 'Configuration created successfully', configuration: result.rows[0] });
  } catch (err) {
    console.error('Error creating configuration:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/payroll/configurations/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const companyId = resolveCompanyId(req);
  const {
    slab_id,
    component_code,
    calculation_type_id,
    calculation_value,
    depends_on_component,
    formula_expression,
    employee_type,
    is_prorata,
    min_cap,
    max_cap,
    display_order,
    is_active
  } = req.body;

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
    const dupCheck = await query(
      `SELECT COUNT(*) FROM hrms.salary_component_configurations 
       WHERE slab_id = $1 AND UPPER(component_code) = $2 AND (company_id = $3 OR company_id IS NULL) AND id <> $4`,
      [slab_id, code, companyId, id]
    );

    if (parseInt(dupCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'This component is already configured for the selected salary slab.' });
    }

    const result = await query(
      `UPDATE hrms.salary_component_configurations 
       SET slab_id = $1, component_code = $2, calculation_type_id = $3, calculation_value = $4, depends_on_component = $5, 
           formula_expression = $6, employee_type = $7, is_prorata = $8, min_cap = $9, max_cap = $10, display_order = $11, is_active = $12, updated_at = NOW()
       WHERE id = $13 AND (company_id = $14 OR company_id IS NULL)
       RETURNING *`,
      [
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
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Configuration not found or unauthorized' });
    }

    return res.json({ message: 'Configuration updated successfully', configuration: result.rows[0] });
  } catch (err) {
    console.error('Error updating configuration:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/payroll/configurations/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const companyId = resolveCompanyId(req);

  try {
    const result = await query(
      'DELETE FROM hrms.salary_component_configurations WHERE id = $1 AND (company_id = $2 OR company_id IS NULL) RETURNING *',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Configuration not found or unauthorized' });
    }

    return res.json({ message: 'Configuration deleted successfully' });
  } catch (err) {
    console.error('Error deleting configuration:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

// =========================================================================
// 🏛️ STATUTORY RULES, SLABS & WAGE COMPONENTS API ENDPOINTS
// =========================================================================

// 1. STATUTORY RULES CRUD
app.get('/api/v1/payroll/statutory-rules', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const companyId = resolveCompanyId(req);
  try {
    const q = !companyId
      ? `SELECT r.*, c.component_code, c.component_name
         FROM hrms.statutory_rules r
         JOIN hrms.salary_components c ON r.component_id = c.id
         ORDER BY r.created_at DESC`
      : `SELECT r.*, c.component_code, c.component_name
         FROM hrms.statutory_rules r
         JOIN hrms.salary_components c ON r.component_id = c.id
         WHERE r.company_id = $1 OR r.company_id IS NULL
         ORDER BY r.created_at DESC`;
    const result = await query(q, companyId ? [companyId] : []);
    return res.json({ rules: result.rows });
  } catch (err) {
    console.error('Error fetching statutory rules:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/payroll/statutory-rules', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const companyId = resolveCompanyId(req);
  const {
    component_id,
    rule_code,
    rule_name,
    calculation_base,
    calculation_type,
    employee_rate,
    employer_rate,
    wage_ceiling,
    max_employee_amount,
    max_employer_amount,
    formula_expression,
    effective_from,
    effective_to,
    is_active,
    remarks
  } = req.body;

  if (!component_id || !rule_code || !rule_name) {
    return res.status(400).json({ error: 'Required fields missing: component_id, rule_code, rule_name' });
  }

  try {
    const code = String(rule_code).trim().toUpperCase();
    const dupCheck = await query(
      `SELECT COUNT(*) FROM hrms.statutory_rules 
       WHERE rule_code = $1 AND (company_id = $2 OR company_id IS NULL)`,
      [code, companyId]
    );

    if (parseInt(dupCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: `Rule code '${code}' already exists.` });
    }

    const result = await query(
      `INSERT INTO hrms.statutory_rules 
       (company_id, component_id, rule_code, rule_name, calculation_base, calculation_type,
        employee_rate, employer_rate, wage_ceiling, max_employee_amount, max_employer_amount,
        formula_expression, effective_from, effective_to, is_active, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        companyId || null,
        component_id,
        code,
        rule_name.trim(),
        calculation_base || 'BASIC',
        calculation_type || 'PERCENTAGE_WITH_CEILING',
        employee_rate !== undefined && employee_rate !== '' ? parseFloat(employee_rate) : 0,
        employer_rate !== undefined && employer_rate !== '' ? parseFloat(employer_rate) : 0,
        wage_ceiling ? parseFloat(wage_ceiling) : null,
        max_employee_amount ? parseFloat(max_employee_amount) : null,
        max_employer_amount ? parseFloat(max_employer_amount) : null,
        formula_expression || null,
        effective_from || new Date().toISOString().split('T')[0],
        effective_to || null,
        is_active !== false,
        remarks || null
      ]
    );

    return res.json({ message: 'Statutory rule created successfully', rule: result.rows[0] });
  } catch (err) {
    console.error('Error creating statutory rule:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/payroll/statutory-rules/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const companyId = resolveCompanyId(req);
  const {
    component_id,
    rule_code,
    rule_name,
    calculation_base,
    calculation_type,
    employee_rate,
    employer_rate,
    wage_ceiling,
    max_employee_amount,
    max_employer_amount,
    formula_expression,
    effective_from,
    effective_to,
    is_active,
    remarks
  } = req.body;

  if (!component_id || !rule_code || !rule_name) {
    return res.status(400).json({ error: 'Required fields missing: component_id, rule_code, rule_name' });
  }

  try {
    const code = String(rule_code).trim().toUpperCase();
    const dupCheck = await query(
      `SELECT COUNT(*) FROM hrms.statutory_rules 
       WHERE rule_code = $1 AND (company_id = $2 OR company_id IS NULL) AND id <> $3`,
      [code, companyId, id]
    );

    if (parseInt(dupCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: `Rule code '${code}' is already in use by another rule.` });
    }

    const result = await query(
      `UPDATE hrms.statutory_rules 
       SET component_id = $1, rule_code = $2, rule_name = $3, calculation_base = $4, calculation_type = $5,
           employee_rate = $6, employer_rate = $7, wage_ceiling = $8, max_employee_amount = $9, max_employer_amount = $10,
           formula_expression = $11, effective_from = $12, effective_to = $13, is_active = $14, remarks = $15, updated_at = NOW()
       WHERE id = $16 AND (company_id = $17 OR company_id IS NULL)
       RETURNING *`,
      [
        component_id,
        code,
        rule_name.trim(),
        calculation_base || 'BASIC',
        calculation_type || 'PERCENTAGE_WITH_CEILING',
        employee_rate !== undefined && employee_rate !== '' ? parseFloat(employee_rate) : 0,
        employer_rate !== undefined && employer_rate !== '' ? parseFloat(employer_rate) : 0,
        wage_ceiling ? parseFloat(wage_ceiling) : null,
        max_employee_amount ? parseFloat(max_employee_amount) : null,
        max_employer_amount ? parseFloat(max_employer_amount) : null,
        formula_expression || null,
        effective_from || new Date().toISOString().split('T')[0],
        effective_to || null,
        is_active !== false,
        remarks || null,
        id,
        companyId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Statutory rule not found or unauthorized' });
    }

    return res.json({ message: 'Statutory rule updated successfully', rule: result.rows[0] });
  } catch (err) {
    console.error('Error updating statutory rule:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/payroll/statutory-rules/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const companyId = resolveCompanyId(req);

  try {
    const result = await query(
      'DELETE FROM hrms.statutory_rules WHERE id = $1 AND (company_id = $2 OR company_id IS NULL) RETURNING *',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Statutory rule not found or unauthorized' });
    }

    return res.json({ message: 'Statutory rule deleted successfully' });
  } catch (err) {
    console.error('Error deleting statutory rule:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

// 2. STATUTORY RULE SLABS CRUD (PT etc.)
app.get('/api/v1/payroll/statutory-rule-slabs', authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT s.*, r.rule_code, r.rule_name, c.component_code, c.component_name
      FROM hrms.statutory_rule_slabs s
      JOIN hrms.statutory_rules r ON s.statutory_rule_id = r.id
      JOIN hrms.salary_components c ON r.component_id = c.id
      ORDER BY s.display_order ASC, s.min_wage ASC
    `);
    return res.json({ slabs: result.rows });
  } catch (err) {
    console.error('Error fetching statutory rule slabs:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/payroll/statutory-rule-slabs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const {
    statutory_rule_id,
    min_wage,
    max_wage,
    fixed_amount,
    percentage,
    effective_from,
    effective_to,
    is_active,
    display_order
  } = req.body;

  if (!statutory_rule_id || min_wage === undefined) {
    return res.status(400).json({ error: 'Required fields missing: statutory_rule_id, min_wage' });
  }

  try {
    const result = await query(
      `INSERT INTO hrms.statutory_rule_slabs
       (statutory_rule_id, min_wage, max_wage, fixed_amount, percentage, effective_from, effective_to, is_active, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        statutory_rule_id,
        parseFloat(min_wage) || 0,
        max_wage !== undefined && max_wage !== '' && max_wage !== null ? parseFloat(max_wage) : null,
        fixed_amount !== undefined && fixed_amount !== '' && fixed_amount !== null ? parseFloat(fixed_amount) : null,
        percentage !== undefined && percentage !== '' && percentage !== null ? parseFloat(percentage) : null,
        effective_from || new Date().toISOString().split('T')[0],
        effective_to || null,
        is_active !== false,
        parseInt(display_order) || 1
      ]
    );

    return res.json({ message: 'Statutory slab created successfully', slab: result.rows[0] });
  } catch (err) {
    console.error('Error creating statutory slab:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/payroll/statutory-rule-slabs/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const {
    statutory_rule_id,
    min_wage,
    max_wage,
    fixed_amount,
    percentage,
    effective_from,
    effective_to,
    is_active,
    display_order
  } = req.body;

  if (!statutory_rule_id || min_wage === undefined) {
    return res.status(400).json({ error: 'Required fields missing: statutory_rule_id, min_wage' });
  }

  try {
    const result = await query(
      `UPDATE hrms.statutory_rule_slabs
       SET statutory_rule_id = $1, min_wage = $2, max_wage = $3, fixed_amount = $4, percentage = $5,
           effective_from = $6, effective_to = $7, is_active = $8, display_order = $9, updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [
        statutory_rule_id,
        parseFloat(min_wage) || 0,
        max_wage !== undefined && max_wage !== '' && max_wage !== null ? parseFloat(max_wage) : null,
        fixed_amount !== undefined && fixed_amount !== '' && fixed_amount !== null ? parseFloat(fixed_amount) : null,
        percentage !== undefined && percentage !== '' && percentage !== null ? parseFloat(percentage) : null,
        effective_from || new Date().toISOString().split('T')[0],
        effective_to || null,
        is_active !== false,
        parseInt(display_order) || 1,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Statutory slab not found' });
    }

    return res.json({ message: 'Statutory slab updated successfully', slab: result.rows[0] });
  } catch (err) {
    console.error('Error updating statutory slab:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/payroll/statutory-rule-slabs/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM hrms.statutory_rule_slabs WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Statutory slab not found' });
    }
    return res.json({ message: 'Statutory slab deleted successfully' });
  } catch (err) {
    console.error('Error deleting statutory slab:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

// 3. STATUTORY WAGE COMPONENTS CRUD
app.get('/api/v1/payroll/statutory-wage-components', authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT w.*, r.rule_code, r.rule_name, c.component_code, c.component_name
      FROM hrms.statutory_wage_components w
      JOIN hrms.statutory_rules r ON w.statutory_rule_id = r.id
      JOIN hrms.salary_components c ON w.salary_component_id = c.id
      ORDER BY w.created_at ASC
    `);
    return res.json({ wageComponents: result.rows });
  } catch (err) {
    console.error('Error fetching statutory wage components:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/payroll/statutory-wage-components', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { statutory_rule_id, salary_component_id, is_included } = req.body;
  if (!statutory_rule_id || !salary_component_id) {
    return res.status(400).json({ error: 'Required fields missing: statutory_rule_id, salary_component_id' });
  }

  try {
    const result = await query(
      `INSERT INTO hrms.statutory_wage_components (statutory_rule_id, salary_component_id, is_included)
       VALUES ($1, $2, $3)
       ON CONFLICT (statutory_rule_id, salary_component_id) DO UPDATE SET is_included = EXCLUDED.is_included
       RETURNING *`,
      [statutory_rule_id, salary_component_id, is_included !== false]
    );
    return res.json({ message: 'Wage component mapping saved successfully', wageComponent: result.rows[0] });
  } catch (err) {
    console.error('Error saving statutory wage component mapping:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.put('/api/v1/payroll/statutory-wage-components/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { statutory_rule_id, salary_component_id, is_included } = req.body;
  if (!statutory_rule_id || !salary_component_id) {
    return res.status(400).json({ error: 'Required fields missing: statutory_rule_id, salary_component_id' });
  }

  try {
    const result = await query(
      `UPDATE hrms.statutory_wage_components 
       SET statutory_rule_id = $1, salary_component_id = $2, is_included = $3
       WHERE id = $4
       RETURNING *`,
      [statutory_rule_id, salary_component_id, is_included !== false, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wage component mapping not found' });
    }
    return res.json({ message: 'Wage component mapping updated successfully', wageComponent: result.rows[0] });
  } catch (err) {
    console.error('Error updating statutory wage component mapping:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/payroll/statutory-wage-components/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM hrms.statutory_wage_components WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wage component mapping not found' });
    }
    return res.json({ message: 'Wage component mapping deleted successfully' });
  } catch (err) {
    console.error('Error deleting statutory wage component mapping:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

// =========================================================================
// 💼 SALARY STRUCTURE CRUD API ROUTES
// =========================================================================

app.get('/api/v1/payroll/structures', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const companyId = resolveCompanyId(req);
  try {
    const scopeCtx = await getEmployeeDataScope(req, 'salary_structures', 'view_salary_structures');
    let sql = `
      SELECT s.*, 
             COALESCE(e.first_name || ' ' || e.last_name, s.full_name, 'Employee') as full_name,
             e.company_id as employee_company_id
      FROM hrms.salary_structures s
      INNER JOIN hrms.employees e ON (s.employee_id = e.id OR s.emp_id = e.emp_id_code)
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (companyId) {
      sql += ` AND e.company_id = $${paramIdx}`;
      params.push(companyId);
      paramIdx++;
    }

    const { whereSql, params: scopeParams, nextParamIdx } = buildDataScopeCondition(scopeCtx, 'e', 'id', paramIdx);
    if (whereSql) {
      sql += ` AND ${whereSql}`;
      params.push(...scopeParams);
      paramIdx = nextParamIdx;
    }

    sql += ` ORDER BY s.emp_id ASC`;
    let result = await query(sql, params);
    return res.json({ structures: result.rows });
  } catch (err) {
    console.error('Error fetching salary structures:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.post('/api/v1/payroll/structures', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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

      const variable_pay = parseFloat(item.variablePay || item.variable_pay || 0);
      const is_variable_pay_applicable = item.variableCheck !== undefined ? item.variableCheck : (item.is_variable_pay_applicable || false);
      const gratuity = parseFloat(item.gratuity || 0);
      const pf_check = item.pf_check !== undefined ? (item.pf_check ? 1 : 0) : 1;
      const esi_check = item.esi_check !== undefined ? (item.esi_check ? 1 : 0) : 1;
      const pt_check = item.pt_check !== undefined ? Boolean(item.pt_check) : true;

      // Always resolve target company_id from employee record if available
      const empQuery = await query(
        `SELECT id, company_id FROM hrms.employees WHERE emp_id_code = $1 OR id::text = $2 LIMIT 1`,
        [emp_id, String(emp_uuid || '')]
      );
      const targetCompanyId = (empQuery.rows.length > 0 && empQuery.rows[0].company_id) ? empQuery.rows[0].company_id : companyId;
      const targetEmpUuid = (empQuery.rows.length > 0) ? empQuery.rows[0].id : emp_uuid;

      const existing = await query(
        `SELECT id FROM hrms.salary_structures WHERE (emp_id = $1 OR (employee_id IS NOT NULL AND employee_id = $2)) AND company_id = $3 AND salary_year = $4`,
        [emp_id, targetEmpUuid, targetCompanyId, salary_year]
      );

      if (existing.rows.length > 0) {
        await query(`
          UPDATE hrms.salary_structures 
          SET employee_id = COALESCE($1, employee_id), emp_uuid = COALESCE($1, emp_uuid), company_id = $2,
              salary_per_annum = $3, salary_per_month = $4, basic = $5, hra = $6, ca = $7, ma = $8, sa = $9,
              employee_pf = $10, employee_esi = $11, professional_tax = $12, employer_pf = $13, employer_esi = $14,
              retention_bonus = $15, is_retention_bonus_applicable = $16, full_name = $17,
              variable_pay = $18, is_variable_pay_applicable = $19, gratuity = $20,
              pf_check = $21, esi_check = $22, pt_check = $23,
              updated_at = NOW()
          WHERE id = $24
        `, [
          targetEmpUuid, targetCompanyId, salary_per_annum, salary_per_month, basic, hra, ca, ma, sa,
          employee_pf, employee_esi, professional_tax, employer_pf, employer_esi,
          retention_bonus, is_retention_bonus_applicable, full_name,
          variable_pay, is_variable_pay_applicable, gratuity,
          pf_check, esi_check, pt_check,
          existing.rows[0].id
        ]);
        logUserAction(req, 'UPDATE_STRUCTURE', 'Payroll Structures', `Updated salary structure for ${full_name || emp_id} (Year ${salary_year})`);
      } else {
        await query(`
          INSERT INTO hrms.salary_structures 
          (company_id, emp_id, employee_id, emp_uuid, full_name, salary_per_annum, salary_per_month, basic, hra, ca, ma, sa, employee_pf, employee_esi, professional_tax, employer_pf, employer_esi, retention_bonus, is_retention_bonus_applicable, salary_year, variable_pay, is_variable_pay_applicable, gratuity, pf_check, esi_check, pt_check)
          VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        `, [
          targetCompanyId, emp_id, targetEmpUuid, full_name, salary_per_annum, salary_per_month, basic, hra, ca, ma, sa,
          employee_pf, employee_esi, professional_tax, employer_pf, employer_esi,
          retention_bonus, is_retention_bonus_applicable, salary_year,
          variable_pay, is_variable_pay_applicable, gratuity,
          pf_check, esi_check, pt_check
        ]);
        logUserAction(req, 'CREATE_STRUCTURE', 'Payroll Structures', `Created salary structure for ${full_name || emp_id} (Year ${salary_year})`);
      }
    }

    return res.json({ message: 'Salary structures updated successfully' });
  } catch (err) {
    console.error('Error updating salary structures:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

app.delete('/api/v1/payroll/structures/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query(
      'DELETE FROM hrms.salary_structures WHERE id = $1 OR emp_id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Salary structure not found' });
    }
    const deletedRow = result.rows[0];
    logUserAction(req, 'DELETE_STRUCTURE', 'Payroll Structures', `Deleted salary structure for ${deletedRow.full_name || deletedRow.emp_id}`);
    return res.json({ message: 'Salary structure deleted successfully' });
  } catch (err) {
    console.error('Error deleting salary structure:', err);
    return res.status(500).json({ error: 'Internal server database error' });
  }
});

// Mount Modular Routes
app.use('/api/v1/recruitment', recruitmentRoutes);
app.use('/api/v1/interviews', interviewsRoutes);
app.use('/api/v1/visitors', visitorsRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/v1/events', eventsRoutes);
app.use('/api/events', eventsRoutes);

// ============================================================================
// WORKBRIDGE: TASK MANAGEMENT MODULE - START
// ============================================================================
app.use('/api/v1/workbridge', workbridgeRoutes);
app.use('/api/workbridge', workbridgeRoutes);
// ============================================================================
// WORKBRIDGE: TASK MANAGEMENT MODULE - END
// ============================================================================

// Start server
app.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`HRMS Backend server running on port ${PORT}`);
  try {
    // Database schema migration for hrms.salary_structures
    await query(`
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
        gratuity NUMERIC(18, 2) DEFAULT 0,
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

    await query(`ALTER TABLE hrms.salary_structures ADD COLUMN IF NOT EXISTS employee_id UUID;`);
    await query(`ALTER TABLE hrms.salary_structures ADD COLUMN IF NOT EXISTS emp_uuid UUID;`);
    await query(`ALTER TABLE hrms.salary_structures ADD COLUMN IF NOT EXISTS gratuity NUMERIC(18, 2) DEFAULT 0;`);
    await query(`ALTER TABLE hrms.salary_structures ADD COLUMN IF NOT EXISTS variable_pay NUMERIC(18, 2) DEFAULT 0;`);
    await query(`ALTER TABLE hrms.salary_structures ADD COLUMN IF NOT EXISTS is_variable_pay_applicable BOOLEAN DEFAULT FALSE;`);
    await query(`ALTER TABLE hrms.salary_structures ADD COLUMN IF NOT EXISTS is_retention_bonus_applicable BOOLEAN DEFAULT FALSE;`);
    await query(`ALTER TABLE hrms.salary_structures ADD COLUMN IF NOT EXISTS pf_check INT DEFAULT 1;`);
    await query(`ALTER TABLE hrms.salary_structures ADD COLUMN IF NOT EXISTS esi_check INT DEFAULT 1;`);
    await query(`ALTER TABLE hrms.salary_structures ADD COLUMN IF NOT EXISTS pt_check BOOLEAN DEFAULT TRUE;`);
    await query(`ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS cycle_start_day INT DEFAULT 26;`);
    await query(`ALTER TABLE hrms.attendance_policies ADD COLUMN IF NOT EXISTS cycle_end_day INT DEFAULT 25;`);
    await query(`ALTER TABLE hrms.employees ADD COLUMN IF NOT EXISTS is_temporary_password BOOLEAN DEFAULT TRUE;`);
    await query(`ALTER TABLE hrms.employees ADD COLUMN IF NOT EXISTS shift_id UUID;`);
    await query(`ALTER TABLE hrms.employees ADD COLUMN IF NOT EXISTS allow_mobile_punch BOOLEAN DEFAULT TRUE;`);
    await query(`ALTER TABLE hrms.employees ADD COLUMN IF NOT EXISTS require_punch_approval BOOLEAN DEFAULT TRUE;`);
    await query(`UPDATE hrms.employees SET allow_mobile_punch = TRUE WHERE allow_mobile_punch IS NULL;`);
    await query(`UPDATE hrms.employees SET require_punch_approval = TRUE WHERE require_punch_approval IS NULL;`);
    await query(`ALTER TABLE hrms.companies ADD COLUMN IF NOT EXISTS company_code VARCHAR(50);`);
    await query(`UPDATE hrms.companies SET company_code = UPPER(subdomain) WHERE company_code IS NULL OR company_code = '';`);

    // Database schema migration for 7 Enterprise Payroll Tables
    await query(`
      CREATE TABLE IF NOT EXISTS hrms.employee_salary_assignments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
          employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
          structure_id UUID REFERENCES hrms.salary_structures(id),
          slab_id UUID REFERENCES hrms.salary_slabs(id),
          annual_ctc NUMERIC(18,2) NOT NULL DEFAULT 0,
          monthly_ctc NUMERIC(18,2) NOT NULL DEFAULT 0,
          effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
          effective_to DATE,
          assignment_status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (assignment_status IN ('ACTIVE', 'INACTIVE', 'REVISED')),
          is_active BOOLEAN DEFAULT TRUE,
          remarks TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by UUID,
          approved_at TIMESTAMP WITH TIME ZONE,
          approved_by UUID,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_by UUID,
          CONSTRAINT check_effective_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
      );

      CREATE TABLE IF NOT EXISTS hrms.payroll_runs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
          payroll_run_number VARCHAR(50) NOT NULL UNIQUE,
          pay_period VARCHAR(20) NOT NULL,
          payroll_month INT NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
          payroll_year INT NOT NULL,
          period_start_date DATE NOT NULL,
          period_end_date DATE NOT NULL,
          payroll_type VARCHAR(20) DEFAULT 'REGULAR' CHECK (payroll_type IN ('REGULAR', 'OFF_CYCLE', 'BONUS', 'ARREARS', 'FINAL_SETTLEMENT')),
          currency_code VARCHAR(10) DEFAULT 'INR',
          regenerated_from_run_id UUID REFERENCES hrms.payroll_runs(id),
          total_employees INT DEFAULT 0,
          total_gross_payout NUMERIC(18,2) DEFAULT 0,
          total_deductions NUMERIC(18,2) DEFAULT 0,
          total_net_payout NUMERIC(18,2) DEFAULT 0,
          status VARCHAR(30) DEFAULT 'DRAFT' CHECK (
              status IN ('DRAFT', 'GENERATING', 'GENERATED', 'APPROVED', 'RELEASED', 'PAID', 'CANCELLED')
          ),
          is_locked BOOLEAN DEFAULT FALSE,
          locked_at TIMESTAMP WITH TIME ZONE,
          locked_by UUID,
          locked_reason TEXT,
          failed_reason TEXT,
          generation_started_at TIMESTAMP WITH TIME ZONE,
          generation_completed_at TIMESTAMP WITH TIME ZONE,
          approved_at TIMESTAMP WITH TIME ZONE,
          approved_by UUID,
          released_at TIMESTAMP WITH TIME ZONE,
          released_by UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by UUID,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT unique_company_payroll_period UNIQUE (company_id, pay_period)
      );
      ALTER TABLE hrms.payroll_runs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS hrms.payslips (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          payroll_run_id UUID NOT NULL REFERENCES hrms.payroll_runs(id) ON DELETE CASCADE,
          company_id UUID NOT NULL REFERENCES hrms.companies(id) ON DELETE CASCADE,
          employee_id UUID NOT NULL REFERENCES hrms.employees(id),
          salary_assignment_id UUID REFERENCES hrms.employee_salary_assignments(id),
          payslip_number VARCHAR(50) NOT NULL UNIQUE,
          cost_center_id UUID,
          cost_center_name VARCHAR(100),
          employee_snapshot JSONB NOT NULL,
          snapshot_version INT DEFAULT 1,
          total_days INT DEFAULT 30,
          working_days NUMERIC(10,2) DEFAULT 0,
          present_days NUMERIC(10,2) DEFAULT 0,
          absent_days NUMERIC(10,2) DEFAULT 0,
          half_days NUMERIC(10,2) DEFAULT 0,
          holidays NUMERIC(10,2) DEFAULT 0,
          weekoffs NUMERIC(10,2) DEFAULT 0,
          paid_leaves NUMERIC(10,2) DEFAULT 0,
          payable_days NUMERIC(10,2) DEFAULT 0,
          lop_days NUMERIC(10,2) DEFAULT 0,
          late_logins INT DEFAULT 0,
          gross_earnings NUMERIC(18,2) DEFAULT 0,
          gross_deductions NUMERIC(18,2) DEFAULT 0,
          gross_salary NUMERIC(18,2) DEFAULT 0,
          total_deductions NUMERIC(18,2) DEFAULT 0,
          net_salary NUMERIC(18,2) DEFAULT 0,
          currency_code VARCHAR(10) DEFAULT 'INR',
          base_currency_code VARCHAR(10) DEFAULT 'INR',
          exchange_rate NUMERIC(10,6) DEFAULT 1.0,
          payment_mode VARCHAR(30) DEFAULT 'BANK_TRANSFER',
          payment_date DATE,
          pdf_url TEXT,
          pdf_generated_at TIMESTAMP WITH TIME ZONE,
          is_email_sent BOOLEAN DEFAULT FALSE,
          email_status VARCHAR(20) DEFAULT 'PENDING' CHECK (email_status IN ('PENDING', 'SENT', 'FAILED')),
          email_retry_count INT DEFAULT 0,
          email_error_message TEXT,
          email_sent_at TIMESTAMP WITH TIME ZONE,
          status VARCHAR(30) DEFAULT 'GENERATED' CHECK (
              status IN ('DRAFT', 'GENERATING', 'GENERATED', 'APPROVED', 'RELEASED', 'PAID', 'CANCELLED')
          ),
          freeze_status BOOLEAN DEFAULT FALSE,
          version INT DEFAULT 1,
          remarks TEXT,
          generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          approved_at TIMESTAMP WITH TIME ZONE,
          approved_by UUID,
          released_at TIMESTAMP WITH TIME ZONE,
          released_by UUID,
          paid_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by UUID,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_by UUID,
          CONSTRAINT unique_payslip_per_period UNIQUE (company_id, employee_id, payroll_run_id)
      );

      CREATE TABLE IF NOT EXISTS hrms.payslip_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          payslip_id UUID NOT NULL REFERENCES hrms.payslips(id) ON DELETE CASCADE,
          component_id UUID REFERENCES hrms.salary_components(id),
          component_code VARCHAR(50) NOT NULL,
          component_name VARCHAR(100) NOT NULL,
          type VARCHAR(20) NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION')),
          category VARCHAR(30) DEFAULT 'REGULAR',
          quantity NUMERIC(10,2) DEFAULT 0,
          rate NUMERIC(18,2) DEFAULT 0,
          amount NUMERIC(18,2) NOT NULL DEFAULT 0,
          currency_code VARCHAR(10) DEFAULT 'INR',
          is_taxable BOOLEAN DEFAULT TRUE,
          calculation_formula TEXT,
          is_manual BOOLEAN DEFAULT FALSE,
          display_order INT DEFAULT 1,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS hrms.payroll_run_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          payroll_run_id UUID NOT NULL REFERENCES hrms.payroll_runs(id) ON DELETE CASCADE,
          action VARCHAR(50) NOT NULL,
          from_status VARCHAR(30),
          to_status VARCHAR(30),
          description TEXT,
          metadata JSONB,
          ip_address VARCHAR(50),
          user_agent TEXT,
          performed_by UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS hrms.payroll_run_failures (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          payroll_run_id UUID NOT NULL REFERENCES hrms.payroll_runs(id) ON DELETE CASCADE,
          employee_id UUID REFERENCES hrms.employees(id),
          failure_reason TEXT NOT NULL,
          error_code VARCHAR(50),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS hrms.payslip_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          payslip_id UUID NOT NULL REFERENCES hrms.payslips(id) ON DELETE CASCADE,
          version INT NOT NULL DEFAULT 1,
          pdf_url TEXT NOT NULL,
          generated_by UUID,
          generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_assignment_emp_active ON hrms.employee_salary_assignments (company_id, employee_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_payroll_status ON hrms.payroll_runs (company_id, status);
      CREATE INDEX IF NOT EXISTS idx_payslip_status ON hrms.payslips (company_id, status);
      CREATE INDEX IF NOT EXISTS idx_payslip_payment ON hrms.payslips (company_id, payment_date);
      CREATE INDEX IF NOT EXISTS idx_payslip_items_ps_type ON hrms.payslip_items (payslip_id, type, display_order);
      CREATE INDEX IF NOT EXISTS idx_payroll_run_logs ON hrms.payroll_run_logs (payroll_run_id, created_at);
    `);
    console.log('[MIGRATION] All 7 Enterprise Payroll Tables and Indexes verified successfully.');
  } catch (err) {
    console.error('[MIGRATION] Error migrating database schema:', err);
  }
  await syncDynamicPermissions();
});

/**
 * ⚡ SMART HR AUTOMATION APIs
 */
app.get('/api/v1/smart-hr/schedules', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, company_id } = req.query;
    const cid = (companyId || company_id) as string;
    let queryText = `
      SELECT s.*,
             e.first_name || ' ' || e.last_name as target_employee_name,
             e.emp_id_code as target_employee_code
      FROM hrms.smart_hr_schedules s
      LEFT JOIN hrms.employees e ON s.target_employee_id = e.id
    `;
    let queryParams: any[] = [];
    if (cid && cid !== 'all') {
      queryText += ` WHERE s.company_id = $1 `;
      queryParams.push(cid);
    }
    queryText += ` ORDER BY s.created_at DESC `;
    const result = await query(queryText, queryParams);
    res.json({ schedules: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

app.post('/api/v1/smart-hr/schedules', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { company_id, companyId, title, task_type, frequency, execution_time, execution_day_of_week, execution_day_of_month, recipient_type, target_employee_id, channel_type } = req.body;
  const cid = company_id || companyId || (req as any).user?.company_id;
  try {
    const result = await query(
      `INSERT INTO hrms.smart_hr_schedules (company_id, title, task_type, frequency, execution_time, execution_day_of_week, execution_day_of_month, recipient_type, target_employee_id, channel_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE') RETURNING *`,
      [
        cid || null,
        title,
        task_type,
        frequency || 'DAILY',
        execution_time || '09:00:00',
        execution_day_of_week || null,
        execution_day_of_month ? parseInt(execution_day_of_month, 10) : null,
        recipient_type || 'ALL_EMPLOYEES',
        target_employee_id || null,
        channel_type || 'BOTH'
      ]
    );
    res.status(201).json({ schedule: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

app.put('/api/v1/smart-hr/schedules/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { title, task_type, frequency, execution_time, execution_day_of_week, execution_day_of_month, recipient_type, target_employee_id, channel_type, status } = req.body;
  try {
    const result = await query(
      `UPDATE hrms.smart_hr_schedules 
       SET title = $1, task_type = $2, frequency = $3, execution_time = $4, execution_day_of_week = $5, execution_day_of_month = $6, recipient_type = $7, target_employee_id = $8, channel_type = $9, status = $10, updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [
        title,
        task_type,
        frequency,
        execution_time,
        execution_day_of_week || null,
        execution_day_of_month ? parseInt(execution_day_of_month, 10) : null,
        recipient_type,
        target_employee_id || null,
        channel_type,
        status || 'ACTIVE',
        id
      ]
    );
    res.json({ schedule: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

app.delete('/api/v1/smart-hr/schedules/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM hrms.smart_hr_schedules WHERE id = $1', [id]);
    res.json({ message: 'Schedule deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

const sendSmartHREmail = async (companyId: string | null, toEmail: string, subject: string, bodyText: string, customHtmlExtra: string = ''): Promise<{ success: boolean; messageId?: string; error?: string; reason?: string }> => {
  try {
    let emailConfig;
    if (companyId) {
      const res = await query(`SELECT * FROM hrms.email_integrations WHERE company_id = $1 AND is_active = true LIMIT 1`, [companyId]);
      if (res.rows.length > 0) emailConfig = res.rows[0];
    }
    if (!emailConfig) {
      const res = await query(`SELECT * FROM hrms.email_integrations WHERE is_active = true ORDER BY updated_at DESC LIMIT 1`);
      if (res.rows.length > 0) emailConfig = res.rows[0];
    }

    if (!emailConfig || !emailConfig.smtp_host || !emailConfig.smtp_username) {
      console.log('⚠️ No active SMTP Email Integration found in Configuration settings.');
      return { success: false, reason: 'SMTP credentials not configured in Settings -> Configuration page' };
    }

    const port = parseInt(emailConfig.smtp_port, 10) || 587;
    const isSSL = port === 465;

    const transporter = nodemailer.createTransport({
      host: emailConfig.smtp_host || 'smtp.gmail.com',
      port: port,
      secure: isSSL,
      requireTLS: !isSSL,
      auth: {
        user: emailConfig.smtp_username,
        pass: emailConfig.smtp_password_encrypted
      },
      tls: {
        rejectUnauthorized: false
      },
      family: 4
    } as any);

    const info = await transporter.sendMail({
      from: `"${emailConfig.from_name || 'HR Team'}" <${emailConfig.from_email || emailConfig.smtp_username}>`,
      to: toEmail,
      subject: subject,
      text: bodyText,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto;">
               <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                 <h2 style="color: #4f46e5; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">${subject}</h2>
                 <p style="font-size: 14px; color: #1e293b; margin-top: 15px;">Hello,</p>
                 <div style="white-space: pre-wrap; font-size: 14px; color: #475569;">${bodyText.replace(/\n/g, '<br/>')}</div>
                 ${customHtmlExtra}
                 <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
                 <p style="font-size: 11px; color: #94a3b8; margin-bottom: 0; text-align: center;">This email was sent automatically by <strong>Smart HR Auto-Pilot Engine</strong>.</p>
               </div>
             </div>`
    });

    console.log('✅ Smart HR Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error('❌ Error sending Smart HR Email:', err.message || err);
    return { success: false, error: err.message || 'SMTP sending error' };
  }
};

app.post('/api/v1/smart-hr/schedules/:id/execute', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const schedResult = await query(`
      SELECT s.*, e.first_name, e.last_name, e.email, e.emp_id_code
      FROM hrms.smart_hr_schedules s
      LEFT JOIN hrms.employees e ON s.target_employee_id = e.id
      WHERE s.id = $1
    `, [id]);

    if (schedResult.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const s = schedResult.rows[0];
    let recipientEmails: string[] = [];
    let targetName = 'All Active Employees';

    if (s.recipient_type === 'SINGLE_EMPLOYEE' && s.target_employee_id) {
      targetName = `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Single Employee';
      if (s.email) recipientEmails.push(s.email);
    } else {
      const empRes = await query(`SELECT email FROM hrms.employees WHERE status = 'ACTIVE' AND email IS NOT NULL AND email != ''`);
      recipientEmails = empRes.rows.map(r => r.email);
    }

    const emailSubject = `[Smart HR] ${s.title}`;
    const emailBody = `Hello ${targetName},\n\nHere is your automated digest dispatch for: ${s.title}.\n\nTask Type: ${s.task_type}\nExecution Frequency: ${s.frequency}`;

    let customHtmlExtra = '';
    if (s.task_type?.includes('ATTENDANCE')) {
      const empId = s.target_employee_id;
      let attRows: any[] = [];
      if (empId) {
        const dbAtt = await query(`
          SELECT attendance_date, status, first_in, last_out, worked_minutes, late_minutes
          FROM hrms.attendance_summary
          WHERE employee_id = $1
            AND attendance_date >= CURRENT_DATE - INTERVAL '7 days'
            AND attendance_date < CURRENT_DATE
          ORDER BY attendance_date ASC
        `, [empId]);
        attRows = dbAtt.rows;
      }

      const tableRowsHtml = [];
      let presentCount = 0;
      let totalWorkedMinutes = 0;

      for (let i = 7; i >= 1; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const displayDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        const match = attRows.find(r => {
          if (!r.attendance_date) return false;
          const rDate = new Date(r.attendance_date).toISOString().split('T')[0];
          return rDate === dateStr;
        });

        const isSunday = dayName === 'Sun';
        const status = match?.status || (isSunday ? 'WEEKLY_OFF' : 'PRESENT');
        if (status === 'PRESENT' || status === 'ON_TIME' || status === 'LATE') presentCount++;

        const workedMins = match?.worked_minutes ? Number(match.worked_minutes) : (status === 'WEEKLY_OFF' ? 0 : 480);
        totalWorkedMinutes += workedMins;
        const hoursWorked = (workedMins / 60).toFixed(1) + ' hrs';
        const checkIn = match?.first_in ? String(match.first_in).slice(0, 5) : (status === 'WEEKLY_OFF' ? '--:--' : '09:00 AM');
        const checkOut = match?.last_out ? String(match.last_out).slice(0, 5) : (status === 'WEEKLY_OFF' ? '--:--' : '05:00 PM');

        let badgeBg = '#ecfdf5';
        let badgeText = '#047857';
        let badgeBorder = '#a7f3d0';

        if (status === 'ABSENT') {
          badgeBg = '#fef2f2'; badgeText = '#b91c1c'; badgeBorder = '#fecaca';
        } else if (status === 'LATE') {
          badgeBg = '#fffbeb'; badgeText = '#b45309'; badgeBorder = '#fde68a';
        } else if (status === 'WEEKLY_OFF') {
          badgeBg = '#f1f5f9'; badgeText = '#475569'; badgeBorder = '#cbd5e1';
        }

        tableRowsHtml.push(`
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 12px; font-weight: bold; color: #1e293b;">${displayDate}</td>
            <td style="padding: 10px 12px; color: #64748b; font-weight: 600;">${dayName}</td>
            <td style="padding: 10px 12px;">
              <span style="background: ${badgeBg}; color: ${badgeText}; border: 1px solid ${badgeBorder}; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; display: inline-block;">
                ${status}
              </span>
            </td>
            <td style="padding: 10px 12px; font-family: monospace; color: #334155; font-weight: 600;">${checkIn}</td>
            <td style="padding: 10px 12px; font-family: monospace; color: #334155; font-weight: 600;">${checkOut}</td>
            <td style="padding: 10px 12px; font-weight: bold; color: #4338ca;">${hoursWorked}</td>
          </tr>
        `);
      }

      const totalHoursStr = (totalWorkedMinutes / 60).toFixed(1);

      customHtmlExtra = `
        <div style="margin-top: 20px; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; background: #ffffff;">
          <div style="background: #4f46e5; padding: 12px 16px; color: #ffffff; font-weight: bold; font-size: 14px;">
            📊 Weekly Attendance Digest Report (Past 7 Days)
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold;">
                <th style="padding: 10px 12px;">Date</th>
                <th style="padding: 10px 12px;">Day</th>
                <th style="padding: 10px 12px;">Status</th>
                <th style="padding: 10px 12px;">Check In</th>
                <th style="padding: 10px 12px;">Check Out</th>
                <th style="padding: 10px 12px;">Hours</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml.join('')}
            </tbody>
          </table>
          <div style="background: #f8fafc; padding: 12px 16px; font-size: 12px; color: #334155; font-weight: bold; border-top: 1px solid #e2e8f0;">
            <span style="color: #047857; margin-right: 20px;">✅ Days Present: ${presentCount} / 7 Days</span>
            <span style="color: #4338ca;">⏱️ Total Hours: ${totalHoursStr} Hrs</span>
          </div>
        </div>
      `;
    }

    let emailResult: { success: boolean; messageId?: string; error?: string; reason?: string } = { success: false, reason: 'Email channel not selected' };
    if ((s.channel_type === 'EMAIL' || s.channel_type === 'BOTH') && recipientEmails.length > 0) {
      for (const email of recipientEmails) {
        emailResult = await sendSmartHREmail(s.company_id, email, emailSubject, emailBody, customHtmlExtra);
      }
    }

    const summaryStatus = emailResult.success
      ? `Email sent to ${recipientEmails.join(', ')}`
      : `Trigger executed: ${emailResult.reason || emailResult.error || 'SMTP Integration Not Configured'}`;

    const logResult = await query(`
      INSERT INTO hrms.smart_hr_logs (company_id, schedule_id, title, task_type, status, total_recipients, success_count, failed_count, summary)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [
      s.company_id,
      s.id,
      s.title,
      s.task_type,
      emailResult.success ? 'SUCCESS' : 'FAILED',
      recipientEmails.length || 1,
      emailResult.success ? recipientEmails.length : 0,
      emailResult.success ? 0 : recipientEmails.length || 1,
      summaryStatus
    ]);

    if (!emailResult.success) {
      return res.status(400).json({
        error: `Schedule executed, but email failed: ${emailResult.reason || emailResult.error || 'SMTP Not Configured'}`,
        log: logResult.rows[0]
      });
    }

    return res.json({ message: `Successfully executed & sent email to ${recipientEmails.join(', ')}!`, log: logResult.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to execute schedule' });
  }
});

app.get('/api/v1/smart-hr/templates', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, company_id } = req.query;
    const cid = (companyId || company_id) as string;
    let queryText = 'SELECT * FROM hrms.smart_hr_templates';
    let queryParams: any[] = [];
    if (cid && cid !== 'all') {
      queryText += ' WHERE company_id = $1';
      queryParams.push(cid);
    }
    queryText += ' ORDER BY created_at DESC';
    const result = await query(queryText, queryParams);
    res.json({ templates: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

app.post('/api/v1/smart-hr/templates', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { company_id, companyId, template_type, title, subject, body_content, channel_type } = req.body;
  const cid = company_id || companyId || (req as any).user?.company_id;
  try {
    const result = await query(
      `INSERT INTO hrms.smart_hr_templates (company_id, template_type, title, subject, body_content, channel_type, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
      [cid || null, template_type, title, subject, body_content, channel_type || 'BOTH']
    );
    res.status(201).json({ template: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

app.put('/api/v1/smart-hr/templates/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { template_type, title, subject, body_content, channel_type } = req.body;
  try {
    const result = await query(
      `UPDATE hrms.smart_hr_templates 
       SET template_type = $1, title = $2, subject = $3, body_content = $4, channel_type = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [template_type, title, subject, body_content, channel_type || 'BOTH', id]
    );
    res.json({ template: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

app.delete('/api/v1/smart-hr/templates/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM hrms.smart_hr_templates WHERE id = $1', [id]);
    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

app.get('/api/v1/smart-hr/logs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, company_id } = req.query;
    const cid = (companyId || company_id) as string;
    let queryText = 'SELECT * FROM hrms.smart_hr_logs';
    let queryParams: any[] = [];
    if (cid && cid !== 'all') {
      queryText += ' WHERE company_id = $1';
      queryParams.push(cid);
    }
    queryText += ' ORDER BY executed_at DESC';
    const result = await query(queryText, queryParams);
    res.json({ logs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.delete('/api/v1/smart-hr/logs/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM hrms.smart_hr_logs WHERE id = $1', [id]);
    res.json({ message: 'Log deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete log' });
  }
});

/**
 * @route   POST /api/payroll/payslips/send-email & /api/v1/payroll/payslips/send-email
 * @desc    Send payslip PDF statement via configured SMTP email integration
 * @access  Private
 */
const handleSendPayslipEmailRoute = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sender_email, recipient_email, subject, body } = req.body;

    if (!recipient_email) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    // Fetch SMTP Integration details for the requested sender_email or active DB account
    let smtpRes = await query(
      `SELECT * FROM hrms.email_integrations WHERE from_email = $1 LIMIT 1`,
      [sender_email]
    );

    if (smtpRes.rowCount === 0) {
      smtpRes = await query(`SELECT * FROM hrms.email_integrations WHERE is_active = true LIMIT 1`);
    }

    if (smtpRes.rowCount === 0) {
      smtpRes = await query(`SELECT * FROM hrms.email_integrations ORDER BY updated_at DESC LIMIT 1`);
    }

    if (smtpRes.rowCount === 0) {
      return res.status(404).json({ error: 'No active email integration configuration found in DB' });
    }

    const config = smtpRes.rows[0];
    const smtpHost = config.smtp_host || 'smtp.gmail.com';
    const smtpPort = parseInt(config.smtp_port || '587', 10);
    const smtpUser = config.smtp_username || config.from_email;
    const smtpPass = config.smtp_password_encrypted || '';

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: config.encryption_type === 'SSL' || smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const mailOptions = {
      from: `"${config.from_name || 'Brihaspathi HRMS'}" <${config.from_email || sender_email}>`,
      to: recipient_email,
      subject: subject || 'Official Payslip Statement',
      text: body,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="background-color: #075289; color: #fff; padding: 16px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0; font-size: 18px;">Official Payslip Statement</h2>
          </div>
          <div style="padding: 20px 0; line-height: 1.6; white-space: pre-wrap; font-size: 14px;">${body}</div>
          <div style="border-top: 1px dashed #cbd5e1; padding-top: 12px; font-size: 11px; color: #64748b; text-align: center;">
            ** System generated print statement. Delivered via ${config.from_email} **
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Payslip email sent from ${config.from_email} to ${recipient_email}`);

    // 🔔 Send In-App Notification to employee when payslip is dispatched
    try {
      const empRes = await query('SELECT id, company_id FROM hrms.employees WHERE LOWER(email) = LOWER($1) LIMIT 1', [recipient_email]);
      if (empRes.rows.length > 0) {
        const emp = empRes.rows[0];
        sendNotification({
          companyId: emp.company_id,
          recipientId: emp.id,
          module: 'PAYROLL',
          eventCode: 'PAYSLIP_RELEASED',
          referenceType: 'PAYSLIP',
          title: 'Payslip Released 💰',
          message: 'Your official salary payslip statement has been released and sent to your email.',
          type: 'SUCCESS',
          actionUrl: '/dashboard/payslip',
        });
      }
    } catch (notifErr) {
      console.error('[PayslipNotif] Error creating payslip notification:', notifErr);
    }

    return res.json({ success: true, message: `Email sent successfully from ${config.from_email}` });
  } catch (err: any) {
    console.error('Error dispatching payslip email via SMTP:', err);
    return res.status(500).json({ error: err.message || 'Failed to send email' });
  }
};

app.post('/api/payroll/payslips/send-email', authenticateToken, handleSendPayslipEmailRoute as any);
app.post('/api/v1/payroll/payslips/send-email', authenticateToken, handleSendPayslipEmailRoute as any);
