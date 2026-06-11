import nodemailer from 'nodemailer';

// ── Transporter ───────────────────────────────────────────────────────────
// Supports any SMTP provider. Configure via env vars:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// Gmail shortcut: set SMTP_USER + SMTP_PASS (app password) — host/port auto-set.

function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const FROM = () =>
  process.env.SMTP_FROM || `GoLive Admin <${process.env.SMTP_USER || 'noreply@gobilive.com'}>`;

// ── Templates ─────────────────────────────────────────────────────────────

function approvalEmailHtml(opts: {
  fullName: string;
  username: string;
  password: string;
  role: string;
  loginUrl: string;
}) {
  const roleLabel = opts.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { margin:0; padding:0; background:#f8f9fa; font-family:'Outfit','Segoe UI',sans-serif; }
    .wrap { max-width:520px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb; }
    .header { background:#2563eb; padding:32px 40px; text-align:center; }
    .header h1 { color:#ffffff; margin:0; font-size:22px; font-weight:600; letter-spacing:-0.3px; }
    .header p { color:#bfdbfe; margin:6px 0 0; font-size:13px; }
    .body { padding:36px 40px; }
    .body p { color:#374151; font-size:14px; line-height:1.7; margin:0 0 16px; }
    .creds { background:#f8f9fa; border:1px solid #e5e7eb; border-radius:10px; padding:20px 24px; margin:20px 0; }
    .cred-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f3f4f6; }
    .cred-row:last-child { border-bottom:none; }
    .cred-label { font-size:12px; color:#9ca3af; font-weight:500; text-transform:uppercase; letter-spacing:0.5px; }
    .cred-value { font-size:14px; color:#111111; font-weight:600; font-family:monospace; }
    .btn { display:block; text-align:center; background:#111111; color:#ffffff !important; text-decoration:none; padding:14px 32px; border-radius:10px; font-size:14px; font-weight:600; margin:24px 0 0; }
    .note { font-size:12px; color:#9ca3af; margin:16px 0 0; text-align:center; }
    .footer { padding:20px 40px; text-align:center; border-top:1px solid #f3f4f6; }
    .footer p { font-size:12px; color:#d1d5db; margin:0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>GoLive Admin Portal</h1>
      <p>Your registration has been approved</p>
    </div>
    <div class="body">
      <p>Hi <strong>${opts.fullName}</strong>,</p>
      <p>
        Great news — your <strong>${roleLabel}</strong> registration on GoLive has been
        approved. Your account is ready. Use the credentials below to sign in.
      </p>

      <div class="creds">
        <div class="cred-row">
          <span class="cred-label">Username</span>
          <span class="cred-value">@${opts.username}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Password</span>
          <span class="cred-value">${opts.password}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Role</span>
          <span class="cred-value">${roleLabel}</span>
        </div>
      </div>

      <a href="${opts.loginUrl}" class="btn">Sign In to Admin Portal →</a>
      <p class="note">Please change your password after your first login.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} GoLive · This is an automated message, do not reply.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function rejectionEmailHtml(opts: {
  fullName: string;
  role: string;
  reason?: string;
}) {
  const roleLabel = opts.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { margin:0; padding:0; background:#f8f9fa; font-family:'Outfit','Segoe UI',sans-serif; }
    .wrap { max-width:520px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb; }
    .header { background:#ef4444; padding:32px 40px; text-align:center; }
    .header h1 { color:#ffffff; margin:0; font-size:22px; font-weight:600; }
    .header p { color:#fecaca; margin:6px 0 0; font-size:13px; }
    .body { padding:36px 40px; }
    .body p { color:#374151; font-size:14px; line-height:1.7; margin:0 0 16px; }
    .reason { background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:16px 20px; color:#b91c1c; font-size:13px; }
    .footer { padding:20px 40px; text-align:center; border-top:1px solid #f3f4f6; }
    .footer p { font-size:12px; color:#d1d5db; margin:0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>GoLive Admin Portal</h1>
      <p>Registration update</p>
    </div>
    <div class="body">
      <p>Hi <strong>${opts.fullName}</strong>,</p>
      <p>
        We regret to inform you that your <strong>${roleLabel}</strong> registration
        on GoLive could not be approved at this time.
      </p>
      ${opts.reason ? `<div class="reason"><strong>Reason:</strong> ${opts.reason}</div>` : ''}
      <p style="margin-top:16px;">
        If you believe this is a mistake, please contact support or re-apply
        with the correct information.
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} GoLive · This is an automated message, do not reply.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function sendApprovalEmail(opts: {
  to: string;
  fullName: string;
  username: string;
  password: string;
  role: string;
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Email] SMTP_USER or SMTP_PASS not set — skipping approval email');
    return;
  }
  const loginUrl = `${process.env.APP_URL || 'https://gobilive-production.up.railway.app'}/admin/login`;
  const transporter = createTransporter();
  await transporter.sendMail({
    from: FROM(),
    to: opts.to,
    subject: '✅ Your GoLive registration has been approved',
    html: approvalEmailHtml({ ...opts, loginUrl }),
  });
  console.log(`[Email] Approval email sent to ${opts.to}`);
}

export async function sendRejectionEmail(opts: {
  to: string;
  fullName: string;
  role: string;
  reason?: string;
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Email] SMTP_USER or SMTP_PASS not set — skipping rejection email');
    return;
  }
  const transporter = createTransporter();
  await transporter.sendMail({
    from: FROM(),
    to: opts.to,
    subject: 'Update on your GoLive registration request',
    html: rejectionEmailHtml(opts),
  });
  console.log(`[Email] Rejection email sent to ${opts.to}`);
}
