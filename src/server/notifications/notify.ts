import { getServiceRoleClient } from "../supabaseClients";
import { isEmailConfigured, sendTransactionalEmail } from "../email/resendClient";
import { wrapEmailHtml } from "../email/emailTemplate";

export type NotificationType = "invoice_overdue" | "low_stock" | "payment_received";

interface CreateNotificationParams {
  userId: string;
  businessId: string;
  type: NotificationType;
  referenceId?: string;
  title: string;
  message: string;
  recipientEmail: string;
}

/**
 * Logs a notification (always visible in-app via GET /api/notifications)
 * and, when RESEND_API_KEY is configured, emails it too. Both the log write
 * and the email send are best-effort: a notification failing must never
 * break the real workflow that triggered it (a payment, a stock adjustment,
 * an overdue sweep) - errors are logged server-side and swallowed here.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const supabase = getServiceRoleClient();

  const { data: row, error } = await supabase
    .from("notification_log")
    .insert({
      user_id: params.userId,
      business_id: params.businessId,
      type: params.type,
      reference_id: params.referenceId ?? null,
      title: params.title,
      message: params.message,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[notifications] failed to log notification:", error.message);
    return;
  }

  if (!isEmailConfigured()) return;

  try {
    await sendTransactionalEmail({
      to: params.recipientEmail,
      subject: params.title,
      html: wrapEmailHtml({
        preheader: params.message,
        bodyHtml: `
          <p style="font-size:17px; font-weight:800; color:#0f172a; margin:0 0 10px;">${params.title}</p>
          <p style="font-size:14px; line-height:1.6; color:#475569; margin:0 0 20px;">${params.message}</p>
          <a href="https://aziiki.com" style="display:inline-block; background-color:#006837; color:#ffffff; font-size:13px; font-weight:700; text-decoration:none; padding:10px 20px; border-radius:10px;">Open Aziiki</a>
        `,
      }),
    });
    await supabase.from("notification_log").update({ email_sent_at: new Date().toISOString() }).eq("id", row.id);
  } catch (err) {
    // EmailSendError (or any other failure) - the notification is still
    // logged and visible in-app even though the email itself didn't go out.
    console.error("[notifications] email send failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Has this exact reference already triggered this notification type before?
 * Used to make the overdue-invoice sweep and low-stock checks idempotent -
 * an invoice/item is only ever notified about once per crossing, not once
 * per interval tick or once per sale.
 */
export async function hasExistingNotification(type: NotificationType, referenceId: string): Promise<boolean> {
  const supabase = getServiceRoleClient();
  const { count } = await supabase
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("type", type)
    .eq("reference_id", referenceId);
  return Boolean(count && count > 0);
}
