// Static NFL team metadata keyed by ESPN abbreviation. Used for display only;
// the source of truth for who plays/wins is always the games table.

export const TEAMS: Record<string, { name: string; color: string }> = {
  ARI: { name: "Cardinals", color: "#97233F" },
  ATL: { name: "Falcons", color: "#A71930" },
  BAL: { name: "Ravens", color: "#241773" },
  BUF: { name: "Bills", color: "#00338D" },
  CAR: { name: "Panthers", color: "#0085CA" },
  CHI: { name: "Bears", color: "#0B162A" },
  CIN: { name: "Bengals", color: "#FB4F14" },
  CLE: { name: "Browns", color: "#311D00" },
  DAL: { name: "Cowboys", color: "#041E42" },
  DEN: { name: "Broncos", color: "#FB4F14" },
  DET: { name: "Lions", color: "#0076B6" },
  GB: { name: "Packers", color: "#203731" },
  HOU: { name: "Texans", color: "#03202F" },
  IND: { name: "Colts", color: "#002C5F" },
  JAX: { name: "Jaguars", color: "#101820" },
  KC: { name: "Chiefs", color: "#E31837" },
  LAC: { name: "Chargers", color: "#0080C6" },
  LAR: { name: "Rams", color: "#003594" },
  LV: { name: "Raiders", color: "#000000" },
  MIA: { name: "Dolphins", color: "#008E97" },
  MIN: { name: "Vikings", color: "#4F2683" },
  NE: { name: "Patriots", color: "#002244" },
  NO: { name: "Saints", color: "#D3BC8D" },
  NYG: { name: "Giants", color: "#0B2265" },
  NYJ: { name: "Jets", color: "#125740" },
  PHI: { name: "Eagles", color: "#004C54" },
  PIT: { name: "Steelers", color: "#FFB612" },
  SEA: { name: "Seahawks", color: "#002244" },
  SF: { name: "49ers", color: "#AA0000" },
  TB: { name: "Buccaneers", color: "#D50A0A" },
  TEN: { name: "Titans", color: "#0C2340" },
  WSH: { name: "Commanders", color: "#5A1414" },
  WAS: { name: "Commanders", color: "#5A1414" },
};

export function teamName(abbr: string): string {
  return TEAMS[abbr]?.name ?? abbr;
}

export function teamColor(abbr: string): string {
  return TEAMS[abbr]?.color ?? "#374151";
}

// ESPN uses lowercase abbreviations in logo URLs. A couple differ from the
// abbreviations that appear elsewhere in their feed (e.g. WAS vs WSH), so map
// the exceptions; everything else is just the lowercased abbr.
const LOGO_ABBR: Record<string, string> = {
  WAS: "wsh",
};

/** Public ESPN CDN logo URL for a team abbreviation (no auth, predictable). */
export function teamLogo(abbr: string): string {
  const code = (LOGO_ABBR[abbr] ?? abbr).toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${code}.png`;
}
