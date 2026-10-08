-- Fase 3: simulados, treino, autosave com sincronização idempotente, caderno de erros.
--
-- Escrita do aluno SÓ por RPCs (security definer) que validam dono, estado e prazo.
-- O aluno nunca insere/atualiza attempts/answers direto: assim não monta conjuntos de
-- questões arbitrários, não altera cronômetro e não lê gabarito sem responder.

-- ---------------------------------------------------------------- tabelas
create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  exam_id uuid references public.exams (id) on delete set null,
  mode text not null check (mode in ('simulado', 'custom', 'treino', 'revisao')),
  title text not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'in_progress' check (status in ('in_progress', 'paused', 'finished', 'expired')),
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  paused_at timestamptz,
  paused_total_ms bigint not null default 0,
  finished_at timestamptz,
  current_index int not null default 0,
  current_index_ts bigint not null default 0,
  last_device text,
  score jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exam_attempts_user_status on public.exam_attempts (user_id, status);
create index exam_attempts_user_created on public.exam_attempts (user_id, created_at desc);
create trigger exam_attempts_updated_at before update on public.exam_attempts
  for each row execute function public.set_updated_at();

create table public.attempt_questions (
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  position int not null,
  question_id uuid not null references public.questions (id) on delete cascade,
  section text,
  weight numeric not null default 1,
  primary key (attempt_id, position),
  unique (attempt_id, question_id)
);
create index attempt_questions_question on public.attempt_questions (question_id);

create table public.attempt_answers (
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  choice text check (choice in ('A', 'B', 'C', 'D', 'E')),
  discursive_text text,
  flagged boolean not null default false,
  time_spent_ms bigint not null default 0,
  strikes jsonb not null default '[]'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  field_ts jsonb not null default '{}'::jsonb,
  answered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);
create index attempt_answers_question on public.attempt_answers (question_id);

-- Idempotência da sincronização: cada operação do cliente tem um op_id único.
create table public.attempt_ops_log (
  op_id uuid primary key,
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  applied_at timestamptz not null default now()
);

create table public.error_notebook (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  source_attempt_id uuid references public.exam_attempts (id) on delete set null,
  box int not null default 1 check (box between 1 and 5),
  next_review_at timestamptz not null default now() + interval '1 day',
  last_result text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index error_notebook_due on public.error_notebook (user_id, next_review_at) where resolved_at is null;

-- ---------------------------------------------------------------- RLS (somente leitura)
alter table public.exam_attempts enable row level security;
alter table public.attempt_questions enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.attempt_ops_log enable row level security;
alter table public.error_notebook enable row level security;

create policy attempts_select_own on public.exam_attempts for select to authenticated using (user_id = auth.uid() and public.is_active_user());
create policy attempts_select_admin on public.exam_attempts for select to authenticated using (public.is_admin());

create policy attempt_questions_select_own on public.attempt_questions for select to authenticated
  using (exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = auth.uid()));
create policy attempt_questions_select_admin on public.attempt_questions for select to authenticated using (public.is_admin());

create policy attempt_answers_select_own on public.attempt_answers for select to authenticated
  using (exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = auth.uid()));
create policy attempt_answers_select_admin on public.attempt_answers for select to authenticated using (public.is_admin());

create policy error_notebook_select_own on public.error_notebook for select to authenticated using (user_id = auth.uid() and public.is_active_user());
create policy error_notebook_select_admin on public.error_notebook for select to authenticated using (public.is_admin());
-- attempt_ops_log: sem policy = ninguém (nem o dono) lê; só as RPCs.

-- Gabarito para o aluno: só de questões que ele JÁ RESPONDEU, e apenas
--   • em treino/revisão (feedback imediato), ou
--   • em simulado/personalizado já encerrado (finished/expired).
create policy answer_keys_student on public.answer_keys for select to authenticated using (
  public.is_active_user() and exists (
    select 1
    from public.attempt_answers aa
    join public.exam_attempts a on a.id = aa.attempt_id
    where aa.question_id = answer_keys.question_id
      and a.user_id = auth.uid()
      and (aa.choice is not null or coalesce(aa.discursive_text, '') <> '')
      and (a.mode in ('treino', 'revisao') or a.status in ('finished', 'expired'))
  )
);

-- ---------------------------------------------------------------- utilitários
create or replace function public.server_time_ms()
returns bigint language sql stable as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

create or replace function public._ms(t timestamptz)
returns bigint language sql immutable as $$ select (extract(epoch from t) * 1000)::bigint $$;

-- ---------------------------------------------------------------- finalização
-- Calcula a pontuação básica e (na 1ª finalização) alimenta o caderno de erros.
create or replace function public._finalize_attempt(p_attempt uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.exam_attempts;
  first_time boolean;
  r record;
  new_box int;
  steps int[] := array[1, 3, 7, 14, 30];
begin
  select * into a from public.exam_attempts where id = p_attempt for update;
  first_time := a.finished_at is null;

  update public.exam_attempts set
    status = p_status,
    finished_at = coalesce(finished_at, case when p_status = 'expired' then least(now(), deadline_at) else now() end),
    paused_at = null,
    score = (
      select jsonb_build_object(
        'total', count(*) filter (where q.kind = 'objective'),
        'correct', count(*) filter (where q.kind = 'objective' and aa.choice is not null and aa.choice = k.correct_label),
        'wrong', count(*) filter (where q.kind = 'objective' and aa.choice is not null and aa.choice is distinct from k.correct_label),
        'blank', count(*) filter (where q.kind = 'objective' and aa.choice is null),
        'discursive_total', count(*) filter (where q.kind = 'discursive'),
        'discursive_answered', count(*) filter (where q.kind = 'discursive' and coalesce(aa.discursive_text, '') <> '')
      )
      from public.attempt_questions aq
      join public.questions q on q.id = aq.question_id
      left join public.attempt_answers aa on aa.attempt_id = aq.attempt_id and aa.question_id = aq.question_id
      left join public.answer_keys k on k.question_id = aq.question_id
      where aq.attempt_id = p_attempt
    )
  where id = p_attempt;

  if first_time then
    for r in
      select aq.question_id, aa.choice, k.correct_label, nb.box as old_box
      from public.attempt_questions aq
      join public.questions q on q.id = aq.question_id and q.kind = 'objective'
      join public.attempt_answers aa on aa.attempt_id = aq.attempt_id and aa.question_id = aq.question_id and aa.choice is not null
      join public.answer_keys k on k.question_id = aq.question_id and k.correct_label is not null
      left join public.error_notebook nb on nb.user_id = a.user_id and nb.question_id = aq.question_id
      where aq.attempt_id = p_attempt
    loop
      if r.choice is distinct from r.correct_label then
        insert into public.error_notebook (user_id, question_id, source_attempt_id, box, next_review_at, last_result)
        values (a.user_id, r.question_id, p_attempt, 1, now() + (steps[1] || ' days')::interval, 'wrong')
        on conflict (user_id, question_id) do update set
          box = 1, next_review_at = now() + (steps[1] || ' days')::interval, last_result = 'wrong',
          resolved_at = null, source_attempt_id = p_attempt, updated_at = now();
      elsif a.mode = 'revisao' and r.old_box is not null then
        new_box := r.old_box + 1;
        if new_box > 5 then
          update public.error_notebook set resolved_at = now(), last_result = 'right', updated_at = now()
            where user_id = a.user_id and question_id = r.question_id;
        else
          update public.error_notebook set box = new_box, next_review_at = now() + (steps[new_box] || ' days')::interval,
            last_result = 'right', updated_at = now()
            where user_id = a.user_id and question_id = r.question_id;
        end if;
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------- iniciar
-- p: { mode, exam_id?, title?, language?, minutes?, count?, board?, areas?[], subjects?[], topics?[],
--      work_id?, year_from?, year_to?, kinds?[], quotas?{subject:n}, discursive?:n }
create or replace function public.start_attempt(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_mode text := p ->> 'mode';
  v_id uuid;
  v_exam public.exams;
  v_fmt jsonb;
  v_title text;
  v_lang text := nullif(p ->> 'language', '');
  v_minutes int := nullif(p ->> 'minutes', '')::int;
  v_count int := least(coalesce(nullif(p ->> 'count', '')::int, 10), 200);
  v_board uuid;
  v_n int;
  v_ids uuid[];
  k text; n int;
begin
  if uid is null or not public.is_active_user() then raise exception 'permission denied' using errcode = '42501'; end if;
  if v_mode not in ('simulado', 'custom', 'treino', 'revisao') then raise exception 'modo inválido'; end if;
  if v_minutes is not null and (v_minutes < 1 or v_minutes > 600) then raise exception 'tempo inválido'; end if;
  if v_lang is not null and v_lang not in ('ingles', 'espanhol') then raise exception 'idioma inválido'; end if;

  if p ? 'board' and nullif(p ->> 'board', '') is not null then
    select id into v_board from public.exam_boards where code = p ->> 'board';
    if v_board is null then raise exception 'vestibular inválido'; end if;
  end if;

  -- ---- monta a lista de questões
  drop table if exists _picked;
  drop table if exists _cand;
  create temp table _picked (question_id uuid, section text, weight numeric, pos int) on commit drop;

  if v_mode = 'simulado' then
    select * into v_exam from public.exams where id = (p ->> 'exam_id')::uuid and is_published;
    if not found then raise exception 'prova não encontrada'; end if;
    if exists (select 1 from public.exam_questions eq join public.questions q on q.id = eq.question_id
               where eq.exam_id = v_exam.id and q.language is not null) and v_lang is null then
      raise exception 'language_required';
    end if;
    insert into _picked
      select eq.question_id, eq.section, eq.weight,
             (row_number() over (order by eq.position, q.language nulls first, q.id))::int - 1
      from public.exam_questions eq join public.questions q on q.id = eq.question_id
      where eq.exam_id = v_exam.id and q.is_active and (q.language is null or q.language = v_lang);
    select structure into v_fmt from public.exam_formats where id = v_exam.format_id;
    v_title := v_exam.name;
    v_minutes := coalesce(v_minutes, nullif(v_fmt ->> 'duration_minutes', '')::int);
  elsif nullif(p ->> 'retry_attempt', '') is not null then
    -- refazer só o que errou/deixou em branco num simulado anterior do próprio aluno (já encerrado)
    if not exists (select 1 from public.exam_attempts where id = (p ->> 'retry_attempt')::uuid and user_id = uid
                   and status in ('finished', 'expired')) then
      raise exception 'tentativa não encontrada';
    end if;
    insert into _picked
      select aq.question_id, null, 1, (row_number() over (order by aq.position))::int - 1
      from public.attempt_questions aq
      join public.questions q on q.id = aq.question_id and q.kind = 'objective' and q.is_active
      left join public.attempt_answers aa on aa.attempt_id = aq.attempt_id and aa.question_id = aq.question_id
      left join public.answer_keys k on k.question_id = aq.question_id
      where aq.attempt_id = (p ->> 'retry_attempt')::uuid
        and (aa.choice is null or aa.choice is distinct from k.correct_label);
    v_title := 'Refazer erros';
  elsif v_mode = 'revisao' then
    insert into _picked
      select nb.question_id, null, 1, (row_number() over (order by nb.next_review_at))::int - 1
      from public.error_notebook nb join public.questions q on q.id = nb.question_id and q.is_active
      where nb.user_id = uid and nb.resolved_at is null and nb.next_review_at <= now()
      order by nb.next_review_at limit v_count;
    v_title := 'Revisão de erros';
  else
    v_title := coalesce(nullif(p ->> 'title', ''), case when v_mode = 'treino' then 'Treino' else 'Simulado personalizado' end);
    -- base de filtros reaproveitada
    create temp table _cand on commit drop as
      select q.id, q.subject from public.questions q
      where q.is_active
        and (v_board is null or q.board_id = v_board)
        and (q.language is null or q.language = coalesce(v_lang, 'ingles'))
        and (not p ? 'areas' or jsonb_array_length(p -> 'areas') = 0 or q.area in (select jsonb_array_elements_text(p -> 'areas')))
        and (not p ? 'subjects' or jsonb_array_length(p -> 'subjects') = 0 or q.subject in (select jsonb_array_elements_text(p -> 'subjects')))
        and (not p ? 'topics' or jsonb_array_length(p -> 'topics') = 0 or q.topic in (select jsonb_array_elements_text(p -> 'topics')))
        and (nullif(p ->> 'work_id', '') is null or q.work_id = (p ->> 'work_id')::uuid)
        and (nullif(p ->> 'year_from', '') is null or q.year >= (p ->> 'year_from')::int)
        and (nullif(p ->> 'year_to', '') is null or q.year <= (p ->> 'year_to')::int)
        and (case when p ? 'kinds' and jsonb_array_length(p -> 'kinds') > 0
                  then q.kind in (select jsonb_array_elements_text(p -> 'kinds')) else q.kind = 'objective' end);
    if p ? 'quotas' and jsonb_typeof(p -> 'quotas') = 'object' then
      for k, n in select key, value::int from jsonb_each_text(p -> 'quotas') loop
        select array_agg(id) into v_ids from (select id from _cand where subject = k order by random() limit least(n, 100)) s;
        insert into _picked select unnest(coalesce(v_ids, '{}')), k, 1, 0;
      end loop;
      if coalesce(nullif(p ->> 'discursive', '')::int, 0) > 0 then
        select array_agg(id) into v_ids from (
          select q.id from public.questions q
          where q.is_active and q.kind = 'discursive' and (v_board is null or q.board_id = v_board)
          order by random() limit least((p ->> 'discursive')::int, 10)) s;
        insert into _picked select unnest(coalesce(v_ids, '{}')), 'discursiva', 1, 0;
      end if;
    else
      insert into _picked select id, null, 1, 0 from _cand order by random() limit v_count;
    end if;
    -- ordem final: aleatória estável por posição
    update _picked set pos = s.rn from (select question_id, (row_number() over (order by random()))::int - 1 as rn from _picked) s
      where _picked.question_id = s.question_id;
    if v_mode = 'treino' then v_minutes := null; end if;
  end if;

  select count(*) into v_n from _picked;
  if v_n = 0 then
    raise exception '%', case v_mode when 'revisao' then 'no_errors_due' else 'no_questions' end;
  end if;

  insert into public.exam_attempts (user_id, exam_id, mode, title, config, deadline_at)
  values (uid, v_exam.id, v_mode, v_title,
          p - 'mode' - 'exam_id' || jsonb_build_object('requested', v_count, 'picked', v_n, 'minutes', v_minutes),
          case when v_minutes is not null then now() + make_interval(mins => v_minutes) end)
  returning id into v_id;

  insert into public.attempt_questions (attempt_id, position, question_id, section, weight)
    select v_id, pos, question_id, section, weight from _picked;
  return v_id;
end $$;

-- ---------------------------------------------------------------- estado
create or replace function public.attempt_state(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  if a.status = 'in_progress' and a.deadline_at is not null and now() > a.deadline_at then
    perform public._finalize_attempt(a.id, 'expired');
    select * into a from public.exam_attempts where id = p_attempt;
  end if;
  return jsonb_build_object(
    'server_now', public.server_time_ms(),
    'attempt', jsonb_build_object(
      'id', a.id, 'mode', a.mode, 'title', a.title, 'status', a.status, 'config', a.config,
      'started_at', public._ms(a.started_at), 'deadline_at', public._ms(a.deadline_at),
      'paused_at', public._ms(a.paused_at), 'finished_at', public._ms(a.finished_at),
      'current_index', a.current_index, 'score', a.score),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', aa.question_id, 'choice', aa.choice, 'discursive_text', aa.discursive_text,
        'flagged', aa.flagged, 'time_spent_ms', aa.time_spent_ms, 'strikes', aa.strikes,
        'highlights', aa.highlights, 'field_ts', aa.field_ts))
      from public.attempt_answers aa where aa.attempt_id = a.id), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------- sincronizar
-- ops: [{op_id, question_id?, field, value, ts(ms)}]. Idempotente por op_id; última escrita por campo (ts).
-- Resposta: ids aplicados (inclui duplicatas já aplicadas) e rejeitados com motivo (definitivo).
create or replace function public.sync_attempt(p_attempt uuid, p_ops jsonb, p_device text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.exam_attempts;
  op jsonb; v_op uuid; v_ts bigint; v_field text; v_qid uuid; v jsonb;
  applied jsonb := '[]'::jsonb; rejected jsonb := '[]'::jsonb; n_applied int := 0;
  dl_ms bigint; cur_ts bigint; ok boolean;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) > 500 then raise exception 'ops inválidas'; end if;

  if a.status = 'in_progress' and a.deadline_at is not null and now() > a.deadline_at then
    perform public._finalize_attempt(a.id, 'expired');
    select * into a from public.exam_attempts where id = p_attempt;
  end if;
  dl_ms := public._ms(a.deadline_at);

  for op in select * from jsonb_array_elements(p_ops) loop
    v_op := (op ->> 'op_id')::uuid;
    v_ts := (op ->> 'ts')::bigint;
    v_field := op ->> 'field';
    v := op -> 'value';

    if exists (select 1 from public.attempt_ops_log where op_id = v_op) then
      applied := applied || to_jsonb(v_op); continue;
    end if;
    if a.status = 'finished' then
      rejected := rejected || jsonb_build_object('op_id', v_op, 'reason', 'finished'); continue;
    end if;
    if a.status = 'expired' and now() > a.deadline_at + interval '24 hours' then
      rejected := rejected || jsonb_build_object('op_id', v_op, 'reason', 'closed'); continue;
    end if;
    if dl_ms is not null and v_ts > dl_ms + 5000 then
      rejected := rejected || jsonb_build_object('op_id', v_op, 'reason', 'late'); continue;
    end if;

    ok := true;
    if v_field = 'current_index' then
      if jsonb_typeof(v) = 'number' and v_ts > a.current_index_ts then
        update public.exam_attempts set current_index = greatest((v #>> '{}')::int, 0), current_index_ts = v_ts
          where id = a.id;
      end if;
    else
      v_qid := (op ->> 'question_id')::uuid;
      if not exists (select 1 from public.attempt_questions where attempt_id = a.id and question_id = v_qid) then
        rejected := rejected || jsonb_build_object('op_id', v_op, 'reason', 'unknown_question'); continue;
      end if;
      insert into public.attempt_answers (attempt_id, question_id) values (a.id, v_qid) on conflict do nothing;
      cur_ts := coalesce((select (field_ts ->> v_field)::bigint from public.attempt_answers where attempt_id = a.id and question_id = v_qid), 0);

      -- 1) valida o valor (sempre, antes de olhar timestamps)
      ok := case v_field
        when 'time_spent_ms' then jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric between 0 and 86400000
        when 'choice' then jsonb_typeof(v) = 'null' or (jsonb_typeof(v) = 'string' and (v #>> '{}') in ('A', 'B', 'C', 'D', 'E'))
        when 'discursive_text' then jsonb_typeof(v) in ('string', 'null') and length(coalesce(v #>> '{}', '')) <= 20000
        when 'flagged' then jsonb_typeof(v) = 'boolean'
        when 'strikes' then jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 50 and length(v::text) <= 20000
        when 'highlights' then jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 50 and length(v::text) <= 20000
        else false end;

      -- 2) aplica (última escrita por campo; tempo vence o maior)
      if ok then
        if v_field = 'time_spent_ms' then
          update public.attempt_answers set time_spent_ms = greatest(time_spent_ms, (v #>> '{}')::bigint), updated_at = now()
            where attempt_id = a.id and question_id = v_qid;
        elsif v_ts > cur_ts then
          if v_field = 'choice' then
            update public.attempt_answers set choice = case when jsonb_typeof(v) = 'null' then null else v #>> '{}' end,
              answered_at = case when jsonb_typeof(v) = 'null' then null else now() end,
              field_ts = jsonb_set(field_ts, '{choice}', to_jsonb(v_ts)), updated_at = now()
              where attempt_id = a.id and question_id = v_qid;
          elsif v_field = 'discursive_text' then
            update public.attempt_answers set discursive_text = v #>> '{}',
              field_ts = jsonb_set(field_ts, '{discursive_text}', to_jsonb(v_ts)), updated_at = now()
              where attempt_id = a.id and question_id = v_qid;
          elsif v_field = 'flagged' then
            update public.attempt_answers set flagged = (v #>> '{}')::boolean,
              field_ts = jsonb_set(field_ts, '{flagged}', to_jsonb(v_ts)), updated_at = now()
              where attempt_id = a.id and question_id = v_qid;
          elsif v_field = 'strikes' then
            update public.attempt_answers set strikes = v, field_ts = jsonb_set(field_ts, '{strikes}', to_jsonb(v_ts)), updated_at = now()
              where attempt_id = a.id and question_id = v_qid;
          elsif v_field = 'highlights' then
            update public.attempt_answers set highlights = v, field_ts = jsonb_set(field_ts, '{highlights}', to_jsonb(v_ts)), updated_at = now()
              where attempt_id = a.id and question_id = v_qid;
          end if;
        end if; -- v_ts <= cur_ts: escrita mais antiga, ignorada (mas processada)
      end if;
    end if;

    if ok then
      insert into public.attempt_ops_log (op_id, attempt_id) values (v_op, a.id);
      applied := applied || to_jsonb(v_op);
      n_applied := n_applied + 1;
    else
      rejected := rejected || jsonb_build_object('op_id', v_op, 'reason', 'invalid');
    end if;
  end loop;

  update public.exam_attempts set last_device = coalesce(nullif(left(p_device, 40), ''), last_device) where id = a.id;
  -- Operações tardias legítimas num simulado já expirado: recalcula a pontuação.
  if a.status = 'expired' and n_applied > 0 then perform public._finalize_attempt(a.id, 'expired'); end if;

  select * into a from public.exam_attempts where id = p_attempt;
  return jsonb_build_object('server_now', public.server_time_ms(), 'status', a.status,
    'deadline_at', public._ms(a.deadline_at), 'current_index', a.current_index,
    'applied', applied, 'rejected', rejected);
end $$;

-- ---------------------------------------------------------------- encerrar / pausar / retomar
create or replace function public.finish_attempt(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if a.status in ('in_progress', 'paused') then
    perform public._finalize_attempt(a.id, case when a.deadline_at is not null and now() > a.deadline_at then 'expired' else 'finished' end);
  end if;
  select * into a from public.exam_attempts where id = p_attempt;
  return jsonb_build_object('status', a.status, 'score', a.score);
end $$;

create or replace function public.pause_attempt(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if a.status = 'in_progress' and (a.deadline_at is null or now() <= a.deadline_at) then
    update public.exam_attempts set status = 'paused', paused_at = now() where id = a.id;
  end if;
  return public.attempt_state(p_attempt);
end $$;

create or replace function public.resume_attempt(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if a.status = 'paused' then
    update public.exam_attempts set
      status = 'in_progress',
      deadline_at = case when deadline_at is not null then deadline_at + (now() - paused_at) end,
      paused_total_ms = paused_total_ms + (extract(epoch from (now() - paused_at)) * 1000)::bigint,
      paused_at = null
    where id = a.id;
  end if;
  return public.attempt_state(p_attempt);
end $$;

-- ---------------------------------------------------------------- permissões
revoke execute on function public._finalize_attempt(uuid, text) from public, anon, authenticated;
revoke execute on function public.start_attempt(jsonb), public.attempt_state(uuid),
  public.sync_attempt(uuid, jsonb, text), public.finish_attempt(uuid), public.pause_attempt(uuid),
  public.resume_attempt(uuid) from public, anon;
grant execute on function public.start_attempt(jsonb), public.attempt_state(uuid),
  public.sync_attempt(uuid, jsonb, text), public.finish_attempt(uuid), public.pause_attempt(uuid),
  public.resume_attempt(uuid), public.server_time_ms() to authenticated;

-- ---------------------------------------------------------------- facetas do banco (filtros)
-- security invoker: respeita a RLS do chamador (aluno só conta questões ativas).
create or replace function public.bank_facets()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'subjects', coalesce((select jsonb_agg(jsonb_build_object('name', subject, 'board', board, 'n', n) order by board, subject)
       from (select q.subject, b.code as board, count(*)::int n from public.questions q join public.exam_boards b on b.id = q.board_id
             where q.subject is not null and q.is_active group by 1, 2) s), '[]'::jsonb),
    'topics', coalesce((select jsonb_agg(jsonb_build_object('name', topic, 'subject', subject, 'board', board, 'n', n) order by board, subject, topic)
       from (select q.topic, q.subject, b.code as board, count(*)::int n from public.questions q join public.exam_boards b on b.id = q.board_id
             where q.topic is not null and q.is_active group by 1, 2, 3) t), '[]'::jsonb),
    'areas', coalesce((select jsonb_agg(jsonb_build_object('name', area, 'board', board, 'n', n) order by board, area)
       from (select q.area, b.code as board, count(*)::int n from public.questions q join public.exam_boards b on b.id = q.board_id
             where q.area is not null and q.is_active group by 1, 2) a), '[]'::jsonb),
    'works', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title)) from public.literary_works w), '[]'::jsonb)
  );
$$;
grant execute on function public.bank_facets() to authenticated;
revoke execute on function public.bank_facets() from public, anon;
