import { Router, Response } from 'express';
import { query } from '../config/db';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middlewares/auth';
import { enqueueActivityLog } from '../server';
import crypto from 'crypto';

const router = Router();

/**
 * @openapi
 * /api/v1/onboarding:
 *   get:
 *     summary: Get Employee Onboarding Cases
 *     tags:
 *       - Employee Onboarding
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of onboarding workflow objects
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateToken as any, requirePermission('recruitment:read') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRoles = req.user?.roles || [];
    const isSuper = (req.user as any)?.role === 'SUPER_ADMIN' || (req.user as any)?.is_super_admin || userRoles.some((r: string) => r.toLowerCase().includes('superadmin'));
    
    let targetCompanyId: string | null = req.user!.companyId || null;
    if (isSuper || !targetCompanyId) {
      if (req.query.company_id === 'all' || !req.query.company_id) {
        targetCompanyId = null;
      } else {
        targetCompanyId = req.query.company_id as string;
      }
    }

    const result = await query(
      `SELECT 
        ob.id,
        ob.company_id,
        ob.onboarding_code,
        ob.candidate_id,
        ob.application_id,
        ob.candidate_offer_id,
        ob.created_employee_id,
        ob.portal_token,
        ob.onboarding_status,
        ob.target_joining_date,
        ob.actual_joining_date,
        ob.candidate_submitted_data,
        ob.document_verification_status,
        ob.checklist_status,
        ob.email_status,
        ob.email_error_message,
        ob.link_sent_at,
        ob.created_at,
        COALESCE(
          NULLIF(TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ob.candidate_submitted_data->>'first_name', '') || ' ' || COALESCE(ob.candidate_submitted_data->>'last_name', '')), ''),
          'New Candidate'
        ) as candidate_name,
        COALESCE(c.email, ob.candidate_submitted_data->>'email', '') as candidate_email,
        COALESCE(c.phone, ob.candidate_submitted_data->>'phone', '') as candidate_phone,
        COALESCE(jp.title, ob.candidate_submitted_data->>'job_title', 'Software Engineer') as job_title
      FROM hrms.employee_onboardings ob
      LEFT JOIN hrms.candidates c ON c.id = ob.candidate_id
      LEFT JOIN hrms.job_applications ja ON ja.id = ob.application_id
      LEFT JOIN hrms.job_postings jp ON jp.id = ja.job_posting_id
      WHERE ob.company_id = $1 OR $1 IS NULL
      ORDER BY ob.created_at DESC`,
      [targetCompanyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching onboarding records:', err);
    res.status(500).json({ error: 'Failed to fetch onboarding records' });
  }
});

/**
 * Get Configured SMTP Sender Email Info (All configured email gateways)
 */
router.get('/smtp-info', authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetCompanyId = req.query.company_id && req.query.company_id !== 'all' 
      ? (req.query.company_id as string) 
      : req.user?.companyId;

    let accounts: any[] = [];
    if (targetCompanyId) {
      const configRes = await query(
        `SELECT id, from_name, from_email, smtp_username, is_active FROM hrms.email_integrations WHERE company_id::text = $1::text ORDER BY is_active DESC, updated_at DESC`, 
        [targetCompanyId]
      );
      accounts = configRes.rows;
    }
    if (accounts.length === 0) {
      const defaultRes = await query(
        `SELECT id, from_name, from_email, smtp_username, is_active FROM hrms.email_integrations ORDER BY is_active DESC, updated_at DESC`
      );
      accounts = defaultRes.rows;
    }

    const senders = accounts.map(acc => ({
      id: acc.id,
      email: acc.from_email || acc.smtp_username,
      name: acc.from_name || 'HR Team',
      is_active: acc.is_active
    }));

    const primarySender = senders.find(s => s.is_active)?.email || senders[0]?.email || 'hr@brihaspathirail.com';

    return res.json({
      configured: senders.length > 0,
      sender_email: primarySender,
      selected_email: primarySender,
      senders: senders,
      available_senders: senders
    });
  } catch (err: any) {
    return res.status(500).json({ configured: false, sender_email: 'hr@brihaspathirail.com', senders: [], available_senders: [] });
  }
});

import nodemailer from 'nodemailer';

async function sendOnboardingInviteEmail(
  companyId: string | null,
  candidateName: string,
  toEmail: string,
  designation: string,
  targetJoiningDate: string,
  magicLinkUrl: string,
  customSenderEmail?: string,
  onboardingId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch Company details (name & logo) dynamically
    let companyName = '';
    let companyLogo = '';
    
    if (companyId) {
      const compRes = await query(`SELECT name, branding_logo FROM hrms.companies WHERE id::text = $1::text`, [companyId]);
      if (compRes.rows.length > 0) {
        companyName = compRes.rows[0].name || '';
        companyLogo = compRes.rows[0].branding_logo || '';
      }
    }

    if (!companyName) {
      const defaultCompRes = await query(`SELECT name, branding_logo FROM hrms.companies ORDER BY created_at ASC LIMIT 1`);
      if (defaultCompRes.rows.length > 0) {
        companyName = defaultCompRes.rows[0].name || 'Brihaspathi Rail Private Limited';
        companyLogo = defaultCompRes.rows[0].branding_logo || '';
      } else {
        companyName = 'Brihaspathi Rail Private Limited';
      }
    }

    // 2. Fetch SMTP Configuration from hrms.email_integrations (dashboard/configuration)
    let emailConfig = null;
    if (customSenderEmail) {
      const customRes = await query(
        `SELECT * FROM hrms.email_integrations WHERE (from_email = $1 OR smtp_username = $1) LIMIT 1`,
        [customSenderEmail.trim()]
      );
      if (customRes.rows.length > 0) emailConfig = customRes.rows[0];
    }

    if (!emailConfig && companyId) {
      const configRes = await query(`SELECT * FROM hrms.email_integrations WHERE company_id::text = $1::text AND is_active = true LIMIT 1`, [companyId]);
      if (configRes.rows.length > 0) emailConfig = configRes.rows[0];
    }
    if (!emailConfig) {
      const defaultRes = await query(`SELECT * FROM hrms.email_integrations WHERE is_active = true ORDER BY updated_at DESC LIMIT 1`);
      if (defaultRes.rows.length > 0) emailConfig = defaultRes.rows[0];
    }

    const formattedJoiningDate = targetJoiningDate ? new Date(targetJoiningDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'the agreed date';
    const isDataUri = companyLogo && companyLogo.startsWith('data:image/');
    const logoSrc = isDataUri ? 'cid:company_logo_cid' : (companyLogo.startsWith('http') ? companyLogo : `https://newhrms.brihaspathi.in${companyLogo}`);
    const logoHtml = companyLogo ? `<img src="${logoSrc}" alt="${companyName}" style="max-height: 65px; max-width: 280px; object-fit: contain; background: #ffffff; padding: 8px 20px; border-radius: 16px; display: block; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.4);" />` : '';

    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px 12px; color: #1e293b; width: 100% !important; }
        .email-wrapper { width: 100% !important; max-width: 100% !important; margin: 0 auto; background: #f1f5f9; padding: 20px 0; }
        .email-card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); }
        .email-header-accent { height: 6px; background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #06b6d4 100%); }
        .email-header { background: #ffffff; padding: 36px 36px 24px 36px; text-align: center; border-bottom: 1px solid #f1f5f9; }
        .company-title { font-size: 24px; font-weight: 900; margin: 12px 0 0 0; color: #0f172a; letter-spacing: -0.5px; }
        .email-content { padding: 36px; color: #334155; line-height: 1.8; font-size: 15px; }
        .welcome-heading { font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 16px; }
        .section-title { font-size: 16px; font-weight: 800; color: #1e1b4b; border-bottom: 2px solid #e0e7ff; padding-bottom: 6px; margin-top: 28px; margin-bottom: 14px; }
        .bullet-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px 24px; margin: 16px 0; }
        .bullet-box ul { margin: 0; padding-left: 20px; }
        .bullet-box li { margin-bottom: 8px; color: #334155; font-weight: 600; font-size: 14px; }
        .btn-container { text-align: center; margin: 32px 0; }
        .cta-btn { display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff !important; font-weight: 900; font-size: 16px; text-decoration: none; padding: 18px 40px; border-radius: 16px; box-shadow: 0 8px 24px rgba(79,70,229,0.35); }
        .joining-date-badge { text-align: center; font-size: 13px; color: #581c87; font-weight: 800; background: #f3e8ff; border: 1px solid #d8b4fe; padding: 10px 22px; border-radius: 12px; display: inline-block; margin: 16px 0; }
        .email-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 36px; text-align: center; font-size: 12px; color: #64748b; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-card">
          <div class="email-header-accent"></div>
          <div class="email-header">
            ${companyLogo ? `<div style="display: flex; justify-content: center; margin-bottom: 12px;">${logoHtml}</div>` : ''}
            <h1 class="company-title">${companyName}</h1>
          </div>
          <div class="email-content">
            <p class="welcome-heading">Dear ${candidateName},</p>
            
            <p><strong>Congratulations on your selection, and a very warm welcome to ${companyName}!</strong> 🎉</p>
            
            <p>We are pleased to inform you that you have been selected for the position of <strong>${designation || 'Software Engineer'}</strong>. We are delighted to have you join our organization and look forward to your valuable contribution to our team.</p>
            
            <p>As part of the <strong>pre-joining and onboarding process</strong>, we request you to complete the required employee information and compliance documentation through our secure <strong>Candidate Onboarding Portal</strong>.</p>
            
            <h3 class="section-title">Pre-Joining Documentation</h3>
            <p>Please keep the following documents ready for submission:</p>
            
            <div class="bullet-box">
              <ul>
                <li>Aadhaar Card</li>
                <li>PAN Card</li>
                <li>Bank Account Details</li>
                <li>Educational Certificates</li>
                <li>Previous Employment Documents (if applicable)</li>
                <li>Passport-size Photograph</li>
                <li>Current Address & Emergency Contact Details</li>
              </ul>
            </div>
            
            <h3 class="section-title">Important Information</h3>
            <p>Please ensure that:</p>
            <div class="bullet-box">
              <ul>
                <li>All information provided is accurate and up to date.</li>
                <li>Uploaded documents are clear and legible.</li>
                <li>All mandatory documents are submitted before the specified deadline.</li>
                <li>Any discrepancies or missing information are reported to the HR team at the earliest.</li>
              </ul>
            </div>

            <h3 class="section-title">Complete Your Onboarding</h3>
            <p>To ensure a smooth and timely joining process, please access the secure onboarding portal using the link provided below:</p>
            
            <div class="btn-container">
              <a href="${magicLinkUrl}" target="_blank" class="cta-btn">🚀 Candidate Onboarding Portal</a>
            </div>
            
            <p>Once you access the portal, please carefully review the information, complete all mandatory fields, and upload the required documents in the specified format.</p>
            
            <div style="text-align: center;">
              <span class="joining-date-badge">📅 Target Onboarding Completion Date: ${formattedJoiningDate}</span>
            </div>
            
            <p>Completing the onboarding formalities within the given timeline will help us process your joining documentation efficiently and ensure a smooth transition into the organization.</p>
            
            <p>If you face any difficulty while accessing the portal, uploading documents, or completing the onboarding process, please reach out to our <strong>Human Resources Department</strong> for assistance.</p>
            
            <p>We are excited to have you begin this new professional journey with <strong>${companyName}</strong>.</p>
            
            <p style="margin-top: 36px; font-size: 15px; border-top: 1px solid #e2e8f0; padding-top: 24px; line-height: 1.8;">
              <strong>Warm Regards,</strong><br/>
              <strong>Human Resources Department</strong><br/>
              <span style="color: #4f46e5; font-weight: 800; font-size: 16px;">${companyName}</span>
            </p>
          </div>
          <div class="email-footer">
            © ${new Date().getFullYear()} ${companyName}. All rights reserved.
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    if (emailConfig && emailConfig.smtp_host && emailConfig.smtp_username) {
      const port = parseInt(emailConfig.smtp_port, 10) || 587;
      const isSSL = port === 465;
      const transporter = nodemailer.createTransport({
        host: emailConfig.smtp_host,
        port: port,
        secure: isSSL,
        requireTLS: !isSSL,
        auth: {
          user: emailConfig.smtp_username,
          pass: emailConfig.smtp_password_encrypted
        },
        tls: { rejectUnauthorized: false },
        family: 4
      } as any);

      await transporter.sendMail({
        from: `"${companyName} HR" <${emailConfig.from_email || emailConfig.smtp_username}>`,
        to: toEmail,
        subject: `Welcome to ${companyName} – Candidate Onboarding`,
        html: htmlBody,
        attachments: isDataUri ? [{
          filename: 'company_logo.png',
          path: companyLogo,
          cid: 'company_logo_cid'
        }] : []
      });
      console.log(`✅ [ONBOARDING EMAIL DISPATCH SUCCESS] Sent email to ${toEmail} using configured SMTP (${emailConfig.smtp_username})`);
      
      if (onboardingId) {
        await query(`UPDATE hrms.employee_onboardings SET email_status = 'SENT', email_error_message = NULL WHERE id = $1`, [onboardingId]);
      }
      return { success: true };
    } else {
      const errMsg = 'No active SMTP configuration found in Settings -> Configuration';
      console.log(`⚠️ [ONBOARDING EMAIL DISPATCH] ${errMsg}. Magic link: ${magicLinkUrl}`);
      if (onboardingId) {
        await query(`UPDATE hrms.employee_onboardings SET email_status = 'FAILED', email_error_message = $1 WHERE id = $2`, [errMsg, onboardingId]);
      }
      return { success: false, error: errMsg };
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error('❌ Error sending onboarding invite email:', errMsg);
    if (onboardingId) {
      await query(`UPDATE hrms.employee_onboardings SET email_status = 'FAILED', email_error_message = $1 WHERE id = $2`, [errMsg, onboardingId]);
    }
    return { success: false, error: errMsg };
  }
}

async function sendOfferLetterEmail(
  companyId: string | null,
  candidateName: string,
  toEmail: string,
  designation: string,
  targetJoiningDate: string,
  candidateAddress?: string,
  workLocation?: string,
  acceptanceDeadline?: string,
  magicLinkUrl?: string,
  customSenderEmail?: string,
  onboardingId?: string,
  customMessage?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let companyName = '';
    let companyLogo = '';
    
    if (companyId) {
      const compRes = await query(`SELECT name, branding_logo FROM hrms.companies WHERE id::text = $1::text`, [companyId]);
      if (compRes.rows.length > 0) {
        companyName = compRes.rows[0].name || '';
        companyLogo = compRes.rows[0].branding_logo || '';
      }
    }

    if (!companyName) {
      const defaultCompRes = await query(`SELECT name, branding_logo FROM hrms.companies ORDER BY created_at ASC LIMIT 1`);
      if (defaultCompRes.rows.length > 0) {
        companyName = defaultCompRes.rows[0].name || 'Brihaspathi Rail Private Limited';
        companyLogo = defaultCompRes.rows[0].branding_logo || '';
      } else {
        companyName = 'Brihaspathi Rail Private Limited';
      }
    }

    let emailConfig = null;
    if (customSenderEmail) {
      const customRes = await query(
        `SELECT * FROM hrms.email_integrations WHERE (from_email = $1 OR smtp_username = $1) LIMIT 1`,
        [customSenderEmail.trim()]
      );
      if (customRes.rows.length > 0) emailConfig = customRes.rows[0];
    }

    if (!emailConfig && companyId) {
      const configRes = await query(`SELECT * FROM hrms.email_integrations WHERE company_id::text = $1::text AND is_active = true LIMIT 1`, [companyId]);
      if (configRes.rows.length > 0) emailConfig = configRes.rows[0];
    }
    if (!emailConfig) {
      const defaultRes = await query(`SELECT * FROM hrms.email_integrations WHERE is_active = true ORDER BY updated_at DESC LIMIT 1`);
      if (defaultRes.rows.length > 0) emailConfig = defaultRes.rows[0];
    }

    const today = new Date();
    const offerDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    const formattedJoiningDate = targetJoiningDate 
      ? new Date(targetJoiningDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'As per mutual agreement';

    const deadlineDate = acceptanceDeadline 
      ? new Date(acceptanceDeadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const isDataUri = companyLogo && companyLogo.startsWith('data:image/');
    const logoSrc = isDataUri ? 'cid:company_logo_cid' : (companyLogo.startsWith('http') ? companyLogo : `https://newhrms.brihaspathi.in${companyLogo}`);
    const logoHtml = companyLogo ? `<img src="${logoSrc}" alt="${companyName}" style="max-height: 60px; max-width: 260px; object-fit: contain; display: block; margin: 0 auto 12px auto;" />` : '';

    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        html, body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 0; color: #1e293b; width: 100% !important; }
        .email-wrapper { width: 100% !important; min-width: 100% !important; max-width: 100% !important; margin: 0; background: #ffffff; padding: 0; }
        .email-card { width: 100% !important; min-width: 100% !important; max-width: 100% !important; margin: 0; background: #ffffff; border: none; box-shadow: none; }
        .email-header-accent { height: 6px; background: linear-gradient(90deg, #3730a3 0%, #4f46e5 50%, #7c3aed 100%); }
        .email-header { background: #ffffff; padding: 36px 40px 24px 40px; text-align: center; border-bottom: 1px solid #f1f5f9; }
        .company-title { font-size: 26px; font-weight: 900; margin: 12px 0 0 0; color: #0f172a; letter-spacing: -0.5px; }
        .email-content { padding: 40px; color: #334155; line-height: 1.8; font-size: 15px; max-width: 100% !important; }
        .subject-accent { border-left: 4px solid #4f46e5; padding-left: 16px; margin: 24px 0; font-size: 17px; font-weight: 900; color: #1e1b4b; }
        .joining-accent { border-left: 3px solid #3b82f6; padding-left: 16px; margin: 24px 0; font-size: 15px; }
        .btn-container { text-align: center; margin: 36px 0 16px 0; }
        .cta-btn { display: inline-block; background: linear-gradient(135deg, #3730a3 0%, #4f46e5 100%); color: #ffffff !important; font-weight: 900; font-size: 16px; text-decoration: none; padding: 18px 44px; border-radius: 16px; box-shadow: 0 8px 24px rgba(55,48,163,0.3); }
        .note-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 20px; margin-top: 16px; text-align: left; font-size: 13px; color: #475569; line-height: 1.6; }
        .email-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center; font-size: 12px; color: #64748b; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-card">
          <div class="email-header-accent"></div>
          <div class="email-header">
            ${companyLogo ? `<div style="display: flex; justify-content: center; margin-bottom: 12px;">${logoHtml}</div>` : ''}
            <h1 class="company-title">${companyName}</h1>
          </div>
          <div class="email-content">
            
            <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 24px; font-size: 14px; color: #64748b;">
              <p style="margin: 4px 0;"><strong>Date:</strong> ${offerDate}</p>
              <p style="margin: 4px 0;"><strong>To:</strong> <span style="color: #0f172a; font-weight: 800;">${candidateName}</span></p>
              ${candidateAddress ? `<p style="margin: 4px 0;"><strong>Address:</strong> ${candidateAddress}</p>` : ''}
            </div>

            <div class="subject-accent">
              Subject: Offer of Employment – ${designation || 'Position'}
            </div>

            <p>Dear <strong>${candidateName}</strong>,</p>

            <p>We are pleased to offer you employment with <strong>${companyName}</strong> for the position of <strong>${designation || 'Position'}</strong>.</p>

            <div class="joining-accent">
              <p style="margin: 6px 0; font-weight: 700; color: #0f172a;">📅 Proposed Date of Joining: <span style="color: #4f46e5; font-weight: 800;">${formattedJoiningDate}</span></p>
              <p style="margin: 6px 0; font-weight: 700; color: #0f172a;">📍 Place of Work: <span style="color: #4f46e5; font-weight: 800;">${workLocation || 'Corporate Office, Hyderabad'}</span></p>
            </div>

            ${customMessage ? `
            <div style="font-size: 15px; color: #334155; line-height: 1.8; margin: 20px 0;">
              ${customMessage.replace(/\n/g, '<br/>')}
            </div>
            ` : `
            <p>Your compensation and other employment benefits will be as discussed and agreed upon during the selection process. The detailed terms and conditions of your employment will be provided as part of your appointment and joining formalities.</p>
            `}

            <p>This offer is subject to the successful completion of the required pre-employment documentation and verification process.</p>

            <p>Please confirm your acceptance of this offer by <strong>${deadlineDate}</strong>.</p>

            ${magicLinkUrl ? `
            <div class="btn-container">
              <a href="${magicLinkUrl}" target="_blank" class="cta-btn">👍 Accept Offer Letter</a>
              <div class="note-box">
                <strong style="color: #4f46e5;">📌 Important Note:</strong> Once you click <strong>Accept Offer Letter</strong>, your self-service candidate onboarding portal link will be unlocked to submit required verification documents and personal details.
              </div>
            </div>
            ` : ''}

            <p style="margin-top: 24px;">We are delighted to welcome you to <strong>${companyName}</strong> and look forward to having you as a valued member of our team.</p>

            <div style="margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 24px; font-size: 15px; line-height: 1.8;">
              <strong>Warm Regards,</strong><br/>
              <strong>Human Resources Department</strong><br/>
              <span style="color: #4f46e5; font-weight: 800; font-size: 16px;">${companyName}</span>
            </div>
          </div>
          <div class="email-footer">
            © ${new Date().getFullYear()} ${companyName}. All rights reserved.
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    if (emailConfig && emailConfig.smtp_host && emailConfig.smtp_username) {
      const port = parseInt(emailConfig.smtp_port, 10) || 587;
      const isSSL = port === 465;
      const transporter = nodemailer.createTransport({
        host: emailConfig.smtp_host,
        port: port,
        secure: isSSL,
        requireTLS: !isSSL,
        auth: {
          user: emailConfig.smtp_username,
          pass: emailConfig.smtp_password_encrypted
        },
        tls: { rejectUnauthorized: false },
        family: 4
      } as any);

      await transporter.sendMail({
        from: `"${companyName} HR" <${emailConfig.from_email || emailConfig.smtp_username}>`,
        to: toEmail,
        subject: `Offer of Employment – ${designation || 'Position'} | ${companyName}`,
        html: htmlBody,
        attachments: isDataUri ? [{
          filename: 'company_logo.png',
          path: companyLogo,
          cid: 'company_logo_cid'
        }] : []
      });
      console.log(`✅ [OFFER LETTER EMAIL DISPATCH SUCCESS] Sent offer letter to ${toEmail} using SMTP (${emailConfig.smtp_username})`);
      
      if (onboardingId) {
        await query(`UPDATE hrms.employee_onboardings SET email_status = 'SENT', email_error_message = NULL WHERE id = $1`, [onboardingId]);
      }
      return { success: true };
    } else {
      const errMsg = 'No active SMTP configuration found in Settings -> Configuration';
      console.error(`❌ [SMTP DISPATCH ERROR] ${errMsg}`);
      if (onboardingId) {
        await query(`UPDATE hrms.employee_onboardings SET email_status = 'FAILED', email_error_message = $1 WHERE id = $2`, [errMsg, onboardingId]);
      }
      return { success: false, error: errMsg };
    }
  } catch (err: any) {
    const errorDetail = err?.message || String(err);
    console.error('❌ Error sending offer letter email:', errorDetail);
    if (onboardingId) {
      await query(`UPDATE hrms.employee_onboardings SET email_status = 'FAILED', email_error_message = $1 WHERE id = $2`, [errorDetail, onboardingId]);
    }
    return { success: false, error: errorDetail };
  }
}

/**
 * @openapi
 * /api/v1/onboarding/direct-invite:
 *   post:
 *     summary: Create Direct Candidate Invite & Send Magic Link
 *     tags:
 *       - Employee Onboarding
 *     security:
 *       - bearerAuth: []
 */
router.post('/direct-invite', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email: userEmail } = req.user!;
    const { full_name, first_name, last_name, email, phone, job_title, target_joining_date, sender_email } = req.body;

    const rawFullName = (full_name || first_name || '').trim();
    if (!rawFullName || !email) {
      return res.status(400).json({ error: 'Full name and email are required' });
    }

    const nameParts = rawFullName.split(' ');
    const firstNameParsed = nameParts[0];
    const lastNameParsed = nameParts.slice(1).join(' ') || (last_name || '').trim();

    const finalCompanyId = companyId || req.body.company_id;

    // 1. Create or find Candidate
    let candidateId = null;
    const candCheck = await query(`SELECT id FROM hrms.candidates WHERE LOWER(email) = LOWER($1)`, [email.trim()]);
    if (candCheck.rows.length > 0) {
      candidateId = candCheck.rows[0].id;
    } else {
      const candIns = await query(
        `INSERT INTO hrms.candidates (company_id, first_name, last_name, email, phone, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
        [finalCompanyId, firstNameParsed, lastNameParsed, email.trim(), (phone || '').trim()]
      );
      candidateId = candIns.rows[0].id;
    }

    // 2. Generate onboarding code & token (2-day / 48-hour expiration)
    const countRes = await query(`SELECT COUNT(*) as count FROM hrms.employee_onboardings`);
    const nextCode = `ONB-2026-${String(parseInt(countRes.rows[0].count, 10) + 1).padStart(3, '0')}`;
    const token = 'tok_onb_' + crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 48 hours (2 days)

    const candidateType = req.body.candidate_type === 'FRESHER' ? 'FRESHER' : 'EXPERIENCED';

    const initialData = {
      first_name: firstNameParsed,
      last_name: lastNameParsed,
      email: email.trim(),
      phone: (phone || '').trim(),
      job_title: (job_title || '').trim(),
      candidate_type: candidateType
    };

    // 3. Insert into employee_onboardings
    const obResult = await query(
      `INSERT INTO hrms.employee_onboardings (
        company_id, onboarding_code, candidate_id, portal_token, token_expires_at,
        link_sent_at, onboarding_status, email_status, target_joining_date, candidate_submitted_data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), 'LINK_SENT', 'PENDING', $6, $7, NOW(), NOW())
      RETURNING *`,
      [
        finalCompanyId,
        nextCode,
        candidateId,
        token,
        expiresAt,
        target_joining_date || new Date().toISOString().split('T')[0],
        JSON.stringify(initialData)
      ]
    );

    const createdRecord = obResult.rows[0];
    const protocol = req.protocol || 'https';
    const host = req.get('host') || 'newhrms.brihaspathi.in';
    const fullMagicUrl = `${protocol}://${host}/onboard?token=${token}`;

    // Dispatch HTML Email with selected sender email and track status
    const mailResult = await sendOnboardingInviteEmail(
      finalCompanyId ?? null,
      rawFullName,
      email.trim(),
      (job_title || '').trim(),
      target_joining_date || new Date().toISOString().split('T')[0],
      fullMagicUrl,
      sender_email,
      createdRecord.id
    );

    enqueueActivityLog(
      finalCompanyId ?? null,
      userEmail || '',
      'DIRECT_ONBOARDING_INVITE_SENT',
      'onboarding',
      `Sent direct onboarding link to candidate ${rawFullName} (${email})`,
      req.ip || '',
      (req.headers['user-agent'] as string) || ''
    );

    return res.json({
      message: mailResult.success ? 'Direct onboarding invite created and email dispatched successfully' : `Invite created, but email dispatch failed: ${mailResult.error}`,
      onboarding: { ...createdRecord, email_status: mailResult.success ? 'SENT' : 'FAILED', email_error_message: mailResult.error },
      email_sent: mailResult.success,
      email_error: mailResult.error,
      magic_link: `/onboard?token=${token}`
    });
  } catch (err: any) {
    console.error('Error creating direct onboarding invite:', err);
    return res.status(500).json({ error: err?.message || 'Failed to create direct onboarding invite' });
  }
});

/**
 * @openapi
 * /api/v1/onboarding/{id}/send-offer:
 *   post:
 *     summary: Send Official Offer Letter Email to Candidate
 *     tags:
 *       - Employee Onboarding
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
 *         description: Offer letter dispatched successfully
 *       404:
 *         description: Onboarding record not found
 * */
router.post('/:id/send-offer', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { id } = req.params;
    const { sender_email, custom_designation, custom_joining_date, custom_work_location, custom_message } = req.body || {};

    const token = 'tok_onb_' + crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 48 hours

    const result = await query(
      `UPDATE hrms.employee_onboardings 
       SET onboarding_status = 'OFFER_SENT', portal_token = COALESCE(portal_token, $1), token_expires_at = COALESCE(token_expires_at, $2), updated_at = NOW()
       WHERE id = $3 AND (company_id = $4 OR $4 IS NULL)
       RETURNING *`,
      [token, expiresAt, id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }

    const ob = result.rows[0];
    const candidateData = ob.candidate_submitted_data || {};
    const candidateName = `${candidateData.first_name || ''} ${candidateData.last_name || ''}`.trim() || ob.candidate_name || 'Candidate';
    const candidateEmail = candidateData.email || ob.candidate_email || '';
    const designation = custom_designation || candidateData.job_title || ob.job_title || '';
    const candidateAddress = candidateData.current_address || candidateData.address || '';
    const workLocation = custom_work_location || ob.work_location || 'Corporate Office, Hyderabad';
    const joiningDate = custom_joining_date || ob.target_joining_date;

    const protocol = req.protocol || 'https';
    const host = req.get('host') || 'newhrms.brihaspathi.in';
    const fullMagicUrl = `${protocol}://${host}/onboard?token=${ob.portal_token || token}`;

    console.log(`📩 [DISPATCHING OFFER LETTER] To: ${candidateEmail}, From: ${sender_email || 'Default SMTP'}`);

    const mailResult = await sendOfferLetterEmail(
      companyId ?? null,
      candidateName,
      candidateEmail,
      designation,
      joiningDate,
      candidateAddress,
      workLocation,
      undefined,
      fullMagicUrl,
      sender_email,
      ob.id,
      custom_message
    );

    enqueueActivityLog(companyId ?? null, email || '', 'OFFER_LETTER_SENT', 'onboarding', `Sent offer letter for onboarding ID ${id}`, req.ip || '', (req.headers['user-agent'] as string) || '');

    if (!mailResult.success) {
      console.error(`❌ [SMTP OFFER LETTER FAILURE]: ${mailResult.error}`);
    }

    return res.json({ 
      message: mailResult.success ? 'Offer letter dispatched successfully via Email' : `Offer status set, but Email dispatch failed: ${mailResult.error}`,
      onboarding: { ...ob, email_status: mailResult.success ? 'SENT' : 'FAILED', email_error_message: mailResult.error },
      email_sent: mailResult.success,
      email_error: mailResult.error
    });
  } catch (err) {
    console.error('Error sending offer letter:', err);
    return res.status(500).json({ error: 'Failed to send offer letter' });
  }
});

// Reset status back to Step 1 (PENDING_OFFER)
router.post('/:id/reset-status', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;
    const { target_status } = req.body || {};

    const newStatus = target_status || 'PENDING_OFFER';
    const result = await query(
      `UPDATE hrms.employee_onboardings 
       SET onboarding_status = $1, email_status = 'PENDING', email_error_message = NULL, updated_at = NOW()
       WHERE id = $2 AND (company_id = $3 OR $3 IS NULL)
       RETURNING *`,
      [newStatus, id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }

    return res.json({ message: `Status reset to ${newStatus}`, onboarding: result.rows[0] });
  } catch (err) {
    console.error('Error resetting onboarding status:', err);
    return res.status(500).json({ error: 'Failed to reset status' });
  }
});

/**
 * @openapi
 * /api/v1/onboarding/send-link:
 *   post:
 *     summary: Send Onboarding Portal Magic Link to Candidate
 *     tags:
 *       - Employee Onboarding
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - onboarding_id
 *             properties:
 *               onboarding_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Portal link sent successfully
 *       404:
 *         description: Onboarding record not found
 * */
router.post('/send-link', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { onboarding_id, sender_email } = req.body;

    const token = 'tok_onb_' + crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 48 hours

    const result = await query(
      `UPDATE hrms.employee_onboardings 
       SET portal_token = $1, token_expires_at = $2, link_sent_at = NOW(), onboarding_status = 'LINK_SENT', updated_at = NOW()
       WHERE id = $3 AND (company_id = $4 OR $4 IS NULL)
       RETURNING *`,
      [token, expiresAt, onboarding_id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }

    const ob = result.rows[0];
    const candidateData = ob.candidate_submitted_data || {};
    const candidateName = `${candidateData.first_name || ''} ${candidateData.last_name || ''}`.trim() || 'Candidate';
    const candidateEmail = candidateData.email || '';
    const designation = candidateData.job_title || '';

    const protocol = req.protocol || 'https';
    const host = req.get('host') || 'newhrms.brihaspathi.in';
    const fullMagicUrl = `${protocol}://${host}/onboard?token=${token}`;

    const mailResult = await sendOnboardingInviteEmail(
      companyId ?? null,
      candidateName,
      candidateEmail,
      designation,
      ob.target_joining_date,
      fullMagicUrl,
      sender_email,
      ob.id
    );

    enqueueActivityLog(companyId ?? null, email || '', 'ONBOARDING_LINK_SENT', 'onboarding', `Sent portal link for onboarding ID ${onboarding_id}`, req.ip || '', (req.headers['user-agent'] as string) || '');

    return res.json({ 
      message: mailResult.success ? 'Onboarding portal link sent successfully via Email' : `Link generated, but Email dispatch failed: ${mailResult.error}`,
      onboarding: { ...ob, email_status: mailResult.success ? 'SENT' : 'FAILED', email_error_message: mailResult.error },
      email_sent: mailResult.success,
      email_error: mailResult.error,
      token,
      portal_url: `/onboard?token=${token}`
    });
  } catch (err) {
    console.error('Error sending onboarding link:', err);
    return res.status(500).json({ error: 'Failed to send onboarding link' });
  }
});

/**
 * @openapi
 * /api/v1/onboarding/{id}/accept-offer:
 *   post:
 *     summary: HR Manual Accept Offer
 *     tags:
 *       - Employee Onboarding
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
 *         description: Offer accepted manually by HR
 *       404:
 *         description: Onboarding record not found
 */
router.post('/:id/accept-offer', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { id } = req.params;

    const existing = await query(`SELECT * FROM hrms.employee_onboardings WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }

    const rec = existing.rows[0];
    const defaultData = rec.candidate_submitted_data || {
      pan_number: 'ABCDE1234F',
      aadhar_number: '987654321098',
      current_address: 'Plot 42, Hitech City, Hyderabad',
      bank_information: [{ bank_name: 'HDFC BANK', account_number: '50100492817291', ifsc_code: 'HDFC0001234', branch_name: 'Hitech City' }],
      emergency_contacts: [{ name: 'Venkatesh', relationship: 'Father', phone: '9848022338' }]
    };

    const result = await query(
      `UPDATE hrms.employee_onboardings 
       SET onboarding_status = 'DOCS_SUBMITTED', candidate_submitted_data = $1, updated_at = NOW()
       WHERE id = $2 AND (company_id = $3 OR $3 IS NULL)
       RETURNING *`,
      [JSON.stringify(defaultData), id, companyId]
    );

    enqueueActivityLog(companyId ?? null, email || '', 'OFFER_ACCEPTED_MANUAL', 'onboarding', `HR manually accepted offer for onboarding ID ${id}`, req.ip || '', (req.headers['user-agent'] as string) || '');

    return res.json({ message: 'Offer accepted manually by HR. Candidate details ready for review.', onboarding: result.rows[0] });
  } catch (err) {
    console.error('Error manually accepting offer:', err);
    return res.status(500).json({ error: 'Failed to accept offer' });
  }
});

/**
 * @openapi
 * /api/v1/onboarding/{id}/reject-offer:
 *   post:
 *     summary: HR Manual Reject/Cancel Offer
 *     tags:
 *       - Employee Onboarding
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
 *         description: Offer marked as rejected/cancelled
 *       404:
 *         description: Onboarding record not found
 */
router.post('/:id/reject-offer', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { id } = req.params;

    const result = await query(
      `UPDATE hrms.employee_onboardings 
       SET onboarding_status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 AND (company_id = $2 OR $2 IS NULL)
       RETURNING *`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }

    enqueueActivityLog(companyId ?? null, email || '', 'OFFER_REJECTED_MANUAL', 'onboarding', `Offer rejected/cancelled for onboarding ID ${id}`, req.ip || '', (req.headers['user-agent'] as string) || '');

    return res.json({ message: 'Offer marked as rejected/cancelled', onboarding: result.rows[0] });
  } catch (err) {
    console.error('Error rejecting offer:', err);
    return res.status(500).json({ error: 'Failed to reject offer' });
  }
});

/**
 * HR Verify & Approve Documents
 */
router.post('/:id/verify-docs', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { id } = req.params;

    const existing = await query(`SELECT * FROM hrms.employee_onboardings WHERE id = $1 AND (company_id = $2 OR $2 IS NULL)`, [id, companyId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }

    const verificationObj = JSON.stringify({
      status: 'VERIFIED',
      verified_by: email,
      verified_at: new Date().toISOString()
    });

    const result = await query(
      `UPDATE hrms.employee_onboardings 
       SET onboarding_status = 'VERIFIED', document_verification_status = $1::jsonb, updated_at = NOW()
       WHERE id = $2 AND (company_id = $3 OR $3 IS NULL)
       RETURNING *`,
      [verificationObj, id, companyId]
    );

    enqueueActivityLog(companyId ?? null, email || '', 'ONBOARDING_DOCS_VERIFIED', 'onboarding', `HR approved and verified compliance documents for onboarding ID ${id}`, req.ip || '', (req.headers['user-agent'] as string) || '');

    return res.json({ message: 'Compliance documents verified & approved successfully!', onboarding: result.rows[0] });
  } catch (err) {
    console.error('Error verifying onboarding documents:', err);
    return res.status(500).json({ error: 'Failed to verify onboarding documents' });
  }
});

/**
 * HR Request Document Re-Upload from Candidate
 */
router.post('/:id/request-reupload', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { id } = req.params;
    const { notes, missing_docs } = req.body;

    const existing = await query(`SELECT * FROM hrms.employee_onboardings WHERE id = $1 AND (company_id = $2 OR $2 IS NULL)`, [id, companyId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }

    const verificationObj = JSON.stringify({
      status: 'REUPLOAD_REQUESTED',
      requested_by: email,
      requested_at: new Date().toISOString(),
      notes: notes || 'Please re-upload missing/blurry compliance documents',
      missing_docs: missing_docs || []
    });

    const result = await query(
      `UPDATE hrms.employee_onboardings 
       SET onboarding_status = 'LINK_SENT', document_verification_status = $1::jsonb, notes = $2, updated_at = NOW()
       WHERE id = $3 AND (company_id = $4 OR $4 IS NULL)
       RETURNING *`,
      [verificationObj, notes || 'Re-upload requested by HR', id, companyId]
    );

    enqueueActivityLog(companyId ?? null, email || '', 'ONBOARDING_REUPLOAD_REQUESTED', 'onboarding', `HR requested document re-upload for onboarding ID ${id}`, req.ip || '', (req.headers['user-agent'] as string) || '');

    return res.json({ message: 'Re-upload request recorded and portal magic link reset for candidate.', onboarding: result.rows[0] });
  } catch (err) {
    console.error('Error requesting document re-upload:', err);
    return res.status(500).json({ error: 'Failed to request document re-upload' });
  }
});

/**
 * @openapi
 * /api/v1/onboarding/{id}/approve:
 *   post:
 *     summary: Convert Onboarding Candidate to Active Employee (1-Click Approval)
 *     tags:
 *       - Employee Onboarding
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
 *         description: Candidate successfully converted into active employee record
 *       400:
 *         description: Candidate already converted
 *       404:
 *         description: Onboarding record not found
 */
router.post('/:id/approve', authenticateToken as any, requirePermission('recruitment:write') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, email } = req.user!;
    const { id } = req.params;

    // Fetch onboarding record
    const obRes = await query(
      `SELECT ob.*, c.first_name, c.last_name, c.email, c.phone 
       FROM hrms.employee_onboardings ob 
       JOIN hrms.candidates c ON c.id = ob.candidate_id 
       WHERE ob.id = $1 AND (ob.company_id = $2 OR $2 IS NULL)`,
      [id, companyId]
    );

    if (obRes.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }

    const ob = obRes.rows[0];

    // Check if already approved/converted
    if (ob.created_employee_id || ob.onboarding_status === 'COMPLETED') {
      return res.status(400).json({ error: 'Candidate has already been converted into an Active Employee' });
    }

    // Auto-generate emp_id_code (e.g. EMP-1046)
    const empSeqRes = await query(`SELECT COUNT(*) as count FROM hrms.employees`);
    const nextNum = parseInt(empSeqRes.rows[0].count, 10) + 1045;
    const empIdCode = `EMP-${nextNum}`;

    // Create employee record
    const empRes = await query(
      `INSERT INTO hrms.employees (
        company_id, emp_id_code, first_name, last_name, email, phone, 
        designation, joining_date, employment_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', NOW())
      RETURNING *`,
      [
        ob.company_id,
        empIdCode,
        ob.first_name,
        ob.last_name,
        ob.email,
        ob.phone,
        ob.job_title || 'Software Engineer',
        ob.target_joining_date || new Date().toISOString().split('T')[0]
      ]
    );

    const newEmp = empRes.rows[0];

    // Update onboarding record status to COMPLETED
    await query(
      `UPDATE hrms.employee_onboardings 
       SET created_employee_id = $1, onboarding_status = 'COMPLETED', actual_joining_date = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [newEmp.id, id]
    );

    enqueueActivityLog(companyId ?? null, email || '', 'ONBOARDING_APPROVED', 'onboarding', `Converted onboarding candidate ${ob.first_name} into employee ${empIdCode}`, req.ip || '', (req.headers['user-agent'] as string) || '');

    return res.json({
      message: 'Onboarding approved successfully! Candidate is now an Active Employee.',
      employee: newEmp
    });
  } catch (err) {
    console.error('Error approving onboarding:', err);
    return res.status(500).json({ error: 'Failed to approve onboarding' });
  }
});

router.get('/portal-status', async (req: any, res: any) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing onboarding token' });

    const obRes = await query(
      `SELECT ob.*, 
              COALESCE(
                NULLIF(TRIM(c.first_name || ' ' || c.last_name), ''), 
                NULLIF(TRIM(COALESCE(ob.candidate_submitted_data->>'first_name', '') || ' ' || COALESCE(ob.candidate_submitted_data->>'last_name', '')), ''),
                ob.candidate_submitted_data->>'full_name',
                'Candidate'
              ) as candidate_name,
              COALESCE(c.email, ob.candidate_submitted_data->>'email', '') as candidate_email,
              comp.name as company_name,
              comp.branding_logo
       FROM hrms.employee_onboardings ob
       LEFT JOIN hrms.candidates c ON c.id = ob.candidate_id
       LEFT JOIN hrms.companies comp ON comp.id = ob.company_id
       WHERE ob.portal_token = $1`,
      [token]
    );

    if (obRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid onboarding link or link has expired' });
    }

    const ob = obRes.rows[0];

    // Fallback company details if not directly joined
    let finalCompanyName = ob.company_name;
    let finalCompanyLogo = ob.branding_logo;

    if (!finalCompanyName) {
      const defaultComp = await query(`SELECT name, branding_logo FROM hrms.companies ORDER BY created_at ASC LIMIT 1`);
      if (defaultComp.rows.length > 0) {
        finalCompanyName = defaultComp.rows[0].name;
        finalCompanyLogo = defaultComp.rows[0].branding_logo;
      }
    }

    // Check expiry
    const isExpired = ob.token_expires_at && new Date(ob.token_expires_at).getTime() < Date.now();
    const isAlreadySubmitted = ob.onboarding_status === 'DOCS_SUBMITTED' || ob.onboarding_status === 'COMPLETED';
    const candidateType = ob.candidate_submitted_data?.candidate_type || 'EXPERIENCED';

    return res.json({
      valid: !isExpired,
      already_submitted: isAlreadySubmitted,
      is_expired: isExpired,
      onboarding_status: ob.onboarding_status,
      token_expires_at: ob.token_expires_at,
      created_at: ob.created_at,
      candidate_name: ob.candidate_name,
      designation: ob.job_title || ob.candidate_submitted_data?.job_title || 'Software Engineer',
      work_location: ob.work_location || 'Corporate Office, Hyderabad',
      company_name: finalCompanyName || 'Brihaspathi Rail Private Limited',
      company_logo: finalCompanyLogo || '',
      target_joining_date: ob.target_joining_date,
      candidate_type: candidateType,
      submitted_data: ob.candidate_submitted_data
    });
  } catch (err: any) {
    console.error('Error checking portal status:', err);
    return res.status(500).json({ error: 'Failed to check portal status' });
  }
});

/**
 * Public Candidate Accept Offer Endpoint (One-Time Acceptance & 48h Limit Check)
 */
router.post('/accept-offer', async (req: any, res: any) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing onboarding token' });

    const obRes = await query(`SELECT * FROM hrms.employee_onboardings WHERE portal_token = $1`, [token]);
    if (obRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid onboarding token' });
    }

    const ob = obRes.rows[0];

    // 1. Strict 2 days / 48 hours expiry check
    if (ob.token_expires_at && new Date(ob.token_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'This offer letter link has expired (48-hour limit exceeded). Please contact HR.' });
    }

    // 2. Idempotent / Single-time acceptance check
    if (ob.onboarding_status === 'OFFER_ACCEPTED' || ob.onboarding_status === 'LINK_SENT' || ob.onboarding_status === 'DOCS_SUBMITTED' || ob.onboarding_status === 'VERIFIED') {
      return res.json({
        message: 'Offer letter has already been accepted!',
        already_accepted: true,
        onboarding_status: ob.onboarding_status,
        onboarding: ob
      });
    }

    // 3. Transition status to OFFER_ACCEPTED
    const updateRes = await query(
      `UPDATE hrms.employee_onboardings
       SET onboarding_status = 'OFFER_ACCEPTED',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [ob.id]
    );

    return res.json({
      message: 'Offer letter accepted successfully!',
      already_accepted: false,
      onboarding: updateRes.rows[0]
    });
  } catch (err: any) {
    console.error('Error accepting offer letter:', err);
    return res.status(500).json({ error: 'Failed to accept offer letter' });
  }
});

/**
 * Public Candidate Portal Submission (Single-Use Token Lock)
 */
router.post('/portal-submit', async (req: any, res: any) => {
  try {
    const { 
      token, candidate_type, pan_number, aadhar_number, current_address, highest_education,
      bank_name, account_number, ifsc_code, emergency_name, emergency_phone, emergency_relationship,
      previous_company, previous_designation, documents
    } = req.body;

    if (!token) return res.status(400).json({ error: 'Missing onboarding token' });

    const obRes = await query(`SELECT * FROM hrms.employee_onboardings WHERE portal_token = $1`, [token]);
    if (obRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid onboarding token' });
    }

    const ob = obRes.rows[0];

    // Check if already submitted or expired
    if (ob.onboarding_status === 'DOCS_SUBMITTED' || ob.onboarding_status === 'COMPLETED') {
      return res.status(400).json({ error: 'You have already submitted your onboarding details successfully!' });
    }

    if (ob.token_expires_at && new Date(ob.token_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'This onboarding magic link has expired (48-hour limit exceeded). Please contact HR.' });
    }

    const currentData = ob.candidate_submitted_data || {};
    const updatedData = {
      ...currentData,
      candidate_type: candidate_type || currentData.candidate_type || 'EXPERIENCED',
      pan_number,
      aadhar_number,
      current_address,
      highest_education,
      bank_information: [{ bank_name, account_number, ifsc_code }],
      emergency_contacts: [{ name: emergency_name, phone: emergency_phone, relationship: emergency_relationship }],
      previous_company: previous_company || '',
      previous_designation: previous_designation || '',
      documents: documents || {}
    };

    const verificationStatusJson = JSON.stringify({
      overall_status: 'VERIFIED',
      submitted_at: new Date().toISOString()
    });

    await query(
      `UPDATE hrms.employee_onboardings
       SET onboarding_status = 'DOCS_SUBMITTED',
           form_submitted_at = NOW(),
           document_verification_status = $1::jsonb,
           candidate_submitted_data = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [verificationStatusJson, JSON.stringify(updatedData), ob.id]
    );

    return res.json({ message: 'Onboarding verification details submitted successfully!' });
  } catch (err: any) {
    console.error('Error submitting candidate onboarding details:', err);
    return res.status(500).json({ error: 'Failed to submit onboarding details' });
  }
});

export default router;
