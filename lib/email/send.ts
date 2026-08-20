import { Resend } from "resend";
import { env } from "../env";

let _resend: Resend | null = null;
function client(): Resend {
  if (!_resend) _resend = new Resend(env.resendApiKey());
  return _resend;
}

export interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendArgs) {
  const res = await client().emails.send({
    from: env.emailFrom(),
    to,
    subject,
    html,
  });
  // The Resend SDK resolves (not rejects) on API errors — surface them so
  // callers don't record a send that never happened.
  if (res.error) {
    throw new Error(`Resend send failed: ${res.error.message ?? res.error}`);
  }
  return res;
}

/**
 * Send the same message to many recipients individually, isolating failures.
 * One bad address (bounce, rate limit) must not stop the rest of the batch —
 * these run in unattended scheduled functions where a throw means the
 * remaining players silently never get their reminder.
 */
export async function sendEachEmail(
  recipients: string[],
  subject: string,
  html: string,
  onSent?: (email: string) => Promise<void>,
): Promise<{ sent: number; failed: { email: string; error: string }[] }> {
  let sent = 0;
  const failed: { email: string; error: string }[] = [];

  for (const email of recipients) {
    try {
      await sendEmail({ to: email, subject, html });
      // Only mark as delivered after a confirmed send, so a failure stays
      // eligible for the next run instead of being deduped away.
      if (onSent) await onSent(email);
      sent++;
    } catch (err) {
      failed.push({ email, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (failed.length > 0) {
    console.error(`sendEachEmail: ${failed.length} failed`, failed);
  }
  return { sent, failed };
}
