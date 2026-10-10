-- Exportar listas de questões em PDF (página de impressão) e EPUB (Kindle, Apple Livros, Google Play Livros).
-- Cada exportação consome 1 do recurso 'export' do plano e tem no máximo 'export_size' questões.
-- Baixar de novo uma lista já criada não consome nada. Pode rodar de novo sem erro.

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  config jsonb not null default '{}'::jsonb,
  question_ids uuid[] not null,
  with_answers boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists exports_user on public.exports (user_id, created_at desc);
alter table public.exports enable row level security;
drop policy if exists exports_own_select on public.exports;
create policy exports_own_select on public.exports for select to authenticated using (user_id = auth.uid());
drop policy if exists exports_own_delete on public.exports;
create policy exports_own_delete on public.exports for delete to authenticated using (user_id = auth.uid());

-- Cria a lista. p: { source: 'banco'|'erros'|'tentativa', attempt_id?, only_wrong?, board?, areas?, subjects?, topics?,
--                    year_from?, year_to?, language?, count?, order: 'assunto'|'aleatoria', with_answers?, title? }
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
  if v_lang not in ('ingles', 'espanhol') then raise exception 'idioma inválido'; end if;

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

-- Conteúdo completo da lista (enunciado, alternativas e, se pedido, gabarito e resolução). Só o dono.
create or replace function public.export_content(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', e.id, 'title', e.title, 'created_at', e.created_at, 'with_answers', e.with_answers, 'config', e.config,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'n', o.ord, 'board', b.code, 'year', q.year, 'number', q.number, 'area', q.area,
        'subject', q.subject, 'topic', q.topic, 'statement_md', q.statement_md, 'images', q.images,
        'alternatives', (select coalesce(jsonb_agg(jsonb_build_object('label', a.label, 'text_md', a.text_md, 'image_url', a.image_url) order by a.label), '[]'::jsonb)
                           from public.alternatives a where a.question_id = q.id),
        'correct_label', case when e.with_answers then k.correct_label end,
        'explanation_md', case when e.with_answers then k.explanation_md end
      ) order by o.ord)
      from unnest(e.question_ids) with ordinality o(qid, ord)
      join public.questions q on q.id = o.qid
      join public.exam_boards b on b.id = q.board_id
      left join public.answer_keys k on k.question_id = q.id), '[]'::jsonb))
  from public.exports e
  where e.id = p_id and e.user_id = auth.uid() and public.is_active_user();
$$;

-- Cartão-resposta: fez a lista no papel? Lança as respostas no app (vira um simulado sem cronômetro).
create or replace function public.export_to_attempt(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare e public.exports; v_id uuid;
begin
  select * into e from public.exports where id = p_id and user_id = auth.uid();
  if not found or not public.is_active_user() then raise exception 'lista não encontrada'; end if;
  insert into public.exam_attempts (user_id, mode, title, config)
  values (auth.uid(), 'custom', left('Cartão-resposta: ' || e.title, 80), jsonb_build_object('export_id', e.id, 'picked', array_length(e.question_ids, 1)))
  returning id into v_id;
  insert into public.attempt_questions (attempt_id, position, question_id, section, weight)
    select v_id, (o.ord - 1)::int, o.qid, null, 1 from unnest(e.question_ids) with ordinality o(qid, ord)
    where exists (select 1 from public.questions q where q.id = o.qid);
  return v_id;
end $$;

revoke execute on function public.export_create(jsonb), public.export_content(uuid), public.export_to_attempt(uuid) from public, anon;
grant execute on function public.export_create(jsonb), public.export_content(uuid), public.export_to_attempt(uuid) to authenticated;
