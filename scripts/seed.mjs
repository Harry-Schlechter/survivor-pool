// Seed/backfill helper for local + staging testing.
//
// Usage:
//   node scripts/seed.mjs --year 2024 --week 1
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the env
// (loaded from .env.local automatically below). Creates an "active" season,
// syncs the given week's real ESPN games, and creates a few fake players with
// picks so you can exercise grading + standings without waiting for live games.
//
// It uses the service-role key (bypasses RLS). NEVER run against production with
// real users unless you mean to.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
  // no .env.local — rely on ambient env
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const YEAR = Number(args.year || 2024);
const WEEK = Number(args.week || 1);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const ESPN = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${YEAR}&seasontype=2&week=${WEEK}`;

async function main() {
  console.log(`Seeding ${YEAR} week ${WEEK}…`);

  // 1) Season (upsert by year).
  const { data: season, error: sErr } = await db
    .from("seasons")
    .upsert(
      {
        year: YEAR,
        status: "active",
        phase: "regular",
        current_week: WEEK,
        buy_in: 50,
        venmo_handle: "@example",
      },
      { onConflict: "year" },
    )
    .select()
    .single();
  if (sErr) throw sErr;

  // 2) Games from real ESPN data.
  const res = await fetch(ESPN);
  const json = await res.json();
  const events = json.events ?? [];
  const games = events.map((ev) => {
    const c = ev.competitions[0];
    const home = c.competitors.find((x) => x.homeAway === "home");
    const away = c.competitors.find((x) => x.homeAway === "away");
    const hs = home.score != null ? Number(home.score) : null;
    const as = away.score != null ? Number(away.score) : null;
    const completed = !!c.status?.type?.completed;
    let winner = null;
    if (completed && hs != null && as != null && hs !== as)
      winner = hs > as ? home.team.abbreviation : away.team.abbreviation;
    return {
      id: ev.id,
      season_id: season.id,
      week: WEEK,
      seasontype: 2,
      home_abbr: home.team.abbreviation,
      away_abbr: away.team.abbreviation,
      home_name: home.team.displayName,
      away_name: away.team.displayName,
      kickoff: ev.date,
      status: c.status.type.name,
      completed,
      home_score: hs,
      away_score: as,
      winner_abbr: winner,
      spread_detail: c.odds?.[0]?.details ?? null,
      over_under: c.odds?.[0]?.overUnder ?? null,
    };
  });
  await db.from("games").upsert(games, { onConflict: "season_id,id" });
  console.log(`  ${games.length} games synced.`);

  // Set lock_at to the earliest kickoff.
  const lockAt = games.map((g) => g.kickoff).sort()[0] ?? null;
  await db.from("seasons").update({ lock_at: lockAt }).eq("id", season.id);

  console.log(
    `\nDone. Season ${season.id} is active at week ${WEEK}. ` +
      `Sign in, sign up, mark yourself paid in /admin, then make a pick.\n` +
      `Run the admin "Sync + grade now" button (or the sync-scores function) ` +
      `to grade the seeded final games.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
