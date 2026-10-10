-- Desafio diário (estilo Duolingo) e escudos de sequência. Pode rodar de novo sem erro.
--
-- Desafio: 7 questões por dia, as mesmas o dia todo (vira à meia-noite de Brasília):
--   3 do assunto mais fraco · 2 de revisão (caderno de erros) · 1 de um assunto forte · 1 "chefão" (difícil, XP em dobro).
--   É um treino (gabarito na hora); completar as 7 dá +30 XP e entra no mural.
-- Sequência: dias seguidos com XP. Escudo de sequência: protege 1 dia perdido; ganha 1 a cada 7 dias seguidos,
--   no máximo 2 guardados. Não se compra escudo. O escudo é gasto quando o aluno volta a estudar.

-- ---------------------------------------------------------------- escudos
create table if not exists public.streak_shields (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  available smallint not null default 0 check (available between 0 and 2),
  earned_total int not null default 0,
  last_earned_day date
);
alter table public.streak_shields enable row level security;
drop policy if exists shields_own on public.streak_shields;
create policy shields_own on public.streak_shields for select to authenticated using (user_id = auth.uid());

-- dias cobertos por escudo (contam como "não quebrou", mas não somam na sequência)
create table if not exists public.streak_shield_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.streak_shield_days enable row level security;
drop policy if exists shield_days_own on public.streak_shield_days;
create policy shield_days_own on public.streak_shield_days for select to authenticated using (user_id = auth.uid());

create or replace function public._shields(p_user uuid) returns int language sql stable security definer set search_path = public as $$
  select coalesce((select available from public.streak_shields where user_id = p_user), 0)
$$;

-- Sequência: conta dias com XP; dias com escudo mantêm a sequência; um buraco recente que os escudos guardados
-- ainda cobrem também não quebra (o escudo é gasto de verdade quando o aluno volta).
create or replace function public._xp_streak(p_user uuid) returns int language plpgsql stable security definer set search_path = public as $$
declare d date := public._sp_day(); n int := 0; free int := public._shields(p_user); guard int := 0;
begin
  if not exists (select 1 from public.xp_events where user_id = p_user and day = d) then d := d - 1; end if;
  loop
    guard := guard + 1; exit when guard > 4000;
    if exists (select 1 from public.xp_events where user_id = p_user and day = d) then n := n + 1;
    elsif exists (select 1 from public.streak_shield_days where user_id = p_user and day = d) then null;
    elsif free > 0 and n = 0 and exists (select 1 from public.xp_events where user_id = p_user and day < d) then free := free - 1;
    else exit;
    end if;
    d := d - 1;
  end loop;
  return n;
end $$;

-- Primeira atividade do dia: cobre com escudos os dias perdidos desde o último dia ativo (se der para cobrir todos).
create or replace function public._streak_settle(p_user uuid) returns void language plpgsql security definer set search_path = public as $$
declare today date := public._sp_day(); last date; gap int; free int;
begin
  select max(day) into last from (
    select day from public.xp_events where user_id = p_user and day < today
    union all select day from public.streak_shield_days where user_id = p_user and day < today) s;
  if last is null then return; end if;
  gap := today - last - 1;
  if gap <= 0 then return; end if;
  free := public._shields(p_user);
  if gap > free then return; end if; -- a sequência quebrou; os escudos ficam guardados
  insert into public.streak_shield_days (user_id, day) select p_user, g::date from generate_series(last + 1, today - 1, interval '1 day') g
  on conflict do nothing;
  update public.streak_shields set available = available - gap where user_id = p_user;
  perform public._post_activity(p_user, 'escudo', jsonb_build_object('days', gap));
end $$;

-- ---------------------------------------------------------------- mural: novos tipos
alter table public.activity_events drop constraint if exists activity_events_kind_check;
alter table public.activity_events add constraint activity_events_kind_check
  check (kind in ('simulado', 'triagem', 'redacao', 'nivel', 'sequencia', 'liga', 'tripulacao', 'desafio', 'escudo'));
alter table public.xp_events drop constraint if exists xp_events_source_check;
alter table public.xp_events add constraint xp_events_source_check
  check (source in ('answer', 'simulado', 'triagem', 'essay', 'bonus', 'desafio'));

-- _award_xp: antes do primeiro XP do dia, acerta os escudos
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
  if not exists (select 1 from public.xp_events where user_id = p_user and day = public._sp_day()) then
    perform public._streak_settle(p_user);
  end if;
  insert into public.xp_events (user_id, source, xp, ref) values (p_user, p_source, v_xp, p_ref)
  on conflict (user_id, ref) do nothing;
  get diagnostics v_new = row_count;
  if not v_new then return 0; end if;
  perform public._league_touch(p_user);
  perform public._activity_after_xp(p_user, v_today, v_today + v_xp);
  return v_xp;
end $$;

-- marcos: nível; primeira atividade do dia que fecha 7/30/100/365; a cada 7 dias seguidos, +1 escudo (até 2)
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
    if s > 0 and s % 7 = 0 then
      insert into public.streak_shields (user_id, available, earned_total, last_earned_day)
      values (p_user, 1, 1, public._sp_day())
      on conflict (user_id) do update set available = least(2, streak_shields.available + 1),
        earned_total = streak_shields.earned_total + 1, last_earned_day = excluded.last_earned_day
        where streak_shields.last_earned_day is distinct from excluded.last_earned_day;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------- desafio do dia
create table if not exists public.daily_challenges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  boss_question uuid,
  focus_topic text,
  completed_at timestamptz,
  correct int,
  primary key (user_id, day)
);
alter table public.daily_challenges enable row level security;
drop policy if exists daily_own on public.daily_challenges;
create policy daily_own on public.daily_challenges for select to authenticated using (user_id = auth.uid());

-- Monta (ou devolve) o desafio de hoje e retorna o id da tentativa.
create or replace function public.daily_challenge_start()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := public._sp_day();
  v_id uuid;
  v_boards text[];
  v_weak text; v_strong text;
  v_ids uuid[] := '{}';
  v_boss uuid;
  v_need int;
begin
  if uid is null or not public.is_active_user() then raise exception 'permission denied' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('daily:' || uid::text));
  select attempt_id into v_id from public.daily_challenges where user_id = uid and day = today;
  if v_id is not null then return v_id; end if;

  select nullif(target_boards, '{}') into v_boards from public.profiles where id = uid;

  drop table if exists _pool;
  create temp table _pool on commit drop as
    select q.id, q.topic, q.irt_b from public.questions q join public.exam_boards b on b.id = q.board_id
     where public.q_listed(q.is_active, q.has_solution) and q.kind = 'objective' and q.language is distinct from 'espanhol'
       and (v_boards is null or b.code = any (v_boards))
       -- não repete o que respondeu nos últimos 30 dias
       and not exists (select 1 from public.attempt_answers aa join public.exam_attempts a on a.id = aa.attempt_id
                        where a.user_id = uid and aa.question_id = q.id and aa.choice is not null
                          and coalesce(aa.answered_at, aa.updated_at) > now() - interval '30 days');
  if (select count(*) from _pool) < 7 then -- banco pequeno: libera repetição
    drop table _pool;
    create temp table _pool on commit drop as
      select q.id, q.topic, q.irt_b from public.questions q join public.exam_boards b on b.id = q.board_id
       where public.q_listed(q.is_active, q.has_solution) and q.kind = 'objective' and q.language is distinct from 'espanhol'
         and (v_boards is null or b.code = any (v_boards));
  end if;
  if (select count(*) from _pool) = 0 then raise exception 'no_questions'; end if;

  -- assunto mais fraco e mais forte pelo histórico (acerto suavizado; precisa de pelo menos 3 respostas)
  with f as (select topic, avg(ok::int) acc, count(*) n from public.answer_facts(uid) where topic is not null group by topic having count(*) >= 3)
  select (select topic from f order by (acc * n + 1) / (n + 2), random() limit 1),
         (select topic from f where acc >= 0.7 order by acc desc, n desc limit 1)
    into v_weak, v_strong;
  if v_weak is null then select topic into v_weak from _pool where topic is not null group by topic order by count(*) desc, random() limit 1; end if;

  -- 3 do assunto fraco (mais fáceis primeiro, para engrenar)
  v_ids := v_ids || coalesce((select array_agg(id) from (select id from _pool where topic = v_weak order by coalesce(irt_b, 0), random() limit 3) s), '{}');
  -- 2 de revisão: erros em aberto (os que vencem antes)
  v_ids := v_ids || coalesce((select array_agg(question_id) from (
    select nb.question_id from public.error_notebook nb join public.questions q on q.id = nb.question_id and public.q_listed(q.is_active, q.has_solution)
     where nb.user_id = uid and nb.resolved_at is null and nb.question_id <> all (v_ids)
     order by nb.next_review_at limit 2) s), '{}');
  -- 1 de um assunto forte (para manter)
  if v_strong is not null and v_strong is distinct from v_weak then
    v_ids := v_ids || coalesce((select array_agg(id) from (select id from _pool where topic = v_strong and id <> all (v_ids) order by random() limit 1) s), '{}');
  end if;
  -- completa até 6 com questões variadas de dificuldade média
  v_need := 6 - coalesce(array_length(v_ids, 1), 0);
  if v_need > 0 then
    v_ids := v_ids || coalesce((select array_agg(id) from (select id from _pool where id <> all (v_ids)
      order by abs(coalesce(irt_b, 0.5) - 0.5) + random(), random() limit v_need) s), '{}');
  end if;
  -- chefão: a mais difícil disponível (XP em dobro)
  select id into v_boss from _pool where id <> all (v_ids) order by coalesce(irt_b, -9) desc, random() limit 1;
  if v_boss is not null then v_ids := v_ids || v_boss; end if;

  insert into public.exam_attempts (user_id, mode, title, config)
  values (uid, 'treino', 'Desafio do dia', jsonb_build_object('daily', today, 'boss', v_boss, 'focus', v_weak, 'picked', array_length(v_ids, 1)))
  returning id into v_id;
  insert into public.attempt_questions (attempt_id, position, question_id, section, weight)
    select v_id, (o.ord - 1)::int, o.qid, case when o.qid = v_boss then 'chefao' end, 1 from unnest(v_ids) with ordinality o(qid, ord);
  insert into public.daily_challenges (user_id, day, attempt_id, boss_question, focus_topic) values (uid, today, v_id, v_boss, v_weak);
  return v_id;
end $$;

-- Situação de hoje (para a tela inicial): não cria nada.
create or replace function public.daily_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'day', public._sp_day(),
    'attempt_id', d.attempt_id,
    'focus', d.focus_topic,
    'total', (select count(*) from public.attempt_questions where attempt_id = d.attempt_id),
    'answered', (select count(*) from public.attempt_answers where attempt_id = d.attempt_id and choice is not null),
    'completed', d.completed_at is not null,
    'correct', d.correct,
    'streak', public._xp_streak(auth.uid()),
    'studied_today', exists (select 1 from public.xp_events where user_id = auth.uid() and day = public._sp_day()),
    'shields', public._shields(auth.uid()),
    'days_done', (select count(*) from public.daily_challenges where user_id = auth.uid() and completed_at is not null),
    -- últimos 7 dias: estudou? usou escudo? fez o desafio?
    'week', (select jsonb_agg(jsonb_build_object(
               'day', g.d,
               'active', exists (select 1 from public.xp_events x where x.user_id = auth.uid() and x.day = g.d),
               'shield', exists (select 1 from public.streak_shield_days s where s.user_id = auth.uid() and s.day = g.d),
               'daily', exists (select 1 from public.daily_challenges c where c.user_id = auth.uid() and c.day = g.d and c.completed_at is not null))
             order by g.d)
             from (select (public._sp_day() - i) d from generate_series(6, 0, -1) i) g))
  from (select 1) one
  left join public.daily_challenges d on d.user_id = auth.uid() and d.day = public._sp_day();
$$;

-- XP do treino: o chefão vale o dobro; completar o desafio dá +30 e vai para o mural
create or replace function public.trg_xp_answer() returns trigger language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts; k text; base int; b real; ok boolean; dc public.daily_challenges; n_total int; n_done int; n_ok int;
begin
  if new.choice is null or (tg_op = 'UPDATE' and old.choice is not distinct from new.choice) then return new; end if;
  select * into a from public.exam_attempts where id = new.attempt_id;
  if a.mode not in ('treino', 'revisao', 'triagem') then return new; end if;
  select correct_label into k from public.answer_keys where question_id = new.question_id;
  if k is null then return new; end if;
  ok := new.choice = k;
  if a.config ->> 'boss' = new.question_id::text then
    select irt_b into b from public.questions where id = new.question_id;
    base := case when not ok then 2 when b is null or b < 0 then 10 when b < 1.5 then 15 else 20 end;
    perform public._award_xp(a.user_id, 'answer', base * 2, 'q:' || new.question_id::text || ':' || public._sp_day()::text);
  else
    perform public._answer_xp(a.user_id, new.question_id, ok);
  end if;

  if a.config ? 'daily' then
    select * into dc from public.daily_challenges where attempt_id = a.id;
    if found and dc.completed_at is null then
      select count(*) into n_total from public.attempt_questions where attempt_id = a.id;
      select count(*), count(*) filter (where aa.choice = kk.correct_label) into n_done, n_ok
        from public.attempt_answers aa left join public.answer_keys kk on kk.question_id = aa.question_id
       where aa.attempt_id = a.id and aa.choice is not null;
      if n_done >= n_total then
        update public.daily_challenges set completed_at = now(), correct = n_ok where user_id = dc.user_id and day = dc.day;
        perform public._award_xp(a.user_id, 'desafio', 30, 'daily:' || dc.day::text);
        perform public._post_activity(a.user_id, 'desafio', jsonb_build_object('correct', n_ok, 'total', n_total, 'streak', public._xp_streak(a.user_id)));
      end if;
    end if;
  end if;
  return new;
end $$;

revoke execute on function public._shields(uuid), public._streak_settle(uuid) from public, anon, authenticated;
revoke execute on function public.daily_challenge_start(), public.daily_status() from public, anon;
grant execute on function public.daily_challenge_start(), public.daily_status() to authenticated;
