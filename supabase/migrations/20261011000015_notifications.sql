-- Notificações: push (Web Push/VAPID — no app das lojas vira notificação nativa) e e-mail (Resend, opcional).
-- Preferências do aluno ficam em profiles.preferences.notifications:
--   { push: bool, email: bool, hour: 8..22, lembrete: bool, social: bool, liga: bool }
-- Pode rodar de novo sem erro.

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own_select on public.push_subscriptions;
create policy push_own_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists push_own_delete on public.push_subscriptions;
create policy push_own_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- registra (ou move para este usuário) a inscrição do aparelho; máximo de 10 aparelhos por pessoa
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_ua text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or not public.is_active_user() then raise exception 'permission denied' using errcode = '42501'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then raise exception 'endpoint inválido'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (me, p_endpoint, p_p256dh, p_auth, left(p_ua, 300))
  on conflict (endpoint) do update set user_id = me, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
  delete from public.push_subscriptions where user_id = me and id not in (
    select id from public.push_subscriptions where user_id = me order by created_at desc limit 10);
end $$;
revoke execute on function public.push_subscribe(text, text, text, text) from public, anon;
grant execute on function public.push_subscribe(text, text, text, text) to authenticated;

-- uma notificação de cada tipo por dia (lembrete, liga…): evita mandar duas vezes
create table if not exists public.notification_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  day date not null default (now() at time zone 'America/Sao_Paulo')::date,
  at timestamptz not null default now(),
  primary key (user_id, kind, day)
);
alter table public.notification_log enable row level security; -- só o servidor (service role)

-- Quem deve receber o lembrete agora: ainda não estudou hoje, pediu lembrete até esta hora e não foi avisado hoje.
-- Chamado pela rota de cron com a service role.
create or replace function public.reminders_due(p_hour int)
returns table (user_id uuid, first_name text, email text, streak int, want_email boolean, has_push boolean)
language sql stable security definer set search_path = public as $$
  select p.id, split_part(p.full_name, ' ', 1), p.email, public._xp_streak(p.id),
         coalesce((p.preferences #>> '{notifications,email}')::boolean, false),
         exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
    from public.profiles p
   where p.is_active and p.role = 'student'
     and coalesce((p.preferences #>> '{notifications,lembrete}')::boolean, true)
     and coalesce((p.preferences #>> '{notifications,hour}')::int, 19) <= p_hour
     and (exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
          or coalesce((p.preferences #>> '{notifications,email}')::boolean, false))
     and not exists (select 1 from public.xp_events e where e.user_id = p.id and e.day = public._sp_day())
     and not exists (select 1 from public.study_sessions ss where ss.user_id = p.id and ss.day = public._sp_day() and ss.seconds >= 60)
     and not exists (select 1 from public.notification_log l where l.user_id = p.id and l.kind = 'lembrete' and l.day = public._sp_day())
$$;

-- Domingo à tarde: posição de cada um no grupo da liga (para "faltam X XP para subir").
create or replace function public.league_standings()
returns table (user_id uuid, tier smallint, rank int, size int, week_xp int, promo_xp int)
language sql stable security definer set search_path = public as $$
  with g as (
    select m.user_id, m.tier, m.grp, public._week_xp(m.user_id) xp
      from public.league_members m where m.week = public._week_start()
  ), r as (
    select g.*, rank() over (partition by tier, grp order by xp desc)::int rk, count(*) over (partition by tier, grp)::int n,
           coalesce(nth_value(xp, 7) over (partition by tier, grp order by xp desc rows between unbounded preceding and unbounded following), 0) p7
      from g
  )
  select user_id, tier, rk, n, xp, p7 from r
   where coalesce((select (preferences #>> '{notifications,liga}')::boolean from public.profiles where id = r.user_id), true)
$$;

revoke execute on function public.reminders_due(int), public.league_standings() from public, anon, authenticated;
grant execute on function public.reminders_due(int), public.league_standings() to service_role;
