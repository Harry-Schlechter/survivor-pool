// Drizzle schema — the single source of truth for the database.
// Generate SQL with `npm run db:generate`, push with `npm run db:push`.
//
// Two groups of tables:
//   1. Better Auth tables (user, session, account, verification) — names/columns
//      dictated by Better Auth's drizzle adapter. We add `display_name` and
//      `is_admin` as extra columns on `user` (additionalFields in
//      lib/auth/index.ts) so we don't need a separate profiles table.
//   2. Domain tables (seasons, entries, games, picks, notifications).

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// ----- Better Auth core tables ---------------------------------------------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  displayName: text("display_name").notNull().default(""),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ----- Domain tables -------------------------------------------------------
export const seasons = pgTable("seasons", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  year: integer("year").notNull().unique(),
  status: text("status").notNull().default("signup"), // signup|active|complete|archived
  phase: text("phase").notNull().default("regular"), // regular|playoffs
  currentWeek: integer("current_week").notNull().default(1),
  lockAt: timestamp("lock_at"),
  buyIn: numeric("buy_in").notNull().default("0"),
  potOverride: numeric("pot_override"),
  venmoHandle: text("venmo_handle"),
  venmoLink: text("venmo_link"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const entries = pgTable(
  "entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bracket: text("bracket").notNull().default("main"), // main|losers|eliminated
    paid: boolean("paid").notNull().default(false),
    paidMarkedByUser: boolean("paid_marked_by_user").notNull().default(false),
    eliminatedWeek: integer("eliminated_week"),
    finalRank: integer("final_rank"),
    sbScoreGuess: integer("sb_score_guess"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => ({
    seasonUserUnique: uniqueIndex("entries_season_user_unique").on(
      t.seasonId,
      t.userId,
    ),
    seasonIdx: index("entries_season_idx").on(t.seasonId),
    userIdx: index("entries_user_idx").on(t.userId),
  }),
);

export const games = pgTable(
  "games",
  {
    id: text("id").notNull(), // ESPN event id
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    week: integer("week").notNull(),
    seasontype: integer("seasontype").notNull().default(2),
    homeAbbr: text("home_abbr").notNull(),
    awayAbbr: text("away_abbr").notNull(),
    homeName: text("home_name").notNull(),
    awayName: text("away_name").notNull(),
    kickoff: timestamp("kickoff").notNull(),
    status: text("status").notNull().default("STATUS_SCHEDULED"),
    completed: boolean("completed").notNull().default(false),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    winnerAbbr: text("winner_abbr"),
    spreadDetail: text("spread_detail"),
    overUnder: numeric("over_under"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.seasonId, t.id] }),
    weekIdx: index("games_week_idx").on(t.seasonId, t.week),
  }),
);

export const picks = pgTable(
  "picks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    week: integer("week").notNull(),
    teamAbbr: text("team_abbr").notNull(),
    bracket: text("bracket").notNull(), // main|losers
    result: text("result").notNull().default("pending"), // pending|win|loss
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    entryWeekUnique: uniqueIndex("picks_entry_week_unique").on(
      t.entryId,
      t.week,
    ),
    seasonWeekIdx: index("picks_season_week_idx").on(t.seasonId, t.week),
    entryIdx: index("picks_entry_idx").on(t.entryId),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    week: integer("week").notNull(),
    kind: text("kind").notNull(), // lock_reminder|thu_reminder|tue_summary
    entryId: text("entry_id").references(() => entries.id, {
      onDelete: "cascade",
    }),
    sentAt: timestamp("sent_at").notNull().defaultNow(),
  },
  (t) => ({
    dedupe: uniqueIndex("notifications_dedupe").on(
      t.seasonId,
      t.week,
      t.kind,
      t.entryId,
    ),
  }),
);

// Row types inferred from the schema (replaces hand-authored database.types.ts).
export type UserRow = typeof user.$inferSelect;
export type SeasonRow = typeof seasons.$inferSelect;
export type EntryRow = typeof entries.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type PickRow = typeof picks.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;

// Domain string-literal unions (kept for app code that switches on them).
export type Bracket = "main" | "losers" | "eliminated";
export type PickBracket = "main" | "losers";
export type SeasonStatus = "signup" | "active" | "complete" | "archived";
export type SeasonPhase = "regular" | "playoffs";
export type PickResult = "pending" | "win" | "loss";
