-- E2 (plano de engajamento): triagem adaptativa de conhecimentos.
--
-- É uma tentativa (exam_attempts) com mode = 'triagem': assim as respostas entram no Desempenho, no domínio por
-- assunto (answer_facts) e no caderno de erros como qualquer outra. A diferença é que as questões NÃO são sorteadas de
-- uma vez: o servidor escolhe a próxima a cada resposta (TRI, com os parâmetros oficiais do INEP), alternando as 4 áreas
-- do ENEM. O aluno só escreve pela RPC triagem_answer; o gabarito só aparece no fim (policy answer_keys_student).

alter table public.exam_attempts drop constraint exam_attempts_mode_check;
alter table public.exam_attempts add constraint exam_attempts_mode_check
  check (mode in ('simulado', 'custom', 'treino', 'revisao', 'triagem'));

alter table public.plan_limits drop constraint plan_limits_feature_check;
alter table public.plan_limits add constraint plan_limits_feature_check check (feature in
  ('simulado', 'essay_ai', 'transcribe', 'tutor_msg', 'export', 'export_size', 'study_plan', 'triagem', 'triagem_report'));

-- limites: quantas triagens por mês e se o relatório detalhado (por assunto) está liberado
insert into public.plan_limits (plan_code, feature, period, quota) values
  ('free', 'triagem', 'month', 1), ('estudante', 'triagem', 'month', 2), ('pro', 'triagem', 'month', null), ('familia', 'triagem', 'month', null),
  ('free', 'triagem_report', 'none', 0), ('estudante', 'triagem_report', 'none', null), ('pro', 'triagem_report', 'none', null), ('familia', 'triagem_report', 'none', null);

-- As respostas da triagem só mudam pela RPC (nada de sync_attempt mexendo no caminho adaptativo).
create or replace function public.trg_triagem_answers_guard()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('vestibularr.triagem', true), '') <> 'on'
     and exists (select 1 from public.exam_attempts a where a.id = coalesce(new.attempt_id, old.attempt_id) and a.mode = 'triagem') then
    raise exception 'triagem_readonly';
  end if;
  return coalesce(new, old);
end $$;
create trigger attempt_answers_triagem_guard before insert or update or delete on public.attempt_answers
  for each row execute function public.trg_triagem_answers_guard();

-- θ (EAP, grade −4..4, priori N(0,1)) de uma área com as respostas desta triagem. Em branco ("não sei") = erro.
create or replace function public._triagem_theta(p_attempt uuid, p_area text)
returns real language sql stable set search_path = public as $$
  with r as (
    select q.irt_a a, q.irt_b b, q.irt_c c, (aa.choice is not null and aa.choice = k.correct_label) ok
      from public.attempt_answers aa
      join public.questions q on q.id = aa.question_id and q.area = p_area and q.irt_b is not null
      join public.answer_keys k on k.question_id = q.id
     where aa.attempt_id = p_attempt and aa.answered_at is not null
  ), g as (
    select i / 10.0 as t from generate_series(-40, 40) i
  ), ll as (
    select g.t, -0.5 * g.t * g.t + coalesce(sum(
      case when r.ok then ln(greatest(r.c + (1 - r.c) / (1 + exp(-r.a * (g.t - r.b))), 1e-9))
           else ln(greatest(1 - (r.c + (1 - r.c) / (1 + exp(-r.a * (g.t - r.b)))), 1e-9)) end), 0) as l
      from g left join r on true
     group by g.t
  )
  select (sum(t * exp(l - m)) / sum(exp(l - m)))::real from ll, (select max(l) m from ll) mx
$$;

-- Escolhe e anexa a próxima questão (ou encerra). Devolve a posição anexada ou null se acabou.
create or replace function public._triagem_next(p_attempt uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  a public.exam_attempts; v_areas text[]; v_per int; n int; v_area text; v_theta real; v_qid uuid;
begin
  select * into a from public.exam_attempts where id = p_attempt;
  v_areas := array(select jsonb_array_elements_text(a.config -> 'areas'));
  v_per := (a.config ->> 'per_area')::int;
  select count(*) into n from public.attempt_questions where attempt_id = p_attempt;
  if n >= v_per * array_length(v_areas, 1) then
    perform public._finalize_attempt(p_attempt, 'finished');
    return null;
  end if;
  v_area := v_areas[(n % array_length(v_areas, 1)) + 1];
  v_theta := public._triagem_theta(p_attempt, v_area);

  -- item mais informativo ≈ dificuldade perto do θ atual; sorteia entre os 6 mais próximos para variar.
  -- Prefere questões que o aluno nunca viu; se acabarem, aceita repetidas (fora desta triagem).
  select id into v_qid from (
    select q.id, abs(q.irt_b - v_theta) dist,
           exists (select 1 from public.attempt_questions aq join public.exam_attempts x on x.id = aq.attempt_id
                    where aq.question_id = q.id and x.user_id = a.user_id) seen
      from public.questions q join public.exam_boards b on b.id = q.board_id and b.code = 'ENEM'
     where q.area = v_area and q.kind = 'objective' and q.language is null and q.irt_b is not null
       and public.q_listed(q.is_active, q.has_solution)
       and exists (select 1 from public.answer_keys k where k.question_id = q.id and k.correct_label is not null)
       and not exists (select 1 from public.attempt_questions aq where aq.attempt_id = p_attempt and aq.question_id = q.id)
     order by seen, dist
     limit 6
  ) c order by seen, random() limit 1;

  if v_qid is null then
    -- banco sem questões calibradas para esta área: encerra com o que tem
    perform public._finalize_attempt(p_attempt, 'finished');
    return null;
  end if;
  insert into public.attempt_questions (attempt_id, position, question_id, section) values (p_attempt, n, v_qid, v_area);
  update public.exam_attempts set current_index = n where id = p_attempt;
  return n;
end $$;

-- Estado para a tela: posição atual, total e a questão a responder (sem gabarito).
create or replace function public.triagem_state(p_attempt uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a public.exam_attempts; v_q uuid; v_pos int; v_answered int; v_total int;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid() and mode = 'triagem';
  if not found then raise exception 'not_found'; end if;
  v_total := (a.config ->> 'per_area')::int * jsonb_array_length(a.config -> 'areas');
  select count(*) into v_answered from public.attempt_answers where attempt_id = a.id and answered_at is not null;
  select aq.question_id, aq.position into v_q, v_pos from public.attempt_questions aq
   where aq.attempt_id = a.id
     and not exists (select 1 from public.attempt_answers aa where aa.attempt_id = a.id and aa.question_id = aq.question_id and aa.answered_at is not null)
   order by aq.position limit 1;
  return jsonb_build_object('id', a.id, 'status', a.status, 'answered', v_answered, 'total', v_total,
                            'question_id', v_q, 'position', v_pos, 'area', a.config -> 'areas' ->> (coalesce(v_pos, 0) % 4));
end $$;

-- Começa (ou retoma) a triagem. Consome a cota 'triagem' só ao criar uma nova.
create or replace function public.triagem_start()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null or not public.is_active_user() then raise exception 'permission denied' using errcode = '42501'; end if;
  select id into v_id from public.exam_attempts where user_id = v_user and mode = 'triagem' and status = 'in_progress'
   order by started_at desc limit 1;
  if v_id is not null then return v_id; end if;

  perform public._consume(v_user, 'triagem', 1, '{}'::jsonb);
  insert into public.exam_attempts (user_id, mode, title, config)
  values (v_user, 'triagem', 'Triagem de conhecimentos',
          jsonb_build_object('board', 'ENEM', 'per_area', 8, 'areas', jsonb_build_array('linguagens', 'humanas', 'natureza', 'matematica')))
  returning id into v_id;
  perform public._triagem_next(v_id);
  return v_id;
end $$;

-- Responde a questão atual (p_choice null = "não sei") e já prepara a próxima.
create or replace function public.triagem_answer(p_attempt uuid, p_question uuid, p_choice text, p_ms bigint default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts; st jsonb;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid() and mode = 'triagem' for update;
  if not found then raise exception 'not_found'; end if;
  if a.status <> 'in_progress' then raise exception 'triagem_finished'; end if;
  if p_choice is not null and p_choice not in ('A', 'B', 'C', 'D', 'E') then raise exception 'choice inválida'; end if;
  st := public.triagem_state(p_attempt);
  if (st ->> 'question_id') is distinct from p_question::text then raise exception 'not_current'; end if;

  perform set_config('vestibularr.triagem', 'on', true);
  insert into public.attempt_answers (attempt_id, question_id, choice, time_spent_ms, answered_at)
  values (p_attempt, p_question, p_choice, greatest(0, least(coalesce(p_ms, 0), 3600000)), now());
  perform set_config('vestibularr.triagem', 'off', true);

  perform public._triagem_next(p_attempt);
  return public.triagem_state(p_attempt);
end $$;

-- Encerra antes do fim (o relatório usa o que foi respondido).
create or replace function public.triagem_finish(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid() and mode = 'triagem' for update;
  if not found then raise exception 'not_found'; end if;
  if a.status = 'in_progress' then
    -- a questão anexada e não respondida sai da tentativa (não conta como erro)
    delete from public.attempt_questions aq where aq.attempt_id = a.id
       and not exists (select 1 from public.attempt_answers aa where aa.attempt_id = a.id and aa.question_id = aq.question_id);
    perform public._finalize_attempt(a.id, 'finished');
  end if;
  return public.triagem_state(p_attempt);
end $$;

revoke execute on function public._triagem_theta(uuid, text), public._triagem_next(uuid) from public, anon, authenticated;
revoke execute on function public.triagem_state(uuid), public.triagem_start(), public.triagem_answer(uuid, uuid, text, bigint),
  public.triagem_finish(uuid) from public, anon;
grant execute on function public.triagem_state(uuid), public.triagem_start(), public.triagem_answer(uuid, uuid, text, bigint),
  public.triagem_finish(uuid) to authenticated;
