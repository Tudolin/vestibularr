-- Social e gamificação (plano de engajamento E3 parcial + E5): XP, níveis, @apelido, amigos, ligas semanais com
-- divisões, tripulações, mural com reações e boosts.
--
-- Segurança (muitos alunos são menores): nada de chat livre; perfil social mostra só @apelido, avatar (emoji+cor),
-- XP e sequência. Nome real e e-mail nunca saem daqui. Tudo que um aluno vê de outro passa por RPC security definer
-- que devolve só esses campos. XP é calculado SÓ no servidor (triggers), com limite diário e sem repetição.

-- ---------------------------------------------------------------- perfil social
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar jsonb not null default '{"emoji": "🐱", "color": "cobalto"}'::jsonb;
do $$ begin
  alter table public.profiles add constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,20}$');
exception when duplicate_object then null; end $$;
create unique index if not exists profiles_username on public.profiles (username) where username is not null;

create or replace function public._week_start(p_at timestamptz default now())
returns timestamptz language sql immutable as $$
  select (date_trunc('week', p_at at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'
$$;
create or replace function public._sp_day(p_at timestamptz default now())
returns date language sql immutable as $$ select (p_at at time zone 'America/Sao_Paulo')::date $$;

-- ---------------------------------------------------------------- XP
create table if not exists public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('answer', 'simulado', 'triagem', 'essay', 'bonus')),
  xp int not null check (xp >= 0),
  ref text not null,                       -- evita contar a mesma coisa duas vezes
  day date not null default public._sp_day(),
  at timestamptz not null default now(),
  unique (user_id, ref)
);
create index if not exists xp_events_user_at on public.xp_events (user_id, at desc);
alter table public.xp_events enable row level security;
drop policy if exists xp_own on public.xp_events;
create policy xp_own on public.xp_events for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- boosts: "vento a favor" (+50% de XP por 15 min) e "empurrão" (mensagem pronta)
create table if not exists public.boosts (
  id bigint generated always as identity primary key,
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('vento', 'empurrao')),
  message text,                            -- só das mensagens prontas (validado na RPC)
  day date not null default public._sp_day(),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  seen_at timestamptz,
  check (from_user <> to_user)
);
create unique index if not exists boosts_vento_daily on public.boosts (from_user, day) where kind = 'vento';
create unique index if not exists boosts_empurrao_daily on public.boosts (from_user, to_user, day) where kind = 'empurrao';
create index if not exists boosts_to on public.boosts (to_user, created_at desc);
alter table public.boosts enable row level security;
drop policy if exists boosts_own on public.boosts;
create policy boosts_own on public.boosts for select to authenticated using (to_user = auth.uid() or from_user = auth.uid());

-- Concede XP (única porta de entrada). Respeita: 1 vez por ref, teto diário de 2.000, boost ativo.
create or replace function public._award_xp(p_user uuid, p_source text, p_xp int, p_ref text)
returns int language plpgsql security definer set search_path = public as $$
declare v_today int; v_mult numeric := 1; v_xp int; v_new boolean;
begin
  if p_xp <= 0 then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('xp:' || p_user::text));
  if exists (select 1 from public.boosts where to_user = p_user and kind = 'vento' and expires_at > now()) then v_mult := 1.5; end if;
  select coalesce(sum(xp), 0) into v_today from public.xp_events where user_id = p_user and day = public._sp_day();
  v_xp := least(round(p_xp * v_mult)::int, greatest(2000 - v_today, 0));
  if v_xp <= 0 then return 0; end if;
  insert into public.xp_events (user_id, source, xp, ref) values (p_user, p_source, v_xp, p_ref)
  on conflict (user_id, ref) do nothing;
  get diagnostics v_new = row_count;
  if not v_new then return 0; end if;
  perform public._league_touch(p_user);
  perform public._activity_after_xp(p_user, v_today, v_today + v_xp);
  return v_xp;
end $$;

-- XP de uma resposta: acerto vale mais em questão difícil (TRI); erro vale um pouquinho (esforço).
-- Uma vez por questão por dia (refazer a mesma questão no mesmo dia não rende de novo).
create or replace function public._answer_xp(p_user uuid, p_question uuid, p_ok boolean)
returns int language plpgsql security definer set search_path = public as $$
declare b real; base int;
begin
  select irt_b into b from public.questions where id = p_question;
  base := case when not p_ok then 2 when b is null or b < 0 then 10 when b < 1.5 then 15 else 20 end;
  return public._award_xp(p_user, 'answer', base, 'q:' || p_question::text || ':' || public._sp_day()::text);
end $$;

-- treino, revisão e triagem: XP na hora da resposta
create or replace function public.trg_xp_answer() returns trigger language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts; k text;
begin
  if new.choice is null or (tg_op = 'UPDATE' and old.choice is not distinct from new.choice) then return new; end if;
  select * into a from public.exam_attempts where id = new.attempt_id;
  if a.mode not in ('treino', 'revisao', 'triagem') then return new; end if;
  select correct_label into k from public.answer_keys where question_id = new.question_id;
  if k is null then return new; end if;
  perform public._answer_xp(a.user_id, new.question_id, new.choice = k);
  return new;
end $$;
drop trigger if exists attempt_answers_xp on public.attempt_answers;
create trigger attempt_answers_xp after insert or update of choice on public.attempt_answers
  for each row execute function public.trg_xp_answer();

-- simulado/personalizado: XP ao encerrar (respostas + bônus por terminar)
create or replace function public.trg_xp_finish() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; c int := 0;
begin
  if new.status not in ('finished', 'expired') or old.status in ('finished', 'expired') then return new; end if;
  if new.mode in ('simulado', 'custom') then
    for r in select aa.question_id, aa.choice = k.correct_label ok from public.attempt_answers aa
               join public.answer_keys k on k.question_id = aa.question_id and k.correct_label is not null
              where aa.attempt_id = new.id and aa.choice is not null loop
      perform public._answer_xp(new.user_id, r.question_id, r.ok);
      n := n + 1; if r.ok then c := c + 1; end if;
    end loop;
    if n >= 10 then
      perform public._award_xp(new.user_id, 'simulado', case when n >= 45 then 100 else 40 end, 'sim:' || new.id::text);
      perform public._post_activity(new.user_id, 'simulado', jsonb_build_object('title', new.title, 'correct', c, 'total', n));
    end if;
  elsif new.mode = 'triagem' then
    select count(*), count(*) filter (where aa.choice = k.correct_label) into n, c
      from public.attempt_answers aa join public.answer_keys k on k.question_id = aa.question_id where aa.attempt_id = new.id;
    if n >= 8 then
      perform public._award_xp(new.user_id, 'triagem', 50, 'tri:' || new.id::text);
      perform public._post_activity(new.user_id, 'triagem', jsonb_build_object('correct', c, 'total', n));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists exam_attempts_xp on public.exam_attempts;
create trigger exam_attempts_xp after update of status on public.exam_attempts
  for each row execute function public.trg_xp_finish();

-- redação corrigida pela IA
create or replace function public.trg_xp_essay() returns trigger language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if new.status <> 'done' or (tg_op = 'UPDATE' and old.status = 'done') then return new; end if;
  select user_id into v_user from public.essays where id = new.essay_id;
  if v_user is not null then
    perform public._award_xp(v_user, 'essay', 30, 'essay:' || new.essay_id::text);
    perform public._post_activity(v_user, 'redacao', '{}'::jsonb);
  end if;
  return new;
end $$;
drop trigger if exists essay_corrections_xp on public.essay_corrections;
create trigger essay_corrections_xp after insert or update of status on public.essay_corrections
  for each row execute function public.trg_xp_essay();

-- nível a partir do XP total: nível n precisa de 50·n·(n+1) XP (100, 300, 600, 1000…)
create or replace function public._level(p_xp bigint) returns int language sql immutable as $$
  select greatest(1, floor((-1 + sqrt(1 + 8 * p_xp / 100.0)) / 2)::int + 1)
$$;

-- sequência social: dias seguidos com XP (vale até ontem: hoje ainda dá tempo)
create or replace function public._xp_streak(p_user uuid) returns int language plpgsql stable security definer set search_path = public as $$
declare d date := public._sp_day(); n int := 0;
begin
  if not exists (select 1 from public.xp_events where user_id = p_user and day = d) then d := d - 1; end if;
  while exists (select 1 from public.xp_events where user_id = p_user and day = d) loop n := n + 1; d := d - 1; end loop;
  return n;
end $$;

create or replace function public._week_xp(p_user uuid) returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(xp), 0)::int from public.xp_events where user_id = p_user and at >= public._week_start()
$$;

-- ---------------------------------------------------------------- ligas semanais com divisões
-- Entra na liga da semana ao ganhar o primeiro XP. Grupos de até 30 na mesma divisão.
-- No fim da semana (avaliado na entrada da semana seguinte): top 7 sobe, os 5 últimos (ou quem fez 0 XP) desce.
create table if not exists public.league_members (
  week timestamptz not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tier smallint not null check (tier between 0 and 6),
  grp int not null,
  moved smallint not null default 0,      -- +1 promovido, −1 rebaixado (em relação à semana anterior)
  primary key (week, user_id)
);
create index if not exists league_members_group on public.league_members (week, tier, grp);
alter table public.league_members enable row level security; -- leitura só pela RPC

create or replace function public._league_touch(p_user uuid) returns void language plpgsql security definer set search_path = public as $$
declare w timestamptz := public._week_start(); prev record; v_tier int := 0; v_moved int := 0; v_rank int; v_size int; v_xp int; g int;
begin
  if exists (select 1 from public.league_members where week = w and user_id = p_user) then return; end if;
  select * into prev from public.league_members where user_id = p_user and week < w order by week desc limit 1;
  if found then
    v_tier := prev.tier;
    if prev.week = w - interval '7 days' then
      select count(*) into v_size from public.league_members where week = prev.week and tier = prev.tier and grp = prev.grp;
      select coalesce(sum(xp), 0) into v_xp from public.xp_events where user_id = p_user and at >= prev.week and at < prev.week + interval '7 days';
      select 1 + count(*) into v_rank from public.league_members m
       where m.week = prev.week and m.tier = prev.tier and m.grp = prev.grp and m.user_id <> p_user
         and (select coalesce(sum(xp), 0) from public.xp_events e where e.user_id = m.user_id and e.at >= prev.week and e.at < prev.week + interval '7 days') > v_xp;
      if v_xp > 0 and v_rank <= 7 and prev.tier < 6 then v_tier := prev.tier + 1; v_moved := 1;
      elsif prev.tier > 0 and (v_xp = 0 or (v_size >= 10 and v_rank > v_size - 5)) then v_tier := prev.tier - 1; v_moved := -1;
      end if;
    elsif prev.tier > 0 then
      v_tier := prev.tier - 1; v_moved := -1; -- ficou semanas fora: desce uma
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('league:' || w::text || ':' || v_tier));
  select m.grp into g from public.league_members m where m.week = w and m.tier = v_tier group by m.grp having count(*) < 30 order by m.grp limit 1;
  if g is null then select coalesce(max(grp), 0) + 1 into g from public.league_members where week = w and tier = v_tier; end if;
  insert into public.league_members (week, user_id, tier, grp, moved) values (w, p_user, v_tier, g, v_moved) on conflict do nothing;
  if v_moved = 1 then perform public._post_activity(p_user, 'liga', jsonb_build_object('tier', v_tier)); end if;
end $$;

-- ---------------------------------------------------------------- amizades
create table if not exists public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,  -- user_a < user_b (par único)
  user_b uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.friendships enable row level security; -- só pelas RPCs

create or replace function public._are_friends(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted')
$$;

-- ---------------------------------------------------------------- tripulações
create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 30),
  emoji text not null default '🏴‍☠️',
  owner_id uuid not null references public.profiles (id) on delete cascade,
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);
create table if not exists public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('captain', 'member')),
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index if not exists crew_members_user on public.crew_members (user_id);
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;

create or replace function public._crewmates(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crew_members x join public.crew_members y on y.crew_id = x.crew_id where x.user_id = a and y.user_id = b)
$$;

-- ---------------------------------------------------------------- mural (atividades automáticas) e reações
create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('simulado', 'triagem', 'redacao', 'nivel', 'sequencia', 'liga', 'tripulacao')),
  payload jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists activity_user_at on public.activity_events (user_id, at desc);
create table if not exists public.activity_reactions (
  event_id bigint not null references public.activity_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('🔥', '👏', '💪', '🎉', '🧠')),
  primary key (event_id, user_id, emoji)
);
alter table public.activity_events enable row level security;
alter table public.activity_reactions enable row level security;

create or replace function public._post_activity(p_user uuid, p_kind text, p_payload jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.activity_events (user_id, kind, payload) values (p_user, p_kind, p_payload)
$$;

-- marcos depois de ganhar XP: subiu de nível; primeira atividade do dia que fecha 7/30/100 dias seguidos
create or replace function public._activity_after_xp(p_user uuid, p_before int, p_after int) returns void
language plpgsql security definer set search_path = public as $$
declare total bigint; l_new int; l_old int; s int;
begin
  select coalesce(sum(xp), 0) into total from public.xp_events where user_id = p_user;
  l_new := public._level(total); l_old := public._level(total - (p_after - p_before));
  if l_new > l_old then perform public._post_activity(p_user, 'nivel', jsonb_build_object('level', l_new)); end if;
  if p_before = 0 then
    s := public._xp_streak(p_user);
    if s in (7, 30, 100, 365) then perform public._post_activity(p_user, 'sequencia', jsonb_build_object('days', s)); end if;
  end if;
end $$;

-- denúncias (o admin vê)
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references public.profiles (id) on delete cascade,
  target uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('apelido', 'spam', 'assedio', 'outro')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists reports_admin on public.reports;
create policy reports_admin on public.reports for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- cartão público (só campos seguros)
create or replace function public._card(p_user uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'username', p.username, 'avatar', p.avatar,
    'week_xp', public._week_xp(p.id), 'level', public._level((select coalesce(sum(xp), 0) from public.xp_events where user_id = p.id)),
    'streak', public._xp_streak(p.id))
  from public.profiles p where p.id = p_user
$$;

-- ---------------------------------------------------------------- RPCs do aluno
create or replace function public._me() returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'permission denied' using errcode = '42501'; end if;
  return auth.uid();
end $$;

create or replace function public.social_set_profile(p_username text, p_avatar jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public._me(); u text := lower(trim(p_username));
begin
  if u !~ '^[a-z0-9_.]{3,20}$' then raise exception 'username_invalid'; end if;
  if u ~ '(admin|vestibularr|suporte|moderador)' then raise exception 'username_reserved'; end if;
  if exists (select 1 from public.profiles where username = u and id <> me) then raise exception 'username_taken'; end if;
  if p_avatar is null or not (p_avatar ? 'emoji') or char_length(p_avatar ->> 'emoji') > 8
     or (p_avatar ->> 'color') not in ('cobalto', 'coral', 'menta', 'gema', 'tinta', 'roxo') then raise exception 'avatar_invalid'; end if;
  update public.profiles set username = u, avatar = jsonb_build_object('emoji', p_avatar ->> 'emoji', 'color', p_avatar ->> 'color') where id = me;
  return public._card(me);
end $$;

-- busca por @apelido (exato ou começo), no máximo 8, sem quem bloqueou/foi bloqueado
create or replace function public.social_search(p_q text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := public._me(); s text := lower(regexp_replace(coalesce(p_q, ''), '^@', ''));
begin
  if char_length(s) < 2 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(public._card(p.id) || jsonb_build_object('relation', coalesce(f.status, 'none'), 'requested_by_me', f.requested_by = me))
    from public.profiles p
    left join public.friendships f on f.user_a = least(me, p.id) and f.user_b = greatest(me, p.id)
   where p.username like replace(replace(s, '_', '\_'), '%', '\%') || '%' and p.id <> me and p.is_active
     and coalesce(f.status, '') <> 'blocked'
   limit 8), '[]'::jsonb);
end $$;

create or replace function public.friend_request(p_username text) returns text language plpgsql security definer set search_path = public as $$
declare me uuid := public._me(); other uuid; f public.friendships;
begin
  select id into other from public.profiles where username = lower(regexp_replace(p_username, '^@', '')) and is_active;
  if other is null or other = me then raise exception 'user_not_found'; end if;
  select * into f from public.friendships where user_a = least(me, other) and user_b = greatest(me, other);
  if found then
    if f.status = 'blocked' then raise exception 'user_not_found'; end if;
    if f.status = 'pending' and f.requested_by = other then  -- ele já tinha pedido: aceita
      update public.friendships set status = 'accepted', accepted_at = now() where user_a = f.user_a and user_b = f.user_b;
      return 'accepted';
    end if;
    return f.status;
  end if;
  if (select count(*) from public.friendships where (user_a = me or user_b = me) and status = 'pending' and requested_by = me) >= 30 then
    raise exception 'too_many_requests';
  end if;
  insert into public.friendships (user_a, user_b, requested_by, status) values (least(me, other), greatest(me, other), me, 'pending');
  return 'pending';
end $$;

-- p_action: accept | decline | remove | block
create or replace function public.friend_respond(p_user uuid, p_action text) returns text language plpgsql security definer set search_path = public as $$
declare me uuid := public._me(); f public.friendships;
begin
  select * into f from public.friendships where user_a = least(me, p_user) and user_b = greatest(me, p_user);
  if p_action = 'block' then
    insert into public.friendships (user_a, user_b, requested_by, status) values (least(me, p_user), greatest(me, p_user), me, 'blocked')
    on conflict (user_a, user_b) do update set status = 'blocked', requested_by = me;
    return 'blocked';
  end if;
  if not found then raise exception 'not_found'; end if;
  if p_action = 'accept' and f.status = 'pending' and f.requested_by <> me then
    update public.friendships set status = 'accepted', accepted_at = now() where user_a = f.user_a and user_b = f.user_b;
    return 'accepted';
  elsif p_action in ('decline', 'remove') and (f.status <> 'blocked' or f.requested_by = me) then
    delete from public.friendships where user_a = f.user_a and user_b = f.user_b;
    return 'removed';
  end if;
  raise exception 'invalid_action';
end $$;

create or replace function public.social_report(p_user uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public._me();
begin
  insert into public.reports (reporter, target, reason) values (me, p_user, p_reason);
  perform public.friend_respond(p_user, 'block');
end $$;

create or replace function public.crew_create(p_name text, p_emoji text) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := public._me(); v_id uuid;
begin
  if (select count(*) from public.crew_members where user_id = me) >= 3 then raise exception 'too_many_crews'; end if;
  insert into public.crews (name, emoji, owner_id) values (trim(p_name), coalesce(nullif(trim(p_emoji), ''), '🏴‍☠️'), me) returning id into v_id;
  insert into public.crew_members (crew_id, user_id, role) values (v_id, me, 'captain');
  return v_id;
end $$;

create or replace function public.crew_join(p_code text) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := public._me(); c public.crews;
begin
  select * into c from public.crews where invite_code = upper(trim(p_code));
  if not found then raise exception 'crew_not_found'; end if;
  if exists (select 1 from public.crew_members where crew_id = c.id and user_id = me) then return c.id; end if;
  if (select count(*) from public.crew_members where crew_id = c.id) >= 12 then raise exception 'crew_full'; end if;
  if (select count(*) from public.crew_members where user_id = me) >= 3 then raise exception 'too_many_crews'; end if;
  insert into public.crew_members (crew_id, user_id) values (c.id, me);
  perform public._post_activity(me, 'tripulacao', jsonb_build_object('crew', c.name, 'emoji', c.emoji));
  return c.id;
end $$;

create or replace function public.crew_leave(p_crew uuid) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public._me(); nxt uuid;
begin
  delete from public.crew_members where crew_id = p_crew and user_id = me;
  if not exists (select 1 from public.crew_members where crew_id = p_crew) then delete from public.crews where id = p_crew; return; end if;
  if (select owner_id from public.crews where id = p_crew) = me then  -- capitão saiu: passa para o mais antigo
    select user_id into nxt from public.crew_members where crew_id = p_crew order by joined_at limit 1;
    update public.crews set owner_id = nxt where id = p_crew;
    update public.crew_members set role = 'captain' where crew_id = p_crew and user_id = nxt;
  end if;
end $$;

-- boosts só entre amigos ou colegas de tripulação; empurrão só com mensagens prontas
create or replace function public.send_boost(p_to uuid, p_kind text, p_message text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public._me();
begin
  if not (public._are_friends(me, p_to) or public._crewmates(me, p_to)) then raise exception 'not_allowed'; end if;
  if p_kind = 'empurrao' and coalesce(p_message, '') not in ('Bora estudar! 📚', 'Não perde a sequência! 🔥', 'Tô estudando, vem junto! ⚓', 'Você consegue! 💪', 'Só 10 minutinhos hoje? ⏱️') then
    raise exception 'message_invalid';
  end if;
  begin
    insert into public.boosts (from_user, to_user, kind, message, expires_at)
    values (me, p_to, p_kind, case when p_kind = 'empurrao' then p_message end, case when p_kind = 'vento' then now() + interval '15 minutes' end);
  exception when unique_violation then raise exception 'boost_used_today';
  end;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.react(p_event bigint, p_emoji text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public._me(); owner uuid;
begin
  select user_id into owner from public.activity_events where id = p_event;
  if owner is null or not (owner = me or public._are_friends(me, owner) or public._crewmates(me, owner)) then raise exception 'not_allowed'; end if;
  if exists (select 1 from public.activity_reactions where event_id = p_event and user_id = me and emoji = p_emoji) then
    delete from public.activity_reactions where event_id = p_event and user_id = me and emoji = p_emoji;
  else
    insert into public.activity_reactions (event_id, user_id, emoji) values (p_event, me, p_emoji);
  end if;
  return coalesce((select jsonb_object_agg(emoji, n) from (select emoji, count(*) n from public.activity_reactions where event_id = p_event group by emoji) x), '{}'::jsonb);
end $$;

-- painel: eu, amigos (ranking da semana), pedidos, boosts recebidos, liga, tripulações
create or replace function public.social_overview() returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public._me(); w timestamptz := public._week_start(); lm public.league_members; res jsonb;
begin
  select * into lm from public.league_members where week = w and user_id = me;
  select jsonb_build_object(
    'me', public._card(me) || jsonb_build_object('total_xp', (select coalesce(sum(xp), 0) from public.xp_events where user_id = me),
           'boost_until', (select max(expires_at) from public.boosts where to_user = me and kind = 'vento' and expires_at > now())),
    'week_end', w + interval '7 days',
    'friends', coalesce((select jsonb_agg(c order by (c ->> 'week_xp')::int desc) from (
        select public._card(case when f.user_a = me then f.user_b else f.user_a end) c
          from public.friendships f where (f.user_a = me or f.user_b = me) and f.status = 'accepted'
        union all select public._card(me)) x), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(public._card(f.requested_by)) from public.friendships f
        where (f.user_a = me or f.user_b = me) and f.status = 'pending' and f.requested_by <> me), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(public._card(case when f.user_a = me then f.user_b else f.user_a end)) from public.friendships f
        where (f.user_a = me or f.user_b = me) and f.status = 'pending' and f.requested_by = me), '[]'::jsonb),
    'boosts', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'kind', b.kind, 'message', b.message, 'at', b.created_at, 'expires_at', b.expires_at, 'from', public._card(b.from_user)) order by b.created_at desc)
        from (select * from public.boosts where to_user = me and created_at > now() - interval '3 days' order by created_at desc limit 20) b), '[]'::jsonb),
    'sent_today', (select jsonb_build_object('vento', exists (select 1 from public.boosts where from_user = me and kind = 'vento' and day = public._sp_day()),
        'empurrao', coalesce((select jsonb_agg(to_user) from public.boosts where from_user = me and kind = 'empurrao' and day = public._sp_day()), '[]'::jsonb))),
    'league', case when lm.user_id is null then null else jsonb_build_object('tier', lm.tier, 'moved', lm.moved,
        'members', (select jsonb_agg(public._card(m.user_id) order by public._week_xp(m.user_id) desc) from public.league_members m
                     where m.week = w and m.tier = lm.tier and m.grp = lm.grp)) end,
    'crews', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'emoji', c.emoji, 'role', cm.role,
        'members', (select count(*) from public.crew_members where crew_id = c.id),
        'week_xp', (select coalesce(sum(public._week_xp(x.user_id)), 0) from public.crew_members x where x.crew_id = c.id)) order by c.created_at)
        from public.crew_members cm join public.crews c on c.id = cm.crew_id where cm.user_id = me), '[]'::jsonb)
  ) into res;
  update public.boosts set seen_at = now() where to_user = me and seen_at is null;
  return res;
end $$;

create or replace function public.crew_detail(p_crew uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public._me(); c public.crews;
begin
  select * into c from public.crews where id = p_crew;
  if not found or not exists (select 1 from public.crew_members where crew_id = p_crew and user_id = me) then raise exception 'not_found'; end if;
  return jsonb_build_object('id', c.id, 'name', c.name, 'emoji', c.emoji, 'invite_code', c.invite_code, 'owner', c.owner_id = me,
    'members', (select jsonb_agg(public._card(cm.user_id) || jsonb_build_object('role', cm.role) order by public._week_xp(cm.user_id) desc)
                  from public.crew_members cm where cm.crew_id = p_crew),
    'feed', public._feed(array(select user_id from public.crew_members where crew_id = p_crew), 40));
end $$;

-- mural: eventos dos usuários dados (com reações e se eu já reagi)
create or replace function public._feed(p_users uuid[], p_limit int) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'payload', e.payload, 'at', e.at, 'user', public._card(e.user_id),
      'reactions', coalesce((select jsonb_object_agg(emoji, n) from (select emoji, count(*) n from public.activity_reactions r where r.event_id = e.id group by emoji) x), '{}'::jsonb),
      'mine', coalesce((select jsonb_agg(emoji) from public.activity_reactions r where r.event_id = e.id and r.user_id = auth.uid()), '[]'::jsonb))
    order by e.at desc), '[]'::jsonb)
  from (select * from public.activity_events where user_id = any (p_users) order by at desc limit p_limit) e
$$;

create or replace function public.friends_feed() returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public._me();
begin
  return public._feed(array(select case when user_a = me then user_b else user_a end from public.friendships
                            where (user_a = me or user_b = me) and status = 'accepted') || me, 40);
end $$;

-- permissões: só as RPCs públicas
revoke execute on function public._award_xp(uuid, text, int, text), public._answer_xp(uuid, uuid, boolean), public._league_touch(uuid),
  public._post_activity(uuid, text, jsonb), public._activity_after_xp(uuid, int, int), public._card(uuid), public._feed(uuid[], int),
  public._are_friends(uuid, uuid), public._crewmates(uuid, uuid), public._xp_streak(uuid), public._week_xp(uuid), public._me()
  from public, anon, authenticated;
revoke execute on function public.social_set_profile(text, jsonb), public.social_search(text), public.friend_request(text),
  public.friend_respond(uuid, text), public.social_report(uuid, text), public.crew_create(text, text), public.crew_join(text),
  public.crew_leave(uuid), public.send_boost(uuid, text, text), public.react(bigint, text), public.social_overview(),
  public.crew_detail(uuid), public.friends_feed() from public, anon;
grant execute on function public.social_set_profile(text, jsonb), public.social_search(text), public.friend_request(text),
  public.friend_respond(uuid, text), public.social_report(uuid, text), public.crew_create(text, text), public.crew_join(text),
  public.crew_leave(uuid), public.send_boost(uuid, text, text), public.react(bigint, text), public.social_overview(),
  public.crew_detail(uuid), public.friends_feed() to authenticated;
