-- One row per game: the all-time highest score by any user.
create table if not exists public.global_best_scores (
  game_id text primary key,
  best_score integer not null default 0,
  held_by bigint,
  held_by_name text,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.global_best_scores to anon;
grant select, insert, update on public.global_best_scores to authenticated;
grant all on public.global_best_scores to service_role;

alter table public.global_best_scores enable row level security;

drop policy if exists global_best_read on public.global_best_scores;
create policy global_best_read on public.global_best_scores
  for select to anon, authenticated using (true);

drop policy if exists global_best_insert on public.global_best_scores;
create policy global_best_insert on public.global_best_scores
  for insert to anon, authenticated with check (true);

drop policy if exists global_best_update on public.global_best_scores;
create policy global_best_update on public.global_best_scores
  for update to anon, authenticated using (true) with check (true);
