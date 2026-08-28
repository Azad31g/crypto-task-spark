-- AZOX Referral System
-- Safe to re-run.

-- 1) Unique referral code per user ------------------------------------------
create or replace function public.azox_gen_referral_code()
returns text
language plpgsql
as $$
declare
  code text;
begin
  loop
    code := 'AZOX' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.users u where u.referral_code = code);
  end loop;
  return code;
end;
$$;

update public.users
set referral_code = public.azox_gen_referral_code()
where referral_code is null or referral_code = '';

create unique index if not exists users_referral_code_key
  on public.users (referral_code);

create or replace function public.azox_set_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null or new.referral_code = '' then
    new.referral_code := public.azox_gen_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_referral_code on public.users;
create trigger trg_users_referral_code
  before insert or update on public.users
  for each row execute function public.azox_set_referral_code();

-- 2) Referral reward ledger --------------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id bigint not null,
  referred_id bigint not null,
  reward integer not null default 1000,
  type text not null default 'referral',
  created_at timestamptz not null default now()
);

-- one referral (and therefore one reward) per referred user, ever
create unique index if not exists referrals_referred_id_key
  on public.referrals (referred_id);
create index if not exists referrals_referrer_id_idx
  on public.referrals (referrer_id);

grant select on public.referrals to anon, authenticated;
grant all on public.referrals to service_role;

alter table public.referrals enable row level security;

drop policy if exists referrals_read on public.referrals;
create policy referrals_read on public.referrals
  for select to anon, authenticated using (true);
-- writes only happen through the security-definer RPC below

-- 3) Atomic referral registration -------------------------------------------
-- Returns true only the first time a referral is attributed for p_referred_id.
create or replace function public.register_referral(
  p_referred_id bigint,
  p_referral_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer bigint;
  v_inserted integer;
begin
  if p_referred_id is null or p_referral_code is null or p_referral_code = '' then
    return false;
  end if;

  select telegram_id into v_referrer
  from public.users
  where referral_code = p_referral_code;

  -- unknown code, or self-referral
  if v_referrer is null or v_referrer = p_referred_id then
    return false;
  end if;

  -- the referred user must exist and must not already be attributed
  if not exists (select 1 from public.users where telegram_id = p_referred_id) then
    return false;
  end if;
  if exists (select 1 from public.users
             where telegram_id = p_referred_id and referred_by is not null) then
    return false;
  end if;

  insert into public.referrals (referrer_id, referred_id, reward, type)
  values (v_referrer, p_referred_id, 1000, 'referral')
  on conflict (referred_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false; -- already rewarded
  end if;

  update public.users
  set referred_by = v_referrer
  where telegram_id = p_referred_id and referred_by is null;

  update public.users
  set points = coalesce(points, 0) + 1000,
      referral_count = (select count(*) from public.referrals r
                        where r.referrer_id = v_referrer)
  where telegram_id = v_referrer;

  return true;
end;
$$;

grant execute on function public.register_referral(bigint, text) to anon, authenticated;

-- 4) Backfill referral_count from the ledger --------------------------------
update public.users u
set referral_count = coalesce((
  select count(*) from public.referrals r where r.referrer_id = u.telegram_id
), 0);
