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
  return client().emails.send({
    from: env.emailFrom(),
    to,
    subject,
    html,
  });
}
