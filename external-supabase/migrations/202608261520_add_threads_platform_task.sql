-- Add the Threads platform to the tasks table and seed the founder follow task.
-- Run this on the external Supabase project.

-- 1) Allow 'threads' as a platform value (only if a CHECK constraint restricts it).
do $$
declare
  con record;
begin
  for con in
    select conname
    from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%platform%'
  loop
    execute format('alter table public.tasks drop constraint %I', con.conname);
  end loop;

  alter table public.tasks
    add constraint tasks_platform_check
    check (platform in ('telegram','instagram','tiktok','threads','x','youtube','discord'));
end $$;

-- 2) Seed the Threads task.
insert into public.tasks (platform, title, url, points, status, sort_order, task_reward)
values ('threads', 'Follow Azad Bashqali', 'https://www.threads.com/@azad__x_', 100, 'active', 1, 0)
on conflict do nothing;
