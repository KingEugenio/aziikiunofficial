/**
 * Shared branded shell for every transactional email this app sends via
 * Resend (see resendClient.ts / notify.ts). Table-based layout with inline
 * styles throughout - deliberately not modern CSS, since email clients
 * (Outlook especially) strip most of it. Keep this the ONE place Aziiki's
 * email branding lives, so every email looks like it came from the same
 * product.
 */
export function wrapEmailHtml(params: { preheader?: string; bodyHtml: string }): string {
  const { preheader = "", bodyHtml } = params;
  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <span style="display:none; font-size:1px; color:#f8fafc; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0;">
            <tr>
              <td style="background-color:#006837; padding:24px 28px;">
                <span style="font-size:18px; font-weight:800; color:#ffffff; letter-spacing:-0.02em;">Aziiki</span>
                <div style="font-size:11px; color:#a7f3d0; font-family: monospace; letter-spacing:0.08em; text-transform:uppercase; margin-top:2px;">Your Business. Organized.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px; border-top:1px solid #f1f5f9;">
                <p style="font-size:11px; color:#94a3b8; margin:0; line-height:1.6;">
                  You're receiving this because you have an Aziiki account. If this wasn't you, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
