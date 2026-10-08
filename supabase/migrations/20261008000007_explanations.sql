-- Fase 7: resoluções comentadas em lote.
-- 1) import_bundle deixa de apagar resolução/espelho quando o arquivo reimportado não traz esses campos
--    (o seed do ENEM não tem resoluções; rodar de novo não pode apagar o que já foi escrito).
-- 2) apply_explanations: grava resoluções por ano+número+idioma, só quando o gabarito informado bate com o do banco.

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
      if v_exam is not null and nullif(q ->> 'number', '') is not null then
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

-- p = {board, year, items:[{number, language?, correct, explanation_md}]}
-- Questões de prova (exam_id não nulo) do vestibular+ano. Pula (e lista) quando a questão não existe,
-- não tem gabarito ou o gabarito diverge do informado — resolução errada é pior que nenhuma.
create or replace function public.apply_explanations(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_board uuid; v_year int; it jsonb; v_qid uuid; v_correct text;
  n_upd int := 0; missing jsonb := '[]'::jsonb; mismatch jsonb := '[]'::jsonb;
begin
  if not (public.is_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select id into v_board from public.exam_boards where code = p ->> 'board';
  if v_board is null then raise exception 'vestibular desconhecido: %', p ->> 'board'; end if;
  v_year := (p ->> 'year')::int;

  for it in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) loop
    if nullif(it ->> 'explanation_md', '') is null then continue; end if;
    select q.id, k.correct_label into v_qid, v_correct
      from public.questions q left join public.answer_keys k on k.question_id = q.id
     where q.board_id = v_board and q.year = v_year and q.exam_id is not null
       and q.number = (it ->> 'number')::int
       and coalesce(q.language, '') = coalesce(it ->> 'language', '')
     limit 1;
    if v_qid is null or v_correct is null then
      missing := missing || to_jsonb(concat(it ->> 'number', nullif(concat(' ', it ->> 'language'), ' ')));
    elsif v_correct is distinct from (it ->> 'correct') then
      mismatch := mismatch || to_jsonb(concat(it ->> 'number', ' (banco ', v_correct, ', arquivo ', it ->> 'correct', ')'));
    else
      update public.answer_keys set explanation_md = it ->> 'explanation_md' where question_id = v_qid;
      n_upd := n_upd + 1;
    end if;
  end loop;
  return jsonb_build_object('updated', n_upd, 'missing', missing, 'mismatch', mismatch);
end $$;

revoke execute on function public.apply_explanations(jsonb) from public, anon;
