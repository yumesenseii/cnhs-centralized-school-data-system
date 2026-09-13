/**
 * Brevo transactional email helper for Edge Functions.
 * Requires BREVO_API_KEY and BREVO_SENDER_EMAIL (BREVO_SENDER_NAME optional).
 */

export type BrevoSendResult =
  | { ok: true }
  | { ok: false; error: string };

export function requireBrevoConfig() {
  const apiKey = Deno.env.get("BREVO_API_KEY")?.trim();
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL")?.trim();
  const senderName = Deno.env.get("BREVO_SENDER_NAME")?.trim() || "CNHS Learn";

  if (!apiKey || !senderEmail) {
    return {
      ok: false as const,
      error:
        "Email is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL on the Edge Function.",
    };
  }

  return { ok: true as const, apiKey, senderEmail, senderName };
}

export function appOriginFromEnv() {
  return (
    Deno.env.get("APP_ORIGIN") ||
    Deno.env.get("SITE_URL") ||
    ""
  ).trim().replace(/\/$/, "");
}

export function loginUrlFromEnv() {
  const origin = appOriginFromEnv();
  return origin ? `${origin}/login` : "";
}

export async function sendBrevoTransactionalEmail({
  toEmail,
  toName,
  subject,
  textContent,
  htmlContent,
}: {
  toEmail: string;
  toName?: string;
  subject: string;
  textContent: string;
  htmlContent: string;
}): Promise<BrevoSendResult> {
  const config = requireBrevoConfig();
  if (!config.ok) return config;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": config.apiKey,
    },
    body: JSON.stringify({
      sender: { email: config.senderEmail, name: config.senderName },
      to: [{ email: toEmail, name: toName || toEmail }],
      subject,
      textContent,
      htmlContent,
    }),
  });

  if (!response.ok) {
    let detail = `Brevo returned ${response.status}.`;
    try {
      const payload = await response.json();
      if (payload?.message) detail = String(payload.message);
    } catch {
      /* keep status text */
    }
    return { ok: false, error: `Unable to send welcome email. ${detail}` };
  }

  return { ok: true };
}

export function welcomeAccountEmail({
  fullName,
  email,
  temporaryPassword,
  loginUrl,
}: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const safeName = escapeHtml(fullName);
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(temporaryPassword);
  const safeLoginUrl = loginUrl ? escapeHtml(loginUrl) : "";
  const origin =
    appOriginFromEnv() ||
    (loginUrl ? loginUrl.replace(/\/login\/?$/, "") : "");
  const safeOrigin = origin ? escapeHtml(origin) : "";
  const logoUrl = safeOrigin ? `${safeOrigin}/cnhs-logo.png` : "";
  const campusUrl = safeOrigin
    ? `${safeOrigin}/assets/images/login/cnhs-building.png`
    : "";

  const textContent = [
    "CNHS Learn",
    "Cambaog National High School",
    "Learn · Grow · Succeed Together",
    "Quality Education for a Brighter Tomorrow",
    "",
    `Hello ${fullName},`,
    "",
    "The Head Teacher created a CNHS Learn account for you. Use the sign-in details below to access your account.",
    "",
    `Email address: ${email}`,
    `Temporary password: ${temporaryPassword}`,
    "",
    ...(loginUrl ? [`Sign in to CNHS Learn: ${loginUrl}`, ""] : []),
    "You must change this password on first login and accept the Terms of Use and Privacy Policy. Do not share this email or password.",
    "",
    "If you did not expect this email, please contact the school Head Teacher.",
    "",
    "Cambaog National High School",
    "Learners Today. A Better Tomorrow.",
    "General Alejo G. Santos Highway, Purok 3, Cambaog, Bustos, Bulacan, Philippines 3007",
    "0912 345 6789",
    "cnhslearn091305@gmail.com",
    '"Education Empowers Communities"',
    "",
    "© 2026 CNHS Learn. All rights reserved.",
    "Terms of Use | Privacy Policy",
  ].join("\n");

  const logoCell = logoUrl
    ? `<img src="${logoUrl}" width="44" height="44" alt="CNHS Learn" style="display:block;width:44px;height:44px;border-radius:22px;border:2px solid rgba(255,255,255,0.35);background:#ffffff;" />`
    : `<div style="width:44px;height:44px;border-radius:22px;background:#ffffff;color:#174D37;font-size:11px;font-weight:700;line-height:44px;text-align:center;">CNHS</div>`;

  const campusRow = campusUrl
    ? `<tr>
        <td style="padding:0;line-height:0;font-size:0;">
          <img src="${campusUrl}" alt="Cambaog National High School" width="560" style="display:block;width:100%;max-height:120px;object-fit:cover;" />
        </td>
      </tr>`
    : "";

  const signInButton = safeLoginUrl
    ? `<tr>
        <td style="padding:8px 28px 20px;">
          <a href="${safeLoginUrl}" style="display:block;background:#174D37;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:999px;text-align:center;">
            Sign in to CNHS Learn &rarr;
          </a>
        </td>
      </tr>`
    : "";

  const htmlContent = `
    <div style="margin:0;padding:24px 12px;background:#f1f5f4;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#174D37;padding:20px 24px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="56" valign="middle">${logoCell}</td>
                <td valign="middle" style="padding-left:12px;color:#ffffff;">
                  <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;line-height:1.2;">CNHS Learn</div>
                  <div style="margin-top:3px;font-size:12px;line-height:1.35;color:#d1fae5;">Cambaog National High School</div>
                  <div style="margin-top:2px;font-size:11px;color:#a7f3d0;">Learn · Grow · Succeed Together</div>
                </td>
                <td width="130" valign="middle" align="right" style="color:#ecfdf5;font-size:10px;line-height:1.4;letter-spacing:0.02em;">
                  Quality Education<br />for a Brighter Tomorrow
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${campusRow}
        <tr>
          <td style="padding:28px 28px 6px;color:#0f172a;font-size:22px;font-weight:700;letter-spacing:-0.03em;line-height:1.3;">
            Hello ${safeName},
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 22px;color:#475569;font-size:14px;line-height:1.6;">
            The Head Teacher created a CNHS Learn account for you. Use the sign-in details below to access your account.
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="36" valign="top" style="padding-top:2px;">
                  <div style="width:28px;height:28px;border-radius:14px;background:#ecfdf5;color:#174D37;font-size:12px;font-weight:700;line-height:28px;text-align:center;">@</div>
                </td>
                <td valign="top" style="padding-left:8px;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Email address</div>
                  <div style="padding-top:4px;font-size:15px;color:#0f172a;">${safeEmail}</div>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:14px 0 12px;">
                  <div style="border-top:1px solid #e2e8f0;font-size:0;line-height:0;">&nbsp;</div>
                </td>
              </tr>
              <tr>
                <td width="36" valign="top" style="padding-top:2px;">
                  <div style="width:28px;height:28px;border-radius:14px;background:#ecfdf5;color:#174D37;font-size:12px;font-weight:700;line-height:28px;text-align:center;">*</div>
                </td>
                <td valign="top" style="padding-left:8px;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Temporary password</div>
                  <div style="padding-top:4px;font-size:16px;font-weight:700;font-family:Consolas,Monaco,monospace;color:#174D37;letter-spacing:0.02em;">${safePassword}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${signInButton}
        <tr>
          <td style="padding:4px 28px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;">
              <tr>
                <td width="28" valign="top" style="padding:12px 0 12px 14px;color:#174D37;font-size:14px;font-weight:700;">i</td>
                <td style="padding:12px 14px 12px 0;color:#475569;font-size:13px;line-height:1.55;">
                  You must change this password on first login and accept the Terms of Use and Privacy Policy. Do not share this email or password.
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 22px;color:#94a3b8;font-size:12px;line-height:1.55;">
            If you did not expect this email, please contact the school Head Teacher.
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 10px;border-top:1px solid #e2e8f0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="top" style="color:#0f172a;padding-right:12px;">
                  <div style="font-size:13px;font-weight:700;">Cambaog National High School</div>
                  <div style="margin-top:4px;font-size:12px;color:#64748b;">Learners Today. A Better Tomorrow.</div>
                  <div style="margin-top:10px;font-size:12px;line-height:1.55;color:#64748b;">
                    General Alejo G. Santos Highway, Purok 3, Cambaog, Bustos, Bulacan, Philippines 3007<br />
                    0912 345 6789<br />
                    cnhslearn091305@gmail.com
                  </div>
                </td>
                <td width="150" valign="top" align="right" style="color:#174D37;font-size:13px;font-style:italic;line-height:1.45;">
                  &ldquo;Education Empowers Communities&rdquo;
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 24px;color:#94a3b8;font-size:11px;line-height:1.5;">
            © 2026 CNHS Learn. All rights reserved.<br />
            Terms of Use | Privacy Policy
          </td>
        </tr>
      </table>
    </div>
  `;

  return {
    subject: "CNHS Learn · Temporary password for your account",
    textContent,
    htmlContent,
  };
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
