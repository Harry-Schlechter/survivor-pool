// Plain HTML email builders. Kept dependency-light (string templates) so they
// run anywhere — including Netlify functions — without a render step. Each
// returns an HTML string for lib/email/send.ts.
//
// Email-client constraints drive the markup here:
//   - Tables for layout, not flex/grid — Outlook's Word renderer ignores both.
//   - Every style inlined; <style> blocks are stripped by Gmail and others.
//   - No external images or webfonts — they're blocked until "show images" and
//     would leave the design broken in the default view.
//   - Colors carry meaning but never carry it *alone* (text labels too), so the
//     mail still reads correctly in forced-dark or high-contrast modes.

import { env } from "../env";
import { teamName, teamColor } from "../teams";

const FIELD = "#0b3d2e";
const CHALK = "#f5f5f0";
const INK = "#111111";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const DANGER = "#dc2626";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Escape user-supplied strings (display names) before interpolating to HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A colored pill showing a team pick. */
function teamChip(abbr: string): string {
  const c = teamColor(abbr);
  return `<span style="display:inline-block;background:${c};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:3px 9px;border-radius:999px;font-family:${FONT}">${esc(
    teamName(abbr),
  )}</span>`;
}

/** Big call-to-action button. Uses a table so Outlook renders the fill. */
function button(href: string, label: string, bg: string = FIELD): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0"><tr>
    <td align="center" bgcolor="${bg}" style="border-radius:8px">
      <a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px">${label}</a>
    </td></tr></table>`;
}

/** Section heading — small, uppercase, tracked out. */
function heading(text: string): string {
  return `<p style="margin:26px 0 10px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${MUTED}">${text}</p>`;
}

/** Roster of names as wrapped chips. */
function nameList(names: string[], accent: string): string {
  if (names.length === 0) {
    return `<p style="margin:0;font-family:${FONT};font-size:14px;color:${MUTED}">Nobody left.</p>`;
  }
  return `<p style="margin:0;line-height:2.1">${names
    .map(
      (n) =>
        `<span style="display:inline-block;border:1px solid ${LINE};border-left:3px solid ${accent};background:#ffffff;color:${INK};font-family:${FONT};font-size:14px;padding:5px 11px;border-radius:5px;margin:0 6px 6px 0">${esc(
          n,
        )}</span>`,
    )
    .join("")}</p>`;
}

function shell(preheader: string, title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${CHALK};-webkit-font-smoothing:antialiased">
  <!-- Preheader: the preview line in the inbox list. Hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CHALK}">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${LINE}">

        <!-- Header -->
        <tr><td style="background:${FIELD};padding:22px 28px">
          <p style="margin:0;font-family:${FONT};font-size:19px;font-weight:800;color:#ffffff;letter-spacing:-.01em">🏈 Jim Olah Survivor Pool</p>
          <p style="margin:5px 0 0;font-family:${FONT};font-size:13px;color:#9fc6b5">${title}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:26px 28px;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK}">${body}</td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 28px;border-top:1px solid ${LINE};background:#fafafa">
          <p style="margin:0;font-family:${FONT};font-size:12px;color:${MUTED}">
            <a href="${env.siteUrl()}" style="color:${FIELD};text-decoration:none;font-weight:600">Open the pool</a>
            &nbsp;·&nbsp; Last one standing wins.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
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
  const survived = d.eliminated.length === 0;

  // Scoreboard strip — the three numbers that matter, read at a glance.
  const stats = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px;border:1px solid ${LINE};border-radius:10px;overflow:hidden">
      <tr>
        <td width="33.3%" align="center" style="padding:14px 6px;background:#ffffff;border-right:1px solid ${LINE}">
          <p style="margin:0;font-family:${FONT};font-size:26px;font-weight:800;color:${FIELD};line-height:1">${d.mainAlive.length}</p>
          <p style="margin:4px 0 0;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:${MUTED}">Winners</p>
        </td>
        <td width="33.3%" align="center" style="padding:14px 6px;background:#ffffff;border-right:1px solid ${LINE}">
          <p style="margin:0;font-family:${FONT};font-size:26px;font-weight:800;color:#b45309;line-height:1">${d.losersAlive.length}</p>
          <p style="margin:4px 0 0;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:${MUTED}">Losers</p>
        </td>
        <td width="33.3%" align="center" style="padding:14px 6px;background:#ffffff">
          <p style="margin:0;font-family:${FONT};font-size:26px;font-weight:800;color:${DANGER};line-height:1">${d.eliminated.length}</p>
          <p style="margin:4px 0 0;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:${MUTED}">Knocked out</p>
        </td>
      </tr>
    </table>`;

  const elim = survived
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0"><tr>
         <td style="padding:14px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-family:${FONT};font-size:15px;color:#166534">
           <strong>Clean sweep.</strong> Everybody survived Week ${d.week}. 😤
         </td></tr></table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0;border:1px solid #fecaca;border-radius:10px;overflow:hidden">
         <tr><td style="padding:11px 16px;background:#fef2f2;border-bottom:1px solid #fecaca;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${DANGER}">
           ☠️ Eliminated in Week ${d.week}
         </td></tr>
         ${d.eliminated
           .map(
             (e, i) => `<tr><td style="padding:11px 16px;background:#ffffff;${
               i > 0 ? `border-top:1px solid ${LINE};` : ""
             }font-family:${FONT};font-size:15px;color:${INK}">
             <strong>${esc(e.name)}</strong>
             <span style="color:${MUTED};font-size:13px"> — ${
               e.pick ? "picked" : ""
             } </span>${
               e.pick
                 ? teamChip(e.pick)
                 : `<span style="color:${DANGER};font-size:13px;font-weight:600">no pick submitted</span>`
             }
           </td></tr>`,
           )
           .join("")}
       </table>`;

  const body = `
    <p style="margin:0 0 18px;font-size:17px;font-weight:600">Week ${d.week} is in the books.</p>
    ${stats}
    ${elim}
    ${heading(`Still alive · Winners pool`)}
    ${nameList(d.mainAlive, FIELD)}
    ${heading(`Losers bracket`)}
    ${nameList(d.losersAlive, "#b45309")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;border-top:1px solid ${LINE}"><tr><td style="padding-top:20px">
      <p style="margin:0 0 2px;font-family:${FONT};font-size:15px"><strong>Week ${d.nextWeek} picks are open.</strong></p>
      <p style="margin:0;font-family:${FONT};font-size:14px;color:${MUTED}">Picks lock Thursday night at kickoff. Miss it and it counts as a loss.</p>
      ${button(`${env.siteUrl()}/pick`, "Make your pick →")}
    </td></tr></table>`;

  return {
    subject: survived
      ? `Week ${d.week}: everyone survived — ${d.mainAlive.length} still alive`
      : `Week ${d.week}: ${d.eliminated.length} knocked out — ${d.mainAlive.length} still alive`,
    html: shell(
      survived
        ? `Nobody went out in Week ${d.week}. Week ${d.nextWeek} picks are open.`
        : `${d.eliminated
            .map((e) => e.name)
            .join(", ")} eliminated. Week ${d.nextWeek} picks are open.`,
      `Week ${d.week} recap · ${d.year}`,
      body,
    ),
  };
}

export function magicLinkEmail(url: string) {
  const body = `
    <p style="margin:0 0 6px;font-size:17px;font-weight:600">Sign in to the pool</p>
    <p style="margin:0;color:${MUTED};font-size:14px">Tap the button below and you're in — no password needed.</p>
    ${button(url, "Sign in →")}
    <p style="margin:0;padding:12px 14px;background:#fafafa;border:1px solid ${LINE};border-radius:8px;font-size:13px;color:${MUTED}">
      This link expires shortly and can only be used once. If you didn't request it, you can safely ignore this email.
    </p>`;
  return {
    subject: "Your Jim Olah Survivor Pool sign-in link",
    html: shell(
      "Your one-time sign-in link — expires shortly.",
      "Sign in",
      body,
    ),
  };
}

export function pickReminderEmail(week: number, urgent: boolean) {
  const body = urgent
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px"><tr>
        <td style="padding:16px 18px;background:#fef2f2;border:1px solid #fecaca;border-left:4px solid ${DANGER};border-radius:10px">
          <p style="margin:0;font-family:${FONT};font-size:17px;font-weight:800;color:${DANGER}">⏰ Picks lock within the hour</p>
          <p style="margin:6px 0 0;font-family:${FONT};font-size:14px;color:#7f1d1d">You still haven't made your Week ${week} pick.</p>
        </td></tr></table>
      <p style="margin:0 0 4px">No pick by lock counts as a <strong>loss</strong>. Don't go out on a technicality.</p>
      ${button(`${env.siteUrl()}/pick`, "Pick now →", DANGER)}`
    : `
      <p style="margin:0 0 6px;font-size:17px;font-weight:600">You haven't picked yet</p>
      <p style="margin:0 0 4px;color:${MUTED};font-size:14px">Week ${week} picks lock Thursday night at kickoff.</p>
      <p style="margin:14px 0 0">A missed pick counts as a <strong>loss</strong> — takes about ten seconds to lock one in.</p>
      ${button(`${env.siteUrl()}/pick`, "Make your pick →")}`;

  return {
    subject: urgent
      ? `⏰ Last call — your Week ${week} pick locks within the hour`
      : `Don't forget your Week ${week} pick`,
    html: shell(
      urgent
        ? `Picks lock within the hour and yours isn't in yet.`
        : `Week ${week} picks lock Thursday night.`,
      `Week ${week} pick reminder`,
      body,
    ),
  };
}
