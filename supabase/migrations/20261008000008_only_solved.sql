-- Fase 7b: só mostrar aos alunos questões com resolução + correções de questões vindas do PDF oficial.
--
-- has_solution: objetiva com resolução comentada (answer_keys.explanation_md) ou discursiva com espelho
-- (official_mirror_md). Mantida por trigger. A configuração only_solved_questions (padrão: ligada) faz o aluno
-- ver/sortear só questões com solução; o admin continua vendo tudo. Questões de tentativas antigas do próprio
-- aluno continuam visíveis (para o histórico não quebrar).

alter table public.questions add column has_solution boolean not null default false;

create or replace function public.sync_has_solution() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_qid uuid := coalesce(new.question_id, old.question_id);
begin
  update public.questions q set has_solution = coalesce((
    select case when q.kind = 'discursive' then k.official_mirror_md is not null and k.official_mirror_md <> ''
                else k.explanation_md is not null and k.explanation_md <> '' end
    from public.answer_keys k where k.question_id = q.id), false)
  where q.id = v_qid;
  return null;
end $$;
revoke execute on function public.sync_has_solution() from public, anon, authenticated;

create trigger answer_keys_has_solution after insert or update or delete on public.answer_keys
  for each row execute function public.sync_has_solution();

update public.questions q set has_solution = coalesce((
  select case when q.kind = 'discursive' then k.official_mirror_md is not null and k.official_mirror_md <> ''
              else k.explanation_md is not null and k.explanation_md <> '' end
  from public.answer_keys k where k.question_id = q.id), false);

insert into public.settings (key, value, description) values
  ('only_solved_questions', 'true', 'Alunos só veem e sorteiam questões com resolução comentada (ou espelho, nas discursivas)')
on conflict (key) do nothing;

create or replace function public.only_solved_questions() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true'::jsonb from public.settings where key = 'only_solved_questions'), true);
$$;

-- questão disponível para o aluno (listagem, busca, sorteio)
create or replace function public.q_listed(p_active boolean, p_solved boolean) returns boolean
language sql stable set search_path = public as $$
  select p_active and (p_solved or not public.only_solved_questions());
$$;
grant execute on function public.only_solved_questions(), public.q_listed(boolean, boolean) to authenticated;

drop policy questions_select on public.questions;
create policy questions_select on public.questions for select to authenticated
  using (public.is_active_user() and (
    public.is_admin()
    or public.q_listed(is_active, has_solution)
    or exists (select 1 from public.attempt_questions aq join public.exam_attempts a on a.id = aq.attempt_id
               where aq.question_id = questions.id and a.user_id = auth.uid())));

-- vínculo prova↔questão some junto com a questão (contagem de questões na lista de simulados)
drop policy exam_questions_select on public.exam_questions;
create policy exam_questions_select on public.exam_questions for select to authenticated
  using (public.is_active_user() and exists (select 1 from public.questions q where q.id = question_id));

-- start_attempt e bank_facets: mesmo corpo, trocando "q.is_active" por q_listed(...)
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

create or replace function public.bank_facets()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'subjects', coalesce((select jsonb_agg(jsonb_build_object('name', subject, 'board', board, 'n', n) order by board, subject)
       from (select q.subject, b.code as board, count(*)::int n from public.questions q join public.exam_boards b on b.id = q.board_id
             where q.subject is not null and public.q_listed(q.is_active, q.has_solution) group by 1, 2) s), '[]'::jsonb),
    'topics', coalesce((select jsonb_agg(jsonb_build_object('name', topic, 'subject', subject, 'board', board, 'n', n) order by board, subject, topic)
       from (select q.topic, q.subject, b.code as board, count(*)::int n from public.questions q join public.exam_boards b on b.id = q.board_id
             where q.topic is not null and public.q_listed(q.is_active, q.has_solution) group by 1, 2, 3) t), '[]'::jsonb),
    'areas', coalesce((select jsonb_agg(jsonb_build_object('name', area, 'board', board, 'n', n) order by board, area)
       from (select q.area, b.code as board, count(*)::int n from public.questions q join public.exam_boards b on b.id = q.board_id
             where q.area is not null and public.q_listed(q.is_active, q.has_solution) group by 1, 2) a), '[]'::jsonb),
    'works', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title)) from public.literary_works w), '[]'::jsonb)
  );
$$;

-- apply_explanations ganha correções vindas do PDF oficial, por item:
--   statement_md / alternatives  → substitui enunciado e alternativas (texto conferido com o caderno do INEP)
--   override_correct: true       → o gabarito do arquivo é o oficial e substitui o do banco (fonte errada)
--   annulled: true               → questão anulada pelo INEP: desativa e apaga a resolução
create or replace function public.apply_explanations(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_board uuid; v_year int; it jsonb; a jsonb; v_qid uuid; v_correct text;
  n_upd int := 0; n_fix int := 0; n_ann int := 0; missing jsonb := '[]'::jsonb; mismatch jsonb := '[]'::jsonb;
begin
  if not (public.is_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select id into v_board from public.exam_boards where code = p ->> 'board';
  if v_board is null then raise exception 'vestibular desconhecido: %', p ->> 'board'; end if;
  v_year := (p ->> 'year')::int;

  for it in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) loop
    v_qid := null; v_correct := null;
    select q.id, k.correct_label into v_qid, v_correct
      from public.questions q left join public.answer_keys k on k.question_id = q.id
     where q.board_id = v_board and q.year = v_year and q.exam_id is not null
       and q.number = (it ->> 'number')::int
       and coalesce(q.language, '') = coalesce(it ->> 'language', '')
     limit 1;
    if v_qid is null then
      missing := missing || to_jsonb(concat(it ->> 'number', nullif(concat(' ', it ->> 'language'), ' ')));
      continue;
    end if;

    if coalesce((it ->> 'annulled')::boolean, false) then
      update public.questions set is_active = false where id = v_qid;
      update public.answer_keys set explanation_md = null where question_id = v_qid;
      n_ann := n_ann + 1;
      continue;
    end if;

    if nullif(it ->> 'statement_md', '') is not null then
      update public.questions set statement_md = it ->> 'statement_md' where id = v_qid;
    end if;
    if jsonb_typeof(it -> 'alternatives') = 'array' and jsonb_array_length(it -> 'alternatives') > 0 then
      delete from public.alternatives where question_id = v_qid;
      for a in select * from jsonb_array_elements(it -> 'alternatives') loop
        insert into public.alternatives (question_id, label, text_md, image_url)
        values (v_qid, a ->> 'label', coalesce(a ->> 'text_md', ''), nullif(a ->> 'image_url', ''));
      end loop;
    end if;
    if coalesce((it ->> 'override_correct')::boolean, false) and nullif(it ->> 'correct', '') is not null then
      insert into public.answer_keys (question_id, correct_label) values (v_qid, it ->> 'correct')
      on conflict (question_id) do update set correct_label = excluded.correct_label;
      v_correct := it ->> 'correct';
      n_fix := n_fix + 1;
    elsif nullif(it ->> 'statement_md', '') is not null or jsonb_typeof(it -> 'alternatives') = 'array' then
      n_fix := n_fix + 1;
    end if;

    if nullif(it ->> 'explanation_md', '') is null then continue; end if;
    if v_correct is null then
      missing := missing || to_jsonb(concat(it ->> 'number', nullif(concat(' ', it ->> 'language'), ' ')));
    elsif v_correct is distinct from (it ->> 'correct') then
      mismatch := mismatch || to_jsonb(concat(it ->> 'number', ' (banco ', v_correct, ', arquivo ', it ->> 'correct', ')'));
    else
      update public.answer_keys set explanation_md = it ->> 'explanation_md' where question_id = v_qid;
      update public.questions set is_active = true where id = v_qid;
      n_upd := n_upd + 1;
    end if;
  end loop;
  return jsonb_build_object('updated', n_upd, 'fixed', n_fix, 'annulled', n_ann, 'missing', missing, 'mismatch', mismatch);
end $$;

revoke execute on function public.apply_explanations(jsonb) from public, anon;
