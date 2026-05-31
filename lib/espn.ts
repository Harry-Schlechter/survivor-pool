// ESPN public scoreboard integration. Unofficial, free, no auth/key.
// If ESPN ever changes the shape, this is the single file to patch.
//
// Endpoint: GET /apis/site/v2/sports/football/nfl/scoreboard
//   ?dates={YEAR}&seasontype={1|2|3}&week={N}
//   seasontype: 1=pre, 2=regular, 3=post. Regular season weeks 1-18.
//
// Verified field paths (see __fixtures__/espn-2024-wk1.json):
//   events[].id                                     -> game id
//   events[].date                                   -> ISO kickoff
//   competitions[0].status.type.{name,completed}    -> status
//   competitions[0].competitors[].team.{abbreviation,displayName}
//   competitions[0].competitors[].homeAway          -> "home" | "away"
//   competitions[0].competitors[].score             -> STRING e.g. "27"
//   competitions[0].competitors[].winner            -> boolean
//   competitions[0].odds[0].{details,overUnder}     -> only for upcoming games

const BASE =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

export type SeasonType = 1 | 2 | 3;

export interface NormalizedGame {
  id: string;
  week: number;
  seasontype: number;
  homeAbbr: string;
  awayAbbr: string;
  homeName: string;
  awayName: string;
  kickoff: string; // ISO
  status: string; // STATUS_SCHEDULED | STATUS_IN_PROGRESS | STATUS_FINAL | ...
  completed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  /** Winning team abbr, or null if not final / tie. Tie => null (graded as loss upstream). */
  winnerAbbr: string | null;
  spreadDetail: string | null; // e.g. "SEA -3.5"
  overUnder: number | null;
}

// --- Raw ESPN shapes (only the bits we read) -------------------------------
interface EspnTeam {
  abbreviation?: string;
  displayName?: string;
}
interface EspnCompetitor {
  homeAway?: string;
  score?: string;
  winner?: boolean;
  team?: EspnTeam;
}
interface EspnOdds {
  details?: string;
  overUnder?: number;
}
interface EspnStatusType {
  name?: string;
  completed?: boolean;
}
interface EspnCompetition {
  competitors?: EspnCompetitor[];
  odds?: EspnOdds[];
  status?: { type?: EspnStatusType };
}
interface EspnEvent {
  id?: string;
  date?: string;
  competitions?: EspnCompetition[];
  week?: { number?: number };
  season?: { type?: number };
}
interface EspnScoreboard {
  events?: EspnEvent[];
  week?: { number?: number };
  season?: { type?: number; year?: number };
}

function toScore(s: string | undefined): number | null {
  if (s === undefined || s === null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Normalize one ESPN scoreboard payload into our game rows. */
export function normalizeScoreboard(data: EspnScoreboard): NormalizedGame[] {
  const weekNum = data.week?.number ?? 0;
  const seasontype = data.season?.type ?? 2;
  const events = data.events ?? [];
  const games: NormalizedGame[] = [];

  for (const ev of events) {
    const comp = ev.competitions?.[0];
    if (!ev.id || !ev.date || !comp) continue;

    const competitors = comp.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home?.team?.abbreviation || !away?.team?.abbreviation) continue;

    const statusName = comp.status?.type?.name ?? "STATUS_SCHEDULED";
    const completed = Boolean(comp.status?.type?.completed);
    const homeScore = toScore(home.score);
    const awayScore = toScore(away.score);

    // Winner: prefer ESPN's explicit boolean; fall back to score compare.
    // A tie (equal final scores) yields null -> upstream grades it a loss.
    let winnerAbbr: string | null = null;
    if (completed) {
      if (home.winner) winnerAbbr = home.team.abbreviation;
      else if (away.winner) winnerAbbr = away.team.abbreviation;
      else if (homeScore !== null && awayScore !== null) {
        if (homeScore > awayScore) winnerAbbr = home.team.abbreviation;
        else if (awayScore > homeScore) winnerAbbr = away.team.abbreviation;
        // equal => tie => null
      }
    }

    const odds = comp.odds?.[0];

    games.push({
      id: ev.id,
      week: ev.week?.number ?? weekNum,
      seasontype: ev.season?.type ?? seasontype,
      homeAbbr: home.team.abbreviation,
      awayAbbr: away.team.abbreviation,
      homeName: home.team.displayName ?? home.team.abbreviation,
      awayName: away.team.displayName ?? away.team.abbreviation,
      kickoff: ev.date,
      status: statusName,
      completed,
      homeScore,
      awayScore,
      winnerAbbr,
      spreadDetail: odds?.details ?? null,
      overUnder: odds?.overUnder ?? null,
    });
  }

  return games;
}

/** Fetch + normalize a single (year, seasontype, week) of the NFL scoreboard. */
export async function fetchWeek(
  year: number,
  week: number,
  seasontype: SeasonType = 2,
): Promise<NormalizedGame[]> {
  const url = `${BASE}?dates=${year}&seasontype=${seasontype}&week=${week}`;
  const res = await fetch(url, {
    // ESPN data changes during games; never cache hard.
    cache: "no-store",
    headers: { "User-Agent": "survivor-pool/1.0" },
  });
  if (!res.ok) {
    throw new Error(`ESPN scoreboard fetch failed: ${res.status} ${url}`);
  }
  const data = (await res.json()) as EspnScoreboard;
  return normalizeScoreboard(data);
}

/** Earliest kickoff among a set of games (the weekly lock time), or null. */
export function earliestKickoff(games: NormalizedGame[]): string | null {
  const times = games.map((g) => g.kickoff).filter(Boolean).sort();
  return times[0] ?? null;
}
