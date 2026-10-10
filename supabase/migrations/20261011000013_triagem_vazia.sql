-- Correção da triagem: sem questões calibradas (TRI) no banco — ex.: seed:taxonomia ainda não rodado — a triagem
-- era criada e encerrada na hora, vazia ("0/0"), e gastava a cota do mês. Agora:
--   • triagem_start recusa com 'triagem_unavailable' ANTES de criar/cobrar;
--   • encerrar sem nenhuma resposta descarta a triagem e devolve a cota;
--   • triagens vazias já criadas são apagadas e a cota devolvida.
-- Pode rodar de novo sem erro.

-- Há questões calibradas suficientes (8 por área, do ENEM, liberadas para o aluno)?
create or replace function public._triagem_available(p_per_area int default 8)
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) = 4 from (
    select q.area from public.questions q join public.exam_boards b on b.id = q.board_id and b.code = 'ENEM'
     where q.kind = 'objective' and q.language is null and q.irt_b is not null
       and q.area in ('linguagens', 'humanas', 'natureza', 'matematica')
       and public.q_listed(q.is_active, q.has_solution)
       and exists (select 1 from public.answer_keys k where k.question_id = q.id and k.correct_label is not null)
     group by q.area having count(*) >= p_per_area
  ) a
$$;

create or replace function public.triagem_start()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null or not public.is_active_user() then raise exception 'permission denied' using errcode = '42501'; end if;
  select id into v_id from public.exam_attempts where user_id = v_user and mode = 'triagem' and status = 'in_progress'
   order by started_at desc limit 1;
  if v_id is not null then return v_id; end if;
  if not public._triagem_available() then raise exception 'triagem_unavailable'; end if;

  insert into public.exam_attempts (user_id, mode, title, config)
  values (v_user, 'triagem', 'Triagem de conhecimentos',
          jsonb_build_object('board', 'ENEM', 'per_area', 8, 'areas', jsonb_build_array('linguagens', 'humanas', 'natureza', 'matematica')))
  returning id into v_id;
  -- cobra depois de criar, com o id: se a cota acabou, a transação inteira volta
  perform public._consume(v_user, 'triagem', 1, jsonb_build_object('attempt', v_id));
  if public._triagem_next(v_id) is null then raise exception 'triagem_unavailable'; end if;
  return v_id;
end $$;

-- Encerrar: sem nenhuma resposta, descarta e devolve a cota.
create or replace function public.triagem_finish(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts; n int;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid() and mode = 'triagem' for update;
  if not found then raise exception 'not_found'; end if;
  if a.status = 'in_progress' then
    select count(*) into n from public.attempt_answers where attempt_id = a.id and answered_at is not null;
    if n = 0 then
      delete from public.usage_events where id = (
        select id from public.usage_events where user_id = a.user_id and feature = 'triagem'
           and (meta ->> 'attempt' = a.id::text or (meta = '{}'::jsonb and at >= a.started_at - interval '1 minute'))
         order by at desc limit 1);
      delete from public.exam_attempts where id = a.id;
      return jsonb_build_object('id', a.id, 'status', 'discarded', 'answered', 0);
    end if;
    -- a questão anexada e não respondida sai da tentativa (não conta como erro)
    delete from public.attempt_questions aq where aq.attempt_id = a.id
       and not exists (select 1 from public.attempt_answers aa where aa.attempt_id = a.id and aa.question_id = aq.question_id);
    perform public._finalize_attempt(a.id, 'finished');
  end if;
  return public.triagem_state(p_attempt);
end $$;

-- Limpeza: triagens já criadas sem nenhuma questão (o caso "0/0") somem e a cota volta.
do $$
declare r record;
begin
  for r in select a.id, a.user_id, a.started_at from public.exam_attempts a
            where a.mode = 'triagem' and not exists (select 1 from public.attempt_questions aq where aq.attempt_id = a.id)
  loop
    delete from public.usage_events where id = (
      select id from public.usage_events where user_id = r.user_id and feature = 'triagem'
         and (meta ->> 'attempt' = r.id::text or (meta = '{}'::jsonb and at between r.started_at - interval '1 minute' and r.started_at + interval '1 minute'))
       order by at desc limit 1);
    delete from public.exam_attempts where id = r.id;
  end loop;
end $$;

revoke execute on function public._triagem_available(int) from public, anon;
grant execute on function public._triagem_available(int) to authenticated;
