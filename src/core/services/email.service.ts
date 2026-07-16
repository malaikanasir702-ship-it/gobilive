import { Resend } from 'resend';

// ── Resend transactional email ────────────────────────────────────────────
// Set RESEND_API_KEY in Railway environment variables.
// Get a free key from https://resend.com → Dashboard → API Keys
//
// From address:
//   - Free plan (no domain): use "onboarding@resend.dev"
//   - Custom domain: verify at resend.com → Domains, then use "noreply@yourdomain.com"
// Set RESEND_FROM in Railway to override. Default: "GoLive <onboarding@resend.dev>"

function getResend() {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');
  return new Resend(apiKey);
}

const FROM_ADDRESS = () =>
  process.env.RESEND_FROM ||
  process.env.SMTP_FROM ||
  'GoLive <onboarding@resend.dev>';

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
    body { margin:0; padding:0; background:#f8f9fa; font-family:'Segoe UI',sans-serif; }
    .wrap { max-width:520px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb; }
    .header { background:#2563eb; padding:32px 40px; text-align:center; }
    .header h1 { color:#ffffff; margin:0; font-size:22px; font-weight:600; }
    .header p { color:#bfdbfe; margin:6px 0 0; font-size:13px; }
    .body { padding:36px 40px; }
    .body p { color:#374151; font-size:14px; line-height:1.7; margin:0 0 16px; }
    .creds { background:#f8f9fa; border:1px solid #e5e7eb; border-radius:10px; padding:20px 24px; margin:20px 0; }
    .cred-row { padding:8px 0; border-bottom:1px solid #f3f4f6; }
    .cred-row:last-child { border-bottom:none; }
    .cred-label { font-size:12px; color:#9ca3af; font-weight:500; text-transform:uppercase; }
    .cred-value { font-size:14px; color:#111111; font-weight:600; font-family:monospace; }
    .btn { display:block; text-align:center; background:#2563eb; color:#ffffff !important; text-decoration:none; padding:14px 32px; border-radius:10px; font-size:14px; font-weight:600; margin:24px 0 0; }
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
      <p>Your <strong>${roleLabel}</strong> registration on GoLive has been approved. Use the credentials below to sign in.</p>
      <div class="creds">
        <div class="cred-row">
          <div class="cred-label">Username</div>
          <div class="cred-value">@${opts.username}</div>
        </div>
        <div class="cred-row">
          <div class="cred-label">Password</div>
          <div class="cred-value">${opts.password}</div>
        </div>
        <div class="cred-row">
          <div class="cred-label">Role</div>
          <div class="cred-value">${roleLabel}</div>
        </div>
      </div>
      <a href="${opts.loginUrl}" class="btn">Sign In to Admin Portal →</a>
      <p class="note">Please change your password after your first login.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} GoLive · Automated message, do not reply.</p>
    </div>
  </div>
</body>
</html>`.trim();
}

function rejectionEmailHtml(opts: { fullName: string; role: string; reason?: string }) {
  const roleLabel = opts.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { margin:0; padding:0; background:#f8f9fa; font-family:'Segoe UI',sans-serif; }
    .wrap { max-width:520px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb; }
    .header { background:#ef4444; padding:32px 40px; text-align:center; }
    .header h1 { color:#ffffff; margin:0; font-size:22px; font-weight:600; }
    .body { padding:36px 40px; }
    .body p { color:#374151; font-size:14px; line-height:1.7; margin:0 0 16px; }
    .reason { background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:16px 20px; color:#b91c1c; font-size:13px; }
    .footer { padding:20px 40px; text-align:center; border-top:1px solid #f3f4f6; }
    .footer p { font-size:12px; color:#d1d5db; margin:0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header"><h1>GoLive Registration Update</h1></div>
    <div class="body">
      <p>Hi <strong>${opts.fullName}</strong>,</p>
      <p>Your <strong>${roleLabel}</strong> registration could not be approved at this time.</p>
      ${opts.reason ? `<div class="reason"><strong>Reason:</strong> ${opts.reason}</div>` : ''}
      <p style="margin-top:16px;">Please contact support or re-apply with the correct information.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} GoLive · Automated message, do not reply.</p>
    </div>
  </div>
</body>
</html>`.trim();
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function sendApprovalEmail(opts: {
  to: string;
  fullName: string;
  username: string;
  password: string;
  role: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not set — skipping approval email');
    return;
  }

  const resend = getResend();
  const loginUrl = `${process.env.APP_URL || 'https://gobilive-production.up.railway.app'}/admin/login`;

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS(),
    to: [opts.to],
    subject: '✅ Your GoLive registration has been approved',
    html: approvalEmailHtml({ ...opts, loginUrl }),
  });

  if (error) {
    console.error('[Email] Resend error:', error);
    throw new Error(error.message);
  }

  console.log(`[Email] Approval email sent to ${opts.to} — id: ${data?.id}`);
}

export async function sendRejectionEmail(opts: {
  to: string;
  fullName: string;
  role: string;
  reason?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not set — skipping rejection email');
    return;
  }

  const resend = getResend();

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS(),
    to: [opts.to],
    subject: 'Update on your GoLive registration request',
    html: rejectionEmailHtml(opts),
  });

  if (error) {
    console.error('[Email] Resend rejection error:', error);
    throw new Error(error.message);
  }

  console.log(`[Email] Rejection email sent to ${opts.to} — id: ${data?.id}`);
}
