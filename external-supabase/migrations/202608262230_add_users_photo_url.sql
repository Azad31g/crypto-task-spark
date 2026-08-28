-- Store the Telegram avatar URL on users and accept it through upsert_user.
-- Run this on the external Supabase project. Non-destructive.

-- 1) Add the column if it does not exist.
alter table public.users
  add column if not exists photo_url text;

-- 2) Overload upsert_user with a p_photo_url argument.
--    It delegates to the existing 5-arg function, then stores the avatar.
create or replace function public.upsert_user(
  p_telegram_id bigint,
  p_username text,
  p_first_name text,
  p_last_name text,
  p_referral_code text,
  p_photo_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_user(
    p_telegram_id := p_telegram_id,
    p_username := p_username,
    p_first_name := p_first_name,
    p_last_name := p_last_name,
    p_referral_code := p_referral_code
  );

  if p_photo_url is not null and p_photo_url <> '' then
    update public.users
       set photo_url = p_photo_url
     where telegram_id = p_telegram_id;
  end if;
end;
$$;

grant execute on function public.upsert_user(bigint, text, text, text, text, text)
  to anon, authenticated, service_role;
