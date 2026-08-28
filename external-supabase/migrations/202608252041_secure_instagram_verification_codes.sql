alter table public.verification_sessions
  add column if not exists verification_code text;

alter table public.verification_sessions
  drop constraint if exists verification_sessions_status_check;

alter table public.verification_sessions
  add constraint verification_sessions_status_check
  check (status in ('pending', 'processing', 'verified', 'failed', 'expired', 'rejected'));

create unique index if not exists verification_sessions_active_code_uidx
  on public.verification_sessions (verification_code)
  where verification_code is not null
    and status in ('pending', 'processing');

create or replace function public.claim_instagram_verification_session(
  _verification_code text
)
returns table (
  session_id uuid,
  telegram_user_id bigint,
  task_id text
)
language sql
security definer
set search_path = public
as $$
  update public.verification_sessions
  set status = 'processing'
  where verification_sessions.session_id = (
    select candidate.session_id
    from public.verification_sessions as candidate
    where candidate.platform = 'instagram'
      and candidate.status = 'pending'
      and candidate.verification_code = upper(trim(_verification_code))
      and candidate.expires_at > now()
    limit 1
    for update skip locked
  )
  returning
    verification_sessions.session_id,
    verification_sessions.telegram_user_id,
    verification_sessions.task_id;
$$;

create or replace function public.fail_instagram_verification_session(
  _session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.verification_sessions
  set status = 'failed',
      completed_at = now(),
      verification_code = null
  where session_id = _session_id
    and status = 'processing';

  return found;
end;
$$;

create or replace function public.complete_instagram_verification_session(
  _session_id uuid,
  _instagram_scoped_id text,
  _instagram_username text,
  _checked_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.verification_sessions%rowtype;
  linked_telegram_user_id bigint;
begin
  select *
  into claimed
  from public.verification_sessions
  where session_id = _session_id
    and platform = 'instagram'
    and status = 'processing'
  for update;

  if not found then
    return false;
  end if;

  select telegram_user_id
  into linked_telegram_user_id
  from public.instagram_links
  where instagram_scoped_id = _instagram_scoped_id
  for update;

  if found and linked_telegram_user_id <> claimed.telegram_user_id then
    update public.verification_sessions
    set status = 'failed', completed_at = now(), verification_code = null
    where session_id = _session_id;
    return false;
  end if;

  insert into public.instagram_links (
    instagram_scoped_id,
    telegram_user_id,
    instagram_username,
    linked_at
  ) values (
    _instagram_scoped_id,
    claimed.telegram_user_id,
    _instagram_username,
    _checked_at
  )
  on conflict (instagram_scoped_id) do update
  set instagram_username = excluded.instagram_username
  where public.instagram_links.telegram_user_id = excluded.telegram_user_id;

  select telegram_user_id
  into linked_telegram_user_id
  from public.instagram_links
  where instagram_scoped_id = _instagram_scoped_id;

  if linked_telegram_user_id is distinct from claimed.telegram_user_id then
    update public.verification_sessions
    set status = 'failed', completed_at = now(), verification_code = null
    where session_id = _session_id;
    return false;
  end if;

  insert into public.instagram_verifications (
    telegram_user_id,
    task_id,
    instagram_scoped_id,
    instagram_username,
    status,
    verified_at,
    last_checked_at
  ) values (
    claimed.telegram_user_id,
    claimed.task_id,
    _instagram_scoped_id,
    _instagram_username,
    'verified',
    _checked_at,
    _checked_at
  )
  on conflict (telegram_user_id, task_id) do update
  set instagram_scoped_id = excluded.instagram_scoped_id,
      instagram_username = excluded.instagram_username,
      status = 'verified',
      verified_at = excluded.verified_at,
      last_checked_at = excluded.last_checked_at;

  update public.verification_sessions
  set status = 'verified',
      instagram_scoped_id = _instagram_scoped_id,
      completed_at = _checked_at,
      verification_code = null
  where session_id = _session_id;

  return true;
end;
$$;

revoke all on function public.claim_instagram_verification_session(text)
  from public, anon, authenticated;
revoke all on function public.fail_instagram_verification_session(uuid)
  from public, anon, authenticated;
revoke all on function public.complete_instagram_verification_session(uuid, text, text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.claim_instagram_verification_session(text)
  to service_role;
grant execute on function public.fail_instagram_verification_session(uuid)
  to service_role;
grant execute on function public.complete_instagram_verification_session(uuid, text, text, timestamptz)
  to service_role;