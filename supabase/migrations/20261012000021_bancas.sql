-- 0021: provas reais da UFPR (as 7 línguas estrangeiras do vestibular) e concursos públicos.
-- Idempotente.

-- ---------------------------------------------------------------- línguas estrangeiras
-- A UFPR oferece inglês, espanhol, francês, alemão, italiano, japonês e polonês (questões 83–90).
create or replace function public.is_language(p text) returns boolean language sql immutable as $$
  select p in ('ingles', 'espanhol', 'frances', 'alemao', 'italiano', 'japones', 'polones')
$$;
grant execute on function public.is_language(text) to authenticated;

alter table public.questions drop constraint if exists questions_language_check;
alter table public.questions add constraint questions_language_check check (language is null or public.is_language(language));

-- ---------------------------------------------------------------- bancas: vestibular x concurso
alter table public.exam_boards add column if not exists kind text not null default 'vestibular';
alter table public.exam_boards drop constraint if exists exam_boards_kind_check;
alter table public.exam_boards add constraint exam_boards_kind_check check (kind in ('vestibular', 'concurso'));
insert into public.exam_boards (code, name, kind) values ('CONCURSO', 'Concursos públicos', 'concurso')
on conflict (code) do update set name = excluded.name, kind = excluded.kind;

-- Simulado da 1ª fase da UFPR (até 2026): 90 questões em 5h30. Concursos de nível médio do NC/UFPR: 40 questões em 4h.
update public.exam_formats set structure = structure || '{"duration_minutes":330}'::jsonb
 where code = 'UFPR_2fases_ate_2026' and not structure ? 'duration_minutes';
insert into public.exam_formats (board_id, code, name, valid_from_year, valid_to_year, structure)
select id, 'NCUFPR_medio_40', 'NC/UFPR — nível médio (40 questões)', null, null,
       '{"duration_minutes":240,"alternatives":5,"sections":[{"key":"comum","name":"Português, Raciocínio Matemático, Informática e Legislação","questions":30},{"key":"especificos","name":"Conhecimentos Específicos","questions":10}]}'::jsonb
  from public.exam_boards where code = 'CONCURSO'
on conflict (code) do nothing;

-- ---------------------------------------------------------------- import_bundle
create or replace function public.import_bundle(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_board uuid; v_exam uuid; v_format uuid; v_qid uuid; v_work uuid; v_year int;
  e jsonb; q jsonb; a jsonb;
  n_exams int := 0; n_ins int := 0; n_upd int := 0; n_alt int;
begin
  if not (public.is_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select id into v_board from public.exam_boards where code = p ->> 'board';
  if v_board is null then raise exception 'vestibular desconhecido: %', p ->> 'board'; end if;

  for e in
    select * from jsonb_array_elements(
      coalesce(p -> 'exams', '[]'::jsonb)
      || case when jsonb_array_length(coalesce(p -> 'questions', '[]'::jsonb)) > 0
              then jsonb_build_array(jsonb_build_object('_standalone', true, 'questions', p -> 'questions'))
              else '[]'::jsonb end)
  loop
    v_exam := null; v_year := null;
    if not (e ? '_standalone') then
      v_year := (e ->> 'year')::int;
      v_format := null;
      if nullif(e ->> 'format', '') is not null then
        select id into v_format from public.exam_formats where code = e ->> 'format';
      end if;
      insert into public.exams (board_id, format_id, year, name, day, pdf_url, answer_pdf_url)
      values (v_board, v_format, v_year, e ->> 'name', e ->> 'day', e ->> 'pdf_url', e ->> 'answer_pdf_url')
      on conflict (board_id, year, name) do update set
        format_id = coalesce(excluded.format_id, exams.format_id),
        day = coalesce(excluded.day, exams.day),
        pdf_url = coalesce(excluded.pdf_url, exams.pdf_url),
        answer_pdf_url = coalesce(excluded.answer_pdf_url, exams.answer_pdf_url)
      returning id into v_exam;
      n_exams := n_exams + 1;
    end if;

    for q in select * from jsonb_array_elements(coalesce(e -> 'questions', '[]'::jsonb)) loop
      v_work := null;
      if nullif(q ->> 'work', '') is not null then
        select id into v_work from public.literary_works
          where board_id = v_board and lower(title) = lower(q ->> 'work');
        if v_work is null then
          insert into public.literary_works (board_id, title) values (v_board, q ->> 'work') returning id into v_work;
        end if;
      end if;

      v_qid := null;
      -- mesma questão em várias provas (parte comum dos cargos de um concurso): o external_id liga à já gravada
      if nullif(q ->> 'external_id', '') is not null then
        select id into v_qid from public.questions
          where board_id = v_board and external_id = q ->> 'external_id';
      end if;
      if v_qid is not null then
        null;
      elsif v_exam is not null and nullif(q ->> 'number', '') is not null then
        select id into v_qid from public.questions
          where exam_id = v_exam and number = (q ->> 'number')::int
            and coalesce(language, '') = coalesce(q ->> 'language', '');
      elsif nullif(q ->> 'external_id', '') is not null then
        select id into v_qid from public.questions
          where board_id = v_board and external_id = q ->> 'external_id';
      end if;

      if v_qid is null then
        insert into public.questions (board_id, exam_id, year, number, language, kind, area, subject, topic,
                                      work_id, section, statement_md, images, source_ref, external_id)
        values (v_board, v_exam, coalesce(v_year, (q ->> 'year')::int), (q ->> 'number')::int,
                nullif(q ->> 'language', ''), coalesce(q ->> 'kind', 'objective'), nullif(q ->> 'area', ''),
                nullif(q ->> 'subject', ''), nullif(q ->> 'topic', ''), v_work, nullif(q ->> 'section', ''),
                q ->> 'statement_md', coalesce(q -> 'images', '[]'::jsonb), nullif(q ->> 'source_ref', ''),
                nullif(q ->> 'external_id', ''))
        returning id into v_qid;
        n_ins := n_ins + 1;
      else
        update public.questions set
          year = coalesce(v_year, (q ->> 'year')::int, year),
          language = nullif(q ->> 'language', ''),
          kind = coalesce(q ->> 'kind', 'objective'),
          area = nullif(q ->> 'area', ''), subject = nullif(q ->> 'subject', ''), topic = nullif(q ->> 'topic', ''),
          work_id = v_work, section = nullif(q ->> 'section', ''),
          statement_md = q ->> 'statement_md', images = coalesce(q -> 'images', '[]'::jsonb),
          source_ref = nullif(q ->> 'source_ref', ''), external_id = coalesce(nullif(q ->> 'external_id', ''), external_id)
        where id = v_qid;
        n_upd := n_upd + 1;
      end if;

      delete from public.alternatives where question_id = v_qid;
      for a in select * from jsonb_array_elements(coalesce(q -> 'alternatives', '[]'::jsonb)) loop
        insert into public.alternatives (question_id, label, text_md, image_url)
        values (v_qid, a ->> 'label', coalesce(a ->> 'text_md', ''), nullif(a ->> 'image_url', ''));
      end loop;

      if nullif(q ->> 'correct', '') is not null or nullif(q ->> 'official_mirror_md', '') is not null then
        insert into public.answer_keys (question_id, correct_label, explanation_md, official_mirror_md, max_score)
        values (v_qid, nullif(q ->> 'correct', ''), nullif(q ->> 'explanation_md', ''),
                nullif(q ->> 'official_mirror_md', ''), (q ->> 'max_score')::numeric)
        on conflict (question_id) do update set
          correct_label = excluded.correct_label,
          explanation_md = coalesce(excluded.explanation_md, answer_keys.explanation_md),
          official_mirror_md = coalesce(excluded.official_mirror_md, answer_keys.official_mirror_md),
          max_score = coalesce(excluded.max_score, answer_keys.max_score);
      end if;

      if v_exam is not null then
        insert into public.exam_questions (exam_id, question_id, position, section)
        values (v_exam, v_qid, coalesce((q ->> 'number')::int, 0), nullif(q ->> 'section', ''))
        on conflict (exam_id, question_id) do update set position = excluded.position, section = excluded.section;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('exams', n_exams, 'inserted', n_ins, 'updated', n_upd);
end $$;

revoke execute on function public.import_bundle(jsonb) from public, anon;

-- ---------------------------------------------------------------- funções que validavam só inglês/espanhol
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
  if v_lang is not null and not public.is_language(v_lang) then raise exception 'idioma inválido'; end if;

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
      where eq.exam_id = v_exam.id and public.q_listed(q.is_active, q.has_solution) and (q.language is null or q.language = v_lang);
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
      join public.questions q on q.id = aq.question_id and q.kind = 'objective' and public.q_listed(q.is_active, q.has_solution)
      left join public.attempt_answers aa on aa.attempt_id = aq.attempt_id and aa.question_id = aq.question_id
      left join public.answer_keys k on k.question_id = aq.question_id
      where aq.attempt_id = (p ->> 'retry_attempt')::uuid
        and (aa.choice is null or aa.choice is distinct from k.correct_label);
    v_title := 'Refazer erros';
  elsif v_mode = 'revisao' then
    insert into _picked
      select nb.question_id, null, 1, (row_number() over (order by nb.next_review_at))::int - 1
      from public.error_notebook nb join public.questions q on q.id = nb.question_id and public.q_listed(q.is_active, q.has_solution)
      where nb.user_id = uid and nb.resolved_at is null and nb.next_review_at <= now()
      order by nb.next_review_at limit v_count;
    v_title := 'Revisão de erros';
  else
    v_title := coalesce(nullif(p ->> 'title', ''), case when v_mode = 'treino' then 'Treino' else 'Simulado personalizado' end);
    -- base de filtros reaproveitada
    create temp table _cand on commit drop as
      select q.id, q.subject from public.questions q
      where public.q_listed(q.is_active, q.has_solution)
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
          where public.q_listed(q.is_active, q.has_solution) and q.kind = 'discursive' and (v_board is null or q.board_id = v_board)
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

create or replace function public.export_create(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_source text := coalesce(nullif(p ->> 'source', ''), 'banco');
  v_size jsonb;
  v_max int;
  v_count int;
  v_board uuid;
  v_lang text := coalesce(nullif(p ->> 'language', ''), 'ingles');
  v_ids uuid[];
  v_title text;
  v_id uuid;
begin
  if uid is null or not public.is_active_user() then raise exception 'permission denied' using errcode = '42501'; end if;
  if v_source not in ('banco', 'erros', 'tentativa') then raise exception 'origem inválida'; end if;
  if not public.is_language(v_lang) then raise exception 'idioma inválido'; end if;

  v_size := public._entitlement(uid, 'export_size');
  v_max := case when (v_size ->> 'unlimited')::boolean then 200 else least(coalesce((v_size ->> 'quota')::int, 0), 200) end;
  v_count := least(greatest(coalesce(nullif(p ->> 'count', '')::int, 20), 1), v_max);
  if v_max <= 0 then raise exception 'plan_limit:export'; end if;

  if nullif(p ->> 'board', '') is not null then
    select id into v_board from public.exam_boards where code = p ->> 'board';
    if v_board is null then raise exception 'vestibular inválido'; end if;
  end if;

  if v_source = 'tentativa' then
    if not exists (select 1 from public.exam_attempts where id = (p ->> 'attempt_id')::uuid and user_id = uid) then
      raise exception 'tentativa não encontrada';
    end if;
    select array_agg(question_id order by position) into v_ids from (
      select aq.question_id, aq.position from public.attempt_questions aq
      join public.questions q on q.id = aq.question_id and public.q_listed(q.is_active, q.has_solution)
      left join public.attempt_answers aa on aa.attempt_id = aq.attempt_id and aa.question_id = aq.question_id
      left join public.answer_keys k on k.question_id = aq.question_id
      where aq.attempt_id = (p ->> 'attempt_id')::uuid
        and (not coalesce((p ->> 'only_wrong')::boolean, false) or aa.choice is null or aa.choice is distinct from k.correct_label)
      order by aq.position limit v_count) s;
    v_title := coalesce(nullif(p ->> 'title', ''), (select title from public.exam_attempts where id = (p ->> 'attempt_id')::uuid));
  elsif v_source = 'erros' then
    select array_agg(question_id) into v_ids from (
      select nb.question_id from public.error_notebook nb
      join public.questions q on q.id = nb.question_id and public.q_listed(q.is_active, q.has_solution)
      where nb.user_id = uid and nb.resolved_at is null
      order by nb.next_review_at limit v_count) s;
    v_title := coalesce(nullif(p ->> 'title', ''), 'Meu caderno de erros');
  else
    select array_agg(id) into v_ids from (
      select q.id from public.questions q
      where public.q_listed(q.is_active, q.has_solution)
        and (v_board is null or q.board_id = v_board)
        and (q.language is null or q.language = v_lang)
        and (not p ? 'areas' or jsonb_array_length(p -> 'areas') = 0 or q.area in (select jsonb_array_elements_text(p -> 'areas')))
        and (not p ? 'subjects' or jsonb_array_length(p -> 'subjects') = 0 or q.subject in (select jsonb_array_elements_text(p -> 'subjects')))
        and (not p ? 'topics' or jsonb_array_length(p -> 'topics') = 0 or q.topic in (select jsonb_array_elements_text(p -> 'topics')))
        and (nullif(p ->> 'year_from', '') is null or q.year >= (p ->> 'year_from')::int)
        and (nullif(p ->> 'year_to', '') is null or q.year <= (p ->> 'year_to')::int)
        and q.kind = 'objective'
      order by random() limit v_count) s;
    v_title := coalesce(nullif(p ->> 'title', ''), 'Lista de questões');
  end if;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception '%', case v_source when 'erros' then 'no_errors' else 'no_questions' end;
  end if;

  -- ordem do livro: por área/disciplina/assunto (padrão) ou aleatória (como numa prova)
  if coalesce(p ->> 'order', 'assunto') = 'assunto' and v_source <> 'tentativa' then
    select array_agg(q.id order by array_position(array['linguagens', 'humanas', 'natureza', 'matematica'], q.area) nulls last,
                     q.subject nulls last, q.topic nulls last, q.year, q.number)
      into v_ids from public.questions q where q.id = any (v_ids);
  end if;

  perform public._consume(uid, 'export', 1, jsonb_build_object('n', array_length(v_ids, 1), 'source', v_source));
  insert into public.exports (user_id, title, config, question_ids, with_answers)
  values (uid, left(v_title, 80), p - 'title', v_ids, coalesce((p ->> 'with_answers')::boolean, true))
  returning id into v_id;
  return v_id;
end $$;

-- Desafio do dia: a língua estrangeira do sorteio é o inglês (as outras entram no simulado, que pergunta).
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
     where public.q_listed(q.is_active, q.has_solution) and q.kind = 'objective' and coalesce(q.language, 'ingles') = 'ingles'
       and (v_boards is null or b.code = any (v_boards))
       -- não repete o que respondeu nos últimos 30 dias
       and not exists (select 1 from public.attempt_answers aa join public.exam_attempts a on a.id = aa.attempt_id
                        where a.user_id = uid and aa.question_id = q.id and aa.choice is not null
                          and coalesce(aa.answered_at, aa.updated_at) > now() - interval '30 days');
  if (select count(*) from _pool) < 7 then -- banco pequeno: libera repetição
    drop table _pool;
    create temp table _pool on commit drop as
      select q.id, q.topic, q.irt_b from public.questions q join public.exam_boards b on b.id = q.board_id
       where public.q_listed(q.is_active, q.has_solution) and q.kind = 'objective' and coalesce(q.language, 'ingles') = 'ingles'
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
