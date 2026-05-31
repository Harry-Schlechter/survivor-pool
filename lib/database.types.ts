// Hand-authored to match supabase/migrations. Regenerate from the live DB with
// `npm run db:types` once the project is linked (that overwrites this file).
//
// The shape below deliberately mirrors what supabase-js v2 expects of a
// generated Database type (GenericSchema): each table has Row/Insert/Update plus
// a Relationships array, and the schema carries Views/Functions/Enums/
// CompositeTypes. Getting this shape right is what lets typed queries resolve to
// real row types instead of `never`.

export type Bracket = "main" | "losers" | "eliminated";
export type PickBracket = "main" | "losers";
export type SeasonStatus = "signup" | "active" | "complete" | "archived";
export type SeasonPhase = "regular" | "playoffs";
export type PickResult = "pending" | "win" | "loss";

export type ProfileRow = {
  id: string;
  display_name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export type SeasonRow = {
  id: string;
  year: number;
  status: SeasonStatus;
  phase: SeasonPhase;
  current_week: number;
  lock_at: string | null;
  buy_in: number;
  pot_override: number | null;
  venmo_handle: string | null;
  venmo_link: string | null;
  created_at: string;
  updated_at: string;
}

export type EntryRow = {
  id: string;
  season_id: string;
  user_id: string;
  bracket: Bracket;
  paid: boolean;
  paid_marked_by_user: boolean;
  eliminated_week: number | null;
  final_rank: number | null;
  sb_score_guess: number | null;
  joined_at: string;
}

export type GameRow = {
  id: string;
  season_id: string;
  week: number;
  seasontype: number;
  home_abbr: string;
  away_abbr: string;
  home_name: string;
  away_name: string;
  kickoff: string;
  status: string;
  completed: boolean;
  home_score: number | null;
  away_score: number | null;
  winner_abbr: string | null;
  spread_detail: string | null;
  over_under: number | null;
  updated_at: string;
}

export type PickRow = {
  id: string;
  entry_id: string;
  season_id: string;
  week: number;
  team_abbr: string;
  bracket: PickBracket;
  result: PickResult;
  created_at: string;
  updated_at: string;
}

export type NotificationRow = {
  id: string;
  season_id: string;
  week: number;
  kind: string;
  entry_id: string | null;
  sent_at: string;
}

// GenericTable shape required by supabase-js v2.
type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      profiles: Table<ProfileRow, Partial<ProfileRow> & { id: string }>;
      seasons: Table<SeasonRow, Partial<SeasonRow> & { year: number }>;
      entries: Table<
        EntryRow,
        Partial<EntryRow> & { season_id: string; user_id: string }
      >;
      games: Table<GameRow, Omit<GameRow, "updated_at"> & { updated_at?: string }>;
      picks: Table<
        PickRow,
        Partial<PickRow> & {
          entry_id: string;
          season_id: string;
          week: number;
          team_abbr: string;
          bracket: PickBracket;
        }
      >;
      notifications: Table<
        NotificationRow,
        Partial<NotificationRow> & {
          season_id: string;
          week: number;
          kind: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      season_is_locked: { Args: { p_season: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
