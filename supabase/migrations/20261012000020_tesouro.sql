-- Mapa do tesouro da semana: o navio avança uma ilha a cada desafio do dia concluído (segunda a domingo,
-- horário de Brasília). Com 5 desafios na semana, o baú abre: +100 XP e +1 escudo de sequência (máx. 2).
-- Pode rodar de novo sem erro.

create table if not exists public.weekly_chests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week date not null,
  opened_at timestamptz not null default now(),
  primary key (user_id, week)
);
alter table public.weekly_chests enable row level security;
drop policy if exists chests_own on public.weekly_chests;
create policy chests_own on public.weekly_chests for select to authenticated using (user_id = auth.uid());

alter table public.activity_events drop constraint if exists activity_events_kind_check;
alter table public.activity_events add constraint activity_events_kind_check
  check (kind in ('simulado', 'triagem', 'redacao', 'nivel', 'sequencia', 'liga', 'tripulacao', 'desafio', 'escudo', 'bau'));

create or replace function public._week_day0() returns date language sql stable set search_path = public as $$
  select (public._week_start() at time zone 'America/Sao_Paulo')::date
$$;

-- ao concluir um desafio: abre o baú se for o 5º da semana
create or replace function public.trg_treasure() returns trigger language plpgsql security definer set search_path = public as $$
declare w date := public._week_day0(); n int;
begin
  if old.completed_at is not null or new.completed_at is null or new.day < w then return new; end if;
  select count(*) into n from public.daily_challenges where user_id = new.user_id and day >= w and day < w + 7 and completed_at is not null;
  if n >= 5 then
    insert into public.weekly_chests (user_id, week) values (new.user_id, w) on conflict do nothing;
    if found then
      perform public._award_xp(new.user_id, 'desafio', 100, 'bau:' || w::text);
      insert into public.streak_shields (user_id, available, earned_total) values (new.user_id, 1, 1)
      on conflict (user_id) do update set available = least(2, streak_shields.available + 1), earned_total = streak_shields.earned_total + 1;
      perform public._post_activity(new.user_id, 'bau', jsonb_build_object('week', w));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists daily_treasure on public.daily_challenges;
create trigger daily_treasure after update of completed_at on public.daily_challenges
  for each row execute function public.trg_treasure();

-- o mapa da semana para a tela inicial
create or replace function public.treasure_week()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'week', public._week_day0(),
    'goal', 5,
    'done', (select count(*) from public.daily_challenges c where c.user_id = auth.uid() and c.day >= public._week_day0() and c.day < public._week_day0() + 7 and c.completed_at is not null),
    'opened', exists (select 1 from public.weekly_chests b where b.user_id = auth.uid() and b.week = public._week_day0()),
    'days', (select jsonb_agg(jsonb_build_object(
               'day', d,
               'done', exists (select 1 from public.daily_challenges c where c.user_id = auth.uid() and c.day = d and c.completed_at is not null),
               'today', d = public._sp_day(),
               'past', d < public._sp_day()) order by d)
             from (select public._week_day0() + i d from generate_series(0, 6) i) g));
$$;

revoke execute on function public.treasure_week() from public, anon;
grant execute on function public.treasure_week() to authenticated;
