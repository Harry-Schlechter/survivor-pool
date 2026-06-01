// Seed/backfill helper for local + staging testing against the Neon DB.
//
//   node scripts/seed.mjs --year 2024 --week 1
//
// Requires DATABASE_URL (Neon connection string) in the env or .env.local.
// Creates an "active" season and syncs the given week's REAL ESPN games (real
// winners/scores) so you can exercise grading + standings without waiting for
// live games. Only touches seasons + games.

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

// --- tiny .env.local loader (no dep) ---------------------------------------
try {
  const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* no .env.local — rely on ambient env */
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const YEAR = Number(args.year || 2024);
const WEEK = Number(args.week || 1);

const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL (Neon connection string).");
  process.exit(1);
}
const sql = neon(url);

const ESPN = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${YEAR}&seasontype=2&week=${WEEK}`;
const uuid = () => crypto.randomUUID();

async function main() {
  console.log(`Seeding ${YEAR} week ${WEEK}…`);

  // 1) Season (upsert by year).
  const existing = await sql`select id from seasons where year = ${YEAR} limit 1`;
  let seasonId;
  if (existing.length > 0) {
    seasonId = existing[0].id;
    await sql`update seasons set status='active', phase='regular', current_week=${WEEK} where id=${seasonId}`;
  } else {
    seasonId = uuid();
    await sql`insert into seasons (id, year, status, phase, current_week, buy_in, venmo_handle)
              values (${seasonId}, ${YEAR}, 'active', 'regular', ${WEEK}, '50', '@example')`;
  }

  // 2) Games from real ESPN data.
  const res = await fetch(ESPN);
  const json = await res.json();
  const events = json.events ?? [];
  let lockAt = null;

  for (const ev of events) {
    const c = ev.competitions[0];
    const home = c.competitors.find((x) => x.homeAway === "home");
    const away = c.competitors.find((x) => x.homeAway === "away");
    const hs = home.score != null ? Number(home.score) : null;
    const as = away.score != null ? Number(away.score) : null;
    const completed = !!c.status?.type?.completed;
    let winner = null;
    if (completed && hs != null && as != null && hs !== as)
      winner = hs > as ? home.team.abbreviation : away.team.abbreviation;
    if (!lockAt || ev.date < lockAt) lockAt = ev.date;

    await sql`
      insert into games (id, season_id, week, seasontype, home_abbr, away_abbr,
        home_name, away_name, kickoff, status, completed, home_score, away_score,
        winner_abbr, spread_detail, over_under)
      values (${ev.id}, ${seasonId}, ${WEEK}, 2, ${home.team.abbreviation},
        ${away.team.abbreviation}, ${home.team.displayName},
        ${away.team.displayName}, ${ev.date}, ${c.status.type.name},
        ${completed}, ${hs}, ${as}, ${winner},
        ${c.odds?.[0]?.details ?? null},
        ${c.odds?.[0]?.overUnder != null ? String(c.odds[0].overUnder) : null})
      on conflict (season_id, id) do update set
        status=excluded.status, completed=excluded.completed,
        home_score=excluded.home_score, away_score=excluded.away_score,
        winner_abbr=excluded.winner_abbr, kickoff=excluded.kickoff`;
  }

  await sql`update seasons set lock_at=${lockAt} where id=${seasonId}`;

  console.log(
    `\nDone. Season ${seasonId} active at week ${WEEK} with ${events.length} games.\n` +
      `Sign in, join the season, mark yourself paid in /admin, make a pick,\n` +
      `then hit admin "Sync + grade now" to grade the seeded final games.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
