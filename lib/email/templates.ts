// Plain HTML email builders. Kept dependency-light (string templates) so they
// run anywhere — including Netlify functions — without a render step. Each
// returns an HTML string for lib/email/send.ts.

import { env } from "../env";
import { teamName } from "../teams";

function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f5f5f0;margin:0;padding:24px;color:#111">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <div style="background:#0b3d2e;color:#fff;padding:16px 24px;font-weight:700;font-size:18px">🏈 ${title}</div>
      <div style="padding:24px;line-height:1.6">${body}</div>
      <div style="padding:16px 24px;border-top:1px solid #eee;font-size:12px;color:#888">
        <a href="${env.siteUrl()}" style="color:#0b3d2e">Open the pool</a>
      </div>
    </div></body></html>`;
}

export interface WeekSummaryData {
  year: number;
  week: number;
  eliminated: { name: string; pick: string | null }[];
  mainAlive: string[];
  losersAlive: string[];
  nextWeek: number;
}

export function weekSummaryEmail(d: WeekSummaryData) {
  const elim =
    d.eliminated.length === 0
      ? "<p>Nobody was eliminated this week. 😮</p>"
      : `<p><strong>Eliminated this week:</strong></p><ul>${d.eliminated
          .map(
            (e) =>
              `<li>${e.name}${e.pick ? ` (picked ${teamName(e.pick)})` : " (no pick)"}</li>`,
          )
          .join("")}</ul>`;

  const body = `
    <p>Week ${d.week} is in the books.</p>
    ${elim}
    <p><strong>Still alive — Winners pool (${d.mainAlive.length}):</strong><br>${
      d.mainAlive.join(", ") || "—"
    }</p>
    <p><strong>Losers bracket (${d.losersAlive.length}):</strong><br>${
      d.losersAlive.join(", ") || "—"
    }</p>
    <p style="margin-top:20px">Week ${d.nextWeek} picks are open. Don&apos;t forget — picks lock Thursday night!</p>
    <p><a href="${env.siteUrl()}/pick" style="display:inline-block;background:#0b3d2e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Make your pick →</a></p>`;
  return {
    subject: `Week ${d.week} results — ${d.year} Survivor Pool`,
    html: shell(`Week ${d.week} recap`, body),
  };
}

export function magicLinkEmail(url: string) {
  const body = `
    <p>Click below to sign in to the Survivor Pool. This link expires shortly and can only be used once.</p>
    <p><a href="${url}" style="display:inline-block;background:#0b3d2e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Sign in →</a></p>
    <p style="font-size:12px;color:#888">If you didn&apos;t request this, you can ignore this email.</p>`;
  return {
    subject: "Your Survivor Pool sign-in link",
    html: shell("Sign in", body),
  };
}

export function pickReminderEmail(week: number, urgent: boolean) {
  const body = `
    <p>${
      urgent
        ? "⏰ <strong>Picks lock within the hour!</strong>"
        : "Friendly reminder:"
    } you haven&apos;t made your Week ${week} pick yet.</p>
    <p>No pick by lock counts as a <strong>loss</strong> — don&apos;t get knocked out on a technicality.</p>
    <p><a href="${env.siteUrl()}/pick" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Pick now →</a></p>`;
  return {
    subject: urgent
      ? `⏰ LAST CALL — Week ${week} pick locks soon`
      : `Reminder: make your Week ${week} pick`,
    html: shell(`Week ${week} pick reminder`, body),
  };
}
