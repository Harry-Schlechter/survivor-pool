-- Row-Level Security. The service-role key (used by Netlify scheduled functions
-- and trusted server route handlers) bypasses RLS entirely, so these policies
-- govern the browser/anon+authenticated paths only.

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Helper: has the given season's week locked yet? (controls others' pick visibility)
create or replace function public.season_is_locked(p_season uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select lock_at is not null and now() >= lock_at from public.seasons where id = p_season),
    false);
$$;

alter table public.profiles      enable row level security;
alter table public.seasons       enable row level security;
alter table public.entries       enable row level security;
alter table public.games         enable row level security;
alter table public.picks         enable row level security;
alter table public.notifications enable row level security;

-- ----- profiles ------------------------------------------------------------
-- Everyone signed in can read display names (for standings). Self/admin write.
create policy profiles_read on public.profiles
  for select using (auth.role() = 'authenticated');
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- ----- seasons -------------------------------------------------------------
create policy seasons_read on public.seasons
  for select using (auth.role() = 'authenticated');
create policy seasons_admin_write on public.seasons
  for all using (public.is_admin()) with check (public.is_admin());

-- ----- entries -------------------------------------------------------------
-- All authenticated users can read entries (standings). Users create their own
-- (unpaid); only admin updates paid/bracket/rank. Users may update their own
-- sb_score_guess and self-paid flag via a dedicated policy below.
create policy entries_read on public.entries
  for select using (auth.role() = 'authenticated');
create policy entries_insert_self on public.entries
  for insert with check (
    user_id = auth.uid()
    and paid = false
    and bracket = 'main'
    and exists (select 1 from public.seasons s
                where s.id = season_id and s.status = 'signup')
  );
create policy entries_update_self on public.entries
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ----- games ---------------------------------------------------------------
create policy games_read on public.games
  for select using (auth.role() = 'authenticated');
create policy games_admin_write on public.games
  for all using (public.is_admin()) with check (public.is_admin());

-- ----- picks ---------------------------------------------------------------
-- Read: your own picks anytime; everyone's picks once the week has locked.
create policy picks_read on public.picks
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.entries e
      where e.id = picks.entry_id and e.user_id = auth.uid()
    )
    or public.season_is_locked(season_id)
  );

-- Insert/update: only for your own active+paid entry, before lock.
-- (lib/picks.ts enforces the 2x rule and team-in-week; the hard gates here are
-- ownership, paid, active bracket, and lock time.)
create policy picks_write_self on public.picks
  for insert with check (
    exists (
      select 1 from public.entries e
      join public.seasons s on s.id = e.season_id
      where e.id = picks.entry_id
        and e.user_id = auth.uid()
        and e.paid = true
        and e.bracket in ('main','losers')
        and e.bracket = picks.bracket
        and s.status = 'active'
        and (s.lock_at is null or now() < s.lock_at)
    )
  );
create policy picks_update_self on public.picks
  for update using (
    exists (
      select 1 from public.entries e
      join public.seasons s on s.id = e.season_id
      where e.id = picks.entry_id
        and e.user_id = auth.uid()
        and e.paid = true
        and s.status = 'active'
        and (s.lock_at is null or now() < s.lock_at)
    )
  ) with check (
    exists (
      select 1 from public.entries e
      join public.seasons s on s.id = e.season_id
      where e.id = picks.entry_id
        and e.user_id = auth.uid()
        and e.paid = true
        and s.status = 'active'
        and (s.lock_at is null or now() < s.lock_at)
    )
  );
-- Admin can override picks (e.g. corrections).
create policy picks_admin_write on public.picks
  for all using (public.is_admin()) with check (public.is_admin());

-- ----- notifications -------------------------------------------------------
-- Server-only (service role). No authenticated access needed.
create policy notifications_admin_read on public.notifications
  for select using (public.is_admin());
