-- E1 (plano de engajamento): assunto de cada questão + dados oficiais do INEP (habilidade da Matriz e TRI).
-- Base da triagem, do plano de estudos e do desafio diário: o domínio por assunto sai daqui.

-- "if not exists": pode rodar de novo sem erro (ex.: aplicada pela metade no SQL Editor)
alter table public.questions
  add column if not exists skill smallint check (skill between 1 and 30),       -- habilidade da Matriz de Referência (H1–H30 da área)
  add column if not exists irt_a real check (irt_a > 0),                          -- TRI 3PL: discriminação
  add column if not exists irt_b real,                                            --          dificuldade (escala ENEM: nota = 500 + 100·θ)
  add column if not exists irt_c real check (irt_c between 0 and 1),              --          acerto ao acaso
  add column if not exists inep_item int;                                         -- CO_ITEM nos microdados (rastreabilidade)

-- Aplica assunto (data/taxonomia) e dados do INEP (data/inep) a uma prova.
-- p: { board, year, items: [{ number, language?, subject?, topic?, skill?, irt?: {a,b,c}, item? }] }
-- Campos ausentes não apagam o que já existe. Retorna { updated, missing }.
create or replace function public.apply_taxonomy(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_board uuid; v_year int; it jsonb; v_qid uuid; n_upd int := 0; missing jsonb := '[]'::jsonb;
begin
  if not (public.is_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select id into v_board from public.exam_boards where code = p ->> 'board';
  if v_board is null then raise exception 'vestibular desconhecido: %', p ->> 'board'; end if;
  v_year := (p ->> 'year')::int;

  for it in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) loop
    select q.id into v_qid from public.questions q
     where q.board_id = v_board and q.year = v_year and q.exam_id is not null
       and q.number = (it ->> 'number')::int
       and coalesce(q.language, '') = coalesce(it ->> 'language', '')
     limit 1;
    if v_qid is null then
      missing := missing || to_jsonb(concat(it ->> 'number', nullif(concat(' ', it ->> 'language'), ' ')));
      continue;
    end if;
    update public.questions set
      subject = coalesce(nullif(it ->> 'subject', ''), subject),
      topic = coalesce(nullif(it ->> 'topic', ''), topic),
      skill = coalesce((it ->> 'skill')::smallint, skill),
      irt_a = coalesce((it #>> '{irt,a}')::real, irt_a),
      irt_b = coalesce((it #>> '{irt,b}')::real, irt_b),
      irt_c = coalesce((it #>> '{irt,c}')::real, irt_c),
      inep_item = coalesce((it ->> 'item')::int, inep_item)
    where id = v_qid;
    n_upd := n_upd + 1;
  end loop;
  return jsonb_build_object('updated', n_upd, 'missing', missing);
end $$;
revoke execute on function public.apply_taxonomy(jsonb) from public, anon;
grant execute on function public.apply_taxonomy(jsonb) to authenticated;

-- Respostas corrigidas do aluno com o que o motor de domínio precisa (assunto + TRI), mais recentes primeiro.
-- Mesma regra de "resposta que conta" do student_stats: tentativa encerrada, ou treino/revisão (gabarito na hora).
create or replace function public.answer_facts(p_user uuid default null, p_board text default null, p_limit int default 5000)
returns table (question_id uuid, board text, area text, subject text, topic text, skill smallint,
               irt_a real, irt_b real, irt_c real, ok boolean, answered_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_user uuid := coalesce(p_user, auth.uid());
begin
  if v_user is null or not (v_user = auth.uid() or public.is_admin()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return query
    select distinct on (aa.question_id)
           aa.question_id, b.code, q.area, q.subject, q.topic, q.skill, q.irt_a, q.irt_b, q.irt_c,
           aa.choice = k.correct_label, coalesce(aa.answered_at, aa.updated_at)
      from public.attempt_answers aa
      join public.exam_attempts a on a.id = aa.attempt_id
      join public.questions q on q.id = aa.question_id and q.kind = 'objective'
      join public.exam_boards b on b.id = q.board_id
      join public.answer_keys k on k.question_id = aa.question_id and k.correct_label is not null
     where a.user_id = v_user and aa.choice is not null
       and (a.status in ('finished', 'expired') or a.mode in ('treino', 'revisao'))
       and (p_board is null or b.code = p_board)
     -- a mesma questão respondida de novo: vale a resposta mais recente
     order by aa.question_id, coalesce(aa.answered_at, aa.updated_at) desc
     limit greatest(1, least(p_limit, 20000));
end $$;
revoke execute on function public.answer_facts(uuid, text, int) from public, anon;
grant execute on function public.answer_facts(uuid, text, int) to authenticated;
