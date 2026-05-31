-- NFL Survivor Pool — initial schema
-- Conventions: all timestamps are timestamptz; ids are uuid except games (ESPN event id).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  email       text not null default '',
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- seasons: one NFL season; at most one non-archived "active"/"signup" at a time
-- ---------------------------------------------------------------------------
create table public.seasons (
  id           uuid primary key default gen_random_uuid(),
  year         int not null,
  status       text not null default 'signup'
                 check (status in ('signup','active','complete','archived')),
  phase        text not null default 'regular'
                 check (phase in ('regular','playoffs')),
  current_week int not null default 1,
  lock_at      timestamptz,                 -- cached first-kickoff of current week
  buy_in       numeric not null default 0,  -- per-player, admin-set
  pot_override numeric,                      -- admin may override computed pot
  venmo_handle text,
  venmo_link   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (year)
);

-- ---------------------------------------------------------------------------
-- entries: a user's participation in a season
-- ---------------------------------------------------------------------------
create table public.entries (
  id               uuid primary key default gen_random_uuid(),
  season_id        uuid not null references public.seasons (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  bracket          text not null default 'main'
                     check (bracket in ('main','losers','eliminated')),
  paid             boolean not null default false,           -- admin-confirmed
  paid_marked_by_user boolean not null default false,        -- player self-reported
  eliminated_week  int,
  final_rank       int,
  sb_score_guess   int,                                      -- Super Bowl tiebreaker
  joined_at        timestamptz not null default now(),
  unique (season_id, user_id)
);

create index entries_season_idx on public.entries (season_id);
create index entries_user_idx on public.entries (user_id);

-- ---------------------------------------------------------------------------
-- games: synced from ESPN scoreboard
-- ---------------------------------------------------------------------------
create table public.games (
  id           text not null,               -- ESPN event id
  season_id    uuid not null references public.seasons (id) on delete cascade,
  week         int not null,
  seasontype   int not null default 2,      -- 2=regular, 3=post
  home_abbr    text not null,
  away_abbr    text not null,
  home_name    text not null,
  away_name    text not null,
  kickoff      timestamptz not null,
  status       text not null default 'STATUS_SCHEDULED',
  completed    boolean not null default false,
  home_score   int,
  away_score   int,
  winner_abbr  text,                         -- null until final; tie => null
  spread_detail text,                        -- e.g. "SEA -3.5"
  over_under   numeric,
  updated_at   timestamptz not null default now(),
  primary key (season_id, id)
);

create index games_week_idx on public.games (season_id, week);

-- ---------------------------------------------------------------------------
-- picks: one pick per entry per week
-- ---------------------------------------------------------------------------
create table public.picks (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.entries (id) on delete cascade,
  season_id  uuid not null references public.seasons (id) on delete cascade,
  week       int not null,
  team_abbr  text not null,
  bracket    text not null check (bracket in ('main','losers')),
  result     text not null default 'pending'
               check (result in ('pending','win','loss')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, week)
);

create index picks_season_week_idx on public.picks (season_id, week);
create index picks_entry_idx on public.picks (entry_id);

-- ---------------------------------------------------------------------------
-- notifications: dedupe log for emails (esp. the one-shot lock reminder)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references public.seasons (id) on delete cascade,
  week       int not null,
  kind       text not null,                  -- 'lock_reminder' | 'thu_reminder' | 'tue_summary'
  entry_id   uuid references public.entries (id) on delete cascade, -- null for broadcast
  sent_at    timestamptz not null default now(),
  unique (season_id, week, kind, entry_id)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger seasons_touch before update on public.seasons
  for each row execute function public.touch_updated_at();
create trigger games_touch before update on public.games
  for each row execute function public.touch_updated_at();
create trigger picks_touch before update on public.picks
  for each row execute function public.touch_updated_at();
