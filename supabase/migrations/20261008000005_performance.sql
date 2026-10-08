-- Fase 5: desempenho, metas, gamificação, sessões de estudo, logs e cursos (nota ponderada).

-- ---------------------------------------------------------------- cursos e notas de corte
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  institution text not null,
  via text not null check (via in ('ufpr', 'sisu')),
  name text not null,
  campus text,
  degree text,
  shift text,
  -- UFPR 2027: até 2 disciplinas com peso (Anexo XX). Sisu: pesos por área + redação.
  ufpr_specific jsonb not null default '[]'::jsonb,
  sisu_weights jsonb,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.course_cutoffs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  year int not null,
  modality text not null default 'ampla',
  cutoff numeric not null check (cutoff >= 0),
  source text,
  unique (course_id, year, modality)
);
alter table public.courses enable row level security;
alter table public.course_cutoffs enable row level security;
create policy courses_select on public.courses for select to authenticated using (public.is_active_user());
create policy courses_admin on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy cutoffs_select on public.course_cutoffs for select to authenticated using (public.is_active_user());
create policy cutoffs_admin on public.course_cutoffs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Cursos do Vestibular UFPR 2027 com disciplinas de peso diferenciado (Edital 50/2026-NC/PROGRAP, Anexo XX).
-- Extraídos do PDF e conferidos contra a regra do item 6.7.3.1 (≤5 questões → 3; 6–10 → 2,5; ≥11 → 2).
-- Cursos fora do Anexo XX têm peso 1 em tudo: o admin pode cadastrá-los sem disciplinas específicas.
insert into public.courses (institution, via, campus, name, degree, shift, ufpr_specific)
select 'UFPR', 'ufpr', campus, name, degree, shift, specific from (values
  ('Curitiba', 'Administração', 'Bacharelado', 'M', '[{"subject": "Língua Portuguesa", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Administração', 'Bacharelado', 'N', '[{"subject": "Língua Portuguesa", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Análise e Desenvolvimento de Sistemas', 'Tecnológico', 'N', '[{"subject": "Língua Portuguesa", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Análise e Desenvolvimento de Sistemas', 'Tecnológico', 'V', '[{"subject": "Língua Portuguesa", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Arquitetura e Urbanismo', 'Bacharelado', 'I (M+V)', '[{"subject": "História", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Artes Visuais', 'Bacharelado', 'M', '[{"subject": "História", "weight": 2.0}, {"subject": "Língua Portuguesa", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Artes Visuais', 'Licenciatura', 'M', '[{"subject": "História", "weight": 2.0}, {"subject": "Língua Portuguesa", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Ciência da Computação', 'Bacharelado', 'I (V+N)', '[{"subject": "Matemática", "weight": 2.5}]'::jsonb),
  ('Curitiba', 'Ciências Econômicas', 'Bacharelado', 'M', '[{"subject": "História", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Ciências Econômicas', 'Bacharelado', 'N', '[{"subject": "História", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Ciências Sociais', 'ABI', 'M', '[{"subject": "Língua Portuguesa", "weight": 2.0}, {"subject": "Sociologia", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Comunicação Institucional', 'Tecnológico', 'M', '[{"subject": "Literatura Brasileira", "weight": 2.0}, {"subject": "Língua Portuguesa", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Direito', 'Bacharelado', 'M', '[{"subject": "Filosofia", "weight": 2.0}, {"subject": "Língua Portuguesa", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Direito', 'Bacharelado', 'N', '[{"subject": "Filosofia", "weight": 2.0}, {"subject": "Língua Portuguesa", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Enfermagem', 'Bacharelado', 'I (M+V)', '[{"subject": "Biologia", "weight": 2.0}, {"subject": "Química", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Engenharia Ambiental', 'Bacharelado', 'I (M+V)', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Engenharia Civil', 'Bacharelado', 'I (M+V)', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Engenharia Elétrica', 'Bacharelado', 'I (M+V)', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Engenharia Elétrica', 'Bacharelado', 'N', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Engenharia Industrial Madeireira', 'Bacharelado', 'I (M+V)', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Engenharia Industrial Madeireira', 'Bacharelado', 'N', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Engenharia Mecânica', 'Bacharelado', 'I (M+V)', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Engenharia Mecânica', 'Bacharelado', 'N', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Engenharia Química', 'Bacharelado', 'I (M+V)', '[{"subject": "Física", "weight": 2.0}, {"subject": "Química", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Engenharia de Bioprocessos e Biotecnologia', 'Bacharelado', 'I (M+V)', '[{"subject": "Matemática", "weight": 2.0}, {"subject": "Química", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Engenharia de Produção', 'Bacharelado', 'I (M+V)', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Farmácia', 'Bacharelado', 'I (M+V)', '[{"subject": "Biologia", "weight": 2.0}, {"subject": "Química", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Fisioterapia', 'Bacharelado', 'I (M+V)', '[{"subject": "Biologia", "weight": 2.0}, {"subject": "Química", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Física', 'Bacharelado', 'I (M+V)', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Física', 'Licenciatura', 'N', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Gestão da Informação', 'Bacharelado', 'M', '[{"subject": "Língua Portuguesa", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'História', 'Licenciatura', 'V', '[{"subject": "História", "weight": 2.0}, {"subject": "Língua Portuguesa", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'História Memória e Imagem', 'Bacharelado', 'N', '[{"subject": "História", "weight": 2.5}]'::jsonb),
  ('Curitiba', 'Informática Biomédica', 'Bacharelado', 'I (V+N)', '[{"subject": "Matemática", "weight": 2.5}]'::jsonb),
  ('Curitiba', 'Matemática', 'ABI', 'V', '[{"subject": "Matemática", "weight": 2.5}]'::jsonb),
  ('Curitiba', 'Matemática', 'Licenciatura', 'N', '[{"subject": "Matemática", "weight": 2.5}]'::jsonb),
  ('Curitiba', 'Matemática Industrial', 'Bacharelado', 'V', '[{"subject": "Matemática", "weight": 2.5}]'::jsonb),
  ('Curitiba', 'Medicina', 'Bacharelado', 'I (M+V)', '[{"subject": "Biologia", "weight": 2.0}, {"subject": "Língua Portuguesa", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Medicina Veterinária', 'Bacharelado', 'I (M+V)', '[{"subject": "Biologia", "weight": 2.0}, {"subject": "Química", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Odontologia', 'Bacharelado', 'I (M+V)', '[{"subject": "Biologia", "weight": 2.0}, {"subject": "Química", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Pedagogia', 'Licenciatura', 'M', '[{"subject": "História", "weight": 2.5}]'::jsonb),
  ('Curitiba', 'Pedagogia', 'Licenciatura', 'N', '[{"subject": "História", "weight": 2.5}]'::jsonb),
  ('Curitiba', 'Produção Cultural', 'Bacharelado', 'M', '[{"subject": "História", "weight": 2.0}, {"subject": "Língua Portuguesa", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Psicologia', 'Bacharelado', 'I (M+V)', '[{"subject": "Filosofia", "weight": 2.0}, {"subject": "História", "weight": 2.0}]'::jsonb),
  ('Curitiba', 'Zootecnia', 'Bacharelado', 'I (M+V)', '[{"subject": "Biologia", "weight": 2.0}, {"subject": "Química", "weight": 2.0}]'::jsonb),
  ('Jandaia do Sul', 'Agronomia', 'Bacharelado', 'I (M+V)', '[{"subject": "Biologia", "weight": 2.0}, {"subject": "Química", "weight": 2.0}]'::jsonb),
  ('Jandaia do Sul', 'Física Computacional', 'Bacharelado', 'I (M+V)', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Jandaia do Sul', 'Inteligência Artificial e Engenharia de Software', 'Bacharelado', 'I (M+V)', '[{"subject": "Matemática", "weight": 2.5}]'::jsonb),
  ('Jandaia do Sul', 'Matemática e Tecnologias Digitais', 'Licenciatura', 'V', '[{"subject": "Matemática", "weight": 2.5}]'::jsonb),
  ('Matinhos', 'Administração Pública', 'Bacharelado', 'N', '[{"subject": "Língua Portuguesa", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Matinhos', 'Ciências', 'Licenciatura', 'N', '[{"subject": "Biologia", "weight": 2.0}, {"subject": "Física", "weight": 2.0}]'::jsonb),
  ('Matinhos', 'Educação Física', 'Licenciatura', 'N', '[{"subject": "Biologia", "weight": 2.0}, {"subject": "Sociologia", "weight": 2.0}]'::jsonb),
  ('Matinhos', 'Geografia', 'Licenciatura', 'N', '[{"subject": "Geografia", "weight": 2.0}, {"subject": "História", "weight": 2.0}]'::jsonb),
  ('Palotina', 'Ciências Biológicas', 'Bacharelado', 'I (M+V)', '[{"subject": "Biologia", "weight": 2.0}, {"subject": "Química", "weight": 2.0}]'::jsonb),
  ('Palotina', 'Ciências Biológicas', 'Licenciatura', 'I (M+V)', '[{"subject": "Biologia", "weight": 2.0}, {"subject": "Química", "weight": 2.0}]'::jsonb),
  ('Palotina', 'Medicina Veterinária', 'Bacharelado', 'I (M+V)', '[{"subject": "Biologia", "weight": 2.5}]'::jsonb),
  ('Pontal do Paraná', 'Ciências Exatas (Física)', 'Licenciatura', 'N', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Pontal do Paraná', 'Ciências Exatas (Matemática)', 'Licenciatura', 'N', '[{"subject": "Matemática", "weight": 2.5}]'::jsonb),
  ('Pontal do Paraná', 'Ciências Exatas (Química)', 'Licenciatura', 'N', '[{"subject": "Química", "weight": 2.5}]'::jsonb),
  ('Pontal do Paraná', 'Engenharia Ambiental e Sanitária', 'Bacharelado', 'V', '[{"subject": "Geografia", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Pontal do Paraná', 'Engenharia Civil', 'Bacharelado', 'V', '[{"subject": "Física", "weight": 2.0}, {"subject": "Matemática", "weight": 2.0}]'::jsonb),
  ('Toledo', 'Medicina', 'Bacharelado', 'I (M+V)', '[{"subject": "Biologia", "weight": 2.0}, {"subject": "Química", "weight": 2.0}]'::jsonb)
) as v(campus, name, degree, shift, specific);

-- ---------------------------------------------------------------- alvos do aluno
alter table public.profiles add column target_courses uuid[] not null default '{}';
grant update (target_courses) on public.profiles to authenticated;

-- ---------------------------------------------------------------- metas
create table public.student_goals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('questions_day', 'questions_week', 'minutes_week', 'essays_week')),
  target int not null check (target between 1 and 5000),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.student_goals enable row level security;
create policy goals_own on public.student_goals for all to authenticated
  using (user_id = auth.uid() and public.is_active_user()) with check (user_id = auth.uid() and public.is_active_user());
create policy goals_admin on public.student_goals for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- tempo de estudo (heartbeat)
create table public.study_sessions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  seconds int not null default 0,
  pings int not null default 0,
  last_ping timestamptz,
  primary key (user_id, day)
);
alter table public.study_sessions enable row level security;
create policy sessions_select_own on public.study_sessions for select to authenticated using (user_id = auth.uid());
create policy sessions_select_admin on public.study_sessions for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- conquistas
create table public.achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, code)
);
alter table public.achievements enable row level security;
create policy achievements_select_own on public.achievements for select to authenticated using (user_id = auth.uid());
create policy achievements_select_admin on public.achievements for select to authenticated using (public.is_admin());

create index access_logs_user_path on public.access_logs (user_id, path, at desc);

-- ---------------------------------------------------------------- atividade (heartbeat + log de páginas)
-- Chamado pelo app a cada troca de página e a cada ~60 s com a aba visível.
-- Tempo conta no máximo 90 s por ping (aba esquecida aberta não infla o tempo). Log de página: no
-- máximo 1 registro por página a cada 10 min.
create or replace function public.ping_activity(p_path text default null, p_device text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'America/Sao_Paulo')::date; s public.study_sessions;
begin
  if uid is null or not public.is_active_user() then return; end if;
  select * into s from public.study_sessions where user_id = uid and day = today for update;
  if not found then
    insert into public.study_sessions (user_id, day, seconds, pings, last_ping) values (uid, today, 0, 1, now());
  else
    update public.study_sessions set
      seconds = seconds + case when last_ping is not null and now() - last_ping < interval '3 minutes'
                               then least(extract(epoch from now() - last_ping)::int, 90) else 0 end,
      pings = pings + 1, last_ping = now()
    where user_id = uid and day = today;
  end if;
  update public.profiles set last_seen_at = now() where id = uid;
  if p_path is not null and length(p_path) <= 200 and not exists (
    select 1 from public.access_logs where user_id = uid and path = p_path and at > now() - interval '10 minutes'
  ) then
    insert into public.access_logs (user_id, event, path, device) values (uid, 'page', p_path, left(p_device, 40));
  end if;
end $$;

-- ---------------------------------------------------------------- estatísticas do aluno
-- Fatos = respostas objetivas com gabarito em tentativas já corrigíveis (encerradas, ou treino/revisão).
-- Aluno vê só as próprias; admin vê de qualquer aluno. p_board: 'ENEM' | 'UFPR' | null (todos).
create or replace function public.student_stats(p_user uuid default null, p_board text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  tz text := 'America/Sao_Paulo';
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  week_start date := date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date;
  days date[];
  d date; streak int := 0; best int := 0; run int := 0; prev date;
  result jsonb;
begin
  if v_user is null or not (v_user = auth.uid() or public.is_admin()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  create temp table if not exists _facts (question_id uuid, ok boolean, area text, subject text, topic text, board text, ms bigint, day date) on commit drop;
  truncate _facts;
  insert into _facts
    select aa.question_id, aa.choice = k.correct_label, q.area, q.subject, q.topic, b.code, aa.time_spent_ms,
           (coalesce(aa.answered_at, aa.updated_at) at time zone tz)::date
    from public.attempt_answers aa
    join public.exam_attempts a on a.id = aa.attempt_id
    join public.questions q on q.id = aa.question_id and q.kind = 'objective'
    join public.exam_boards b on b.id = q.board_id
    join public.answer_keys k on k.question_id = aa.question_id and k.correct_label is not null
    where a.user_id = v_user and aa.choice is not null
      and (a.status in ('finished', 'expired') or a.mode in ('treino', 'revisao'))
      and (p_board is null or b.code = p_board);

  -- dias com estudo (respostas, redação escrita ou ≥ 60 s no app)
  select array_agg(x order by x) into days from (
    select day x from _facts
    union select (aa.updated_at at time zone tz)::date from public.attempt_answers aa join public.exam_attempts a on a.id = aa.attempt_id where a.user_id = v_user
    union select (v.created_at at time zone tz)::date from public.essay_versions v join public.essays e on e.id = v.essay_id where e.user_id = v_user
    union select day from public.study_sessions where user_id = v_user and seconds >= 60
  ) s where x <= today;

  -- sequência atual (vale até ontem: hoje ainda dá tempo) e melhor sequência
  if days is not null then
    d := case when today = any (days) then today else today - 1 end;
    while d = any (days) loop streak := streak + 1; d := d - 1; end loop;
    foreach d in array days loop
      if prev is not null and d = prev + 1 then run := run + 1; else run := 1; end if;
      best := greatest(best, run); prev := d;
    end loop;
  end if;

  select jsonb_build_object(
    'user_id', v_user,
    'board', p_board,
    'totals', (select jsonb_build_object('answered', count(*), 'correct', count(*) filter (where ok), 'time_ms', coalesce(sum(ms), 0)) from _facts),
    'by_area', coalesce((select jsonb_agg(jsonb_build_object('key', area, 'board', board, 'answered', n, 'correct', c) order by board, area)
        from (select area, board, count(*) n, count(*) filter (where ok) c from _facts where area is not null group by 1, 2) x), '[]'),
    'by_subject', coalesce((select jsonb_agg(jsonb_build_object('key', subject, 'board', board, 'answered', n, 'correct', c) order by n desc)
        from (select subject, board, count(*) n, count(*) filter (where ok) c from _facts where subject is not null group by 1, 2) x), '[]'),
    'by_topic', coalesce((select jsonb_agg(jsonb_build_object('key', topic, 'subject', coalesce(subject, area), 'answered', n, 'correct', c) order by n desc)
        from (select topic, subject, area, count(*) n, count(*) filter (where ok) c from _facts where topic is not null group by 1, 2, 3 order by 4 desc limit 300) x), '[]'),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', g.day, 'answered', coalesce(f.n, 0), 'correct', coalesce(f.c, 0), 'seconds', coalesce(ss.seconds, 0)) order by g.day)
        from (select gs::date as day from generate_series(today - 59, today, interval '1 day') gs) g
        left join (select day, count(*) n, count(*) filter (where ok) c from _facts group by 1) f on f.day = g.day
        left join public.study_sessions ss on ss.user_id = v_user and ss.day = g.day), '[]'),
    'streak', jsonb_build_object('current', streak, 'best', best, 'studied_today', coalesce(today = any (days), false)),
    'week', jsonb_build_object(
        'answered', (select count(*) from _facts where day >= week_start),
        'answered_today', (select count(*) from _facts where day = today),
        'minutes', ((select coalesce(sum(seconds), 0) from public.study_sessions where user_id = v_user and day >= week_start) / 60),
        'essays', (select count(*) from public.essay_versions v join public.essays e on e.id = v.essay_id
                   where e.user_id = v_user and v.is_submission and (v.created_at at time zone tz)::date >= week_start)),
    'goals', coalesce((select jsonb_object_agg(kind, target) from public.student_goals where user_id = v_user), '{}'),
    'attempts', jsonb_build_object(
        'finished', (select count(*) from public.exam_attempts where user_id = v_user and status in ('finished', 'expired')),
        'simulados', (select count(*) from public.exam_attempts where user_id = v_user and status in ('finished', 'expired') and mode in ('simulado', 'custom'))),
    'errors', jsonb_build_object(
        'pending', (select count(*) from public.error_notebook where user_id = v_user and resolved_at is null),
        'resolved', (select count(*) from public.error_notebook where user_id = v_user and resolved_at is not null)),
    'essays', jsonb_build_object(
        'enem', (select jsonb_build_object('count', count(*), 'avg_total', round(avg(total)), 'best', max(total),
                        'avg_scores', (select jsonb_object_agg(k, round(av)) from (select key k, avg(value::numeric) av
                                        from (select ec.scores from public.essay_corrections ec join public.essays e on e.id = ec.essay_id
                                              where e.user_id = v_user and e.kind = 'enem' and ec.status = 'done' order by ec.created_at desc limit 5) l,
                                        jsonb_each_text(l.scores) group by key) z))
                 from (select ec.total from public.essay_corrections ec join public.essays e on e.id = ec.essay_id
                       where e.user_id = v_user and e.kind = 'enem' and ec.status = 'done' order by ec.created_at desc limit 3) t),
        'ufpr', (select jsonb_build_object('count', count(*), 'avg_pct', round(avg(total / nullif(max_total, 0)) * 100))
                 from (select ec.total, ec.max_total from public.essay_corrections ec join public.essays e on e.id = ec.essay_id
                       where e.user_id = v_user and e.kind = 'ufpr' and ec.status = 'done' order by ec.created_at desc limit 3) t))
  ) into result;
  return result;
end $$;

-- ---------------------------------------------------------------- conquistas (calculadas no servidor)
create or replace function public.refresh_achievements(p_user uuid default null)
returns text[] language plpgsql security definer set search_path = public as $$
declare v_user uuid := coalesce(p_user, auth.uid()); st jsonb; earned text[] := '{}'; c text; new_codes text[] := '{}';
  answered int; enem_best numeric;
begin
  if v_user is null or not (v_user = auth.uid() or public.is_admin()) then raise exception 'permission denied' using errcode = '42501'; end if;
  st := public.student_stats(v_user, null);
  answered := (st #>> '{totals,answered}')::int;
  enem_best := (st #>> '{essays,enem,best}')::numeric;
  if answered >= 1 then earned := earned || 'primeiro_passo'::text; end if;
  if answered >= 100 then earned := earned || 'cem_questoes'::text; end if;
  if answered >= 1000 then earned := earned || 'mil_questoes'::text; end if;
  if (st #>> '{attempts,simulados}')::int >= 1 then earned := earned || 'primeiro_simulado'::text; end if;
  if exists (select 1 from public.exam_attempts a where a.user_id = v_user and a.mode = 'simulado' and a.status in ('finished', 'expired')
             and (select count(*) from public.attempt_questions aq where aq.attempt_id = a.id) >= 80) then earned := earned || 'maratonista'::text; end if;
  if (st #>> '{streak,best}')::int >= 7 then earned := earned || 'sequencia_7'::text; end if;
  if (st #>> '{streak,best}')::int >= 30 then earned := earned || 'sequencia_30'::text; end if;
  if coalesce((st #>> '{essays,enem,count}')::int, 0) + coalesce((st #>> '{essays,ufpr,count}')::int, 0) >= 1
     or exists (select 1 from public.essay_corrections ec join public.essays e on e.id = ec.essay_id where e.user_id = v_user and ec.status = 'done')
     then earned := earned || 'primeira_redacao'::text; end if;
  if enem_best >= 800 then earned := earned || 'redacao_800'::text; end if;
  if (st #>> '{errors,resolved}')::int >= 10 then earned := earned || 'caderno_limpo'::text; end if;
  if exists (select 1 from jsonb_array_elements(st -> 'by_topic') t where (t ->> 'answered')::int >= 20
             and (t ->> 'correct')::numeric / (t ->> 'answered')::numeric >= 0.8) then earned := earned || 'mestre_assunto'::text; end if;
  foreach c in array earned loop
    insert into public.achievements (user_id, code) values (v_user, c) on conflict do nothing;
    if found then new_codes := new_codes || c; end if;
  end loop;
  return new_codes;
end $$;

-- ---------------------------------------------------------------- visão geral do admin
create or replace function public.admin_overview(p_board text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; out jsonb := '[]'::jsonb; st jsonb;
begin
  if not public.is_admin() then raise exception 'permission denied' using errcode = '42501'; end if;
  for r in select id, full_name, email, is_active, last_seen_at from public.profiles where role = 'student' order by full_name loop
    st := public.student_stats(r.id, p_board);
    out := out || jsonb_build_object(
      'id', r.id, 'name', r.full_name, 'email', r.email, 'active', r.is_active, 'last_seen_at', r.last_seen_at,
      'last_device', (select device from public.access_logs where user_id = r.id and device is not null order by at desc limit 1),
      'logins_7d', (select count(*) from public.access_logs where user_id = r.id and event = 'login' and at > now() - interval '7 days'),
      'stats', st,
      'weak_topics', coalesce((select jsonb_agg(t order by (t ->> 'correct')::numeric / (t ->> 'answered')::numeric)
                               from (select t from jsonb_array_elements(st -> 'by_topic') t where (t ->> 'answered')::int >= 5
                                     order by (t ->> 'correct')::numeric / (t ->> 'answered')::numeric limit 3) z), '[]'));
  end loop;
  return out;
end $$;

revoke execute on function public.ping_activity(text, text), public.student_stats(uuid, text), public.refresh_achievements(uuid), public.admin_overview(text) from public, anon;
grant execute on function public.ping_activity(text, text), public.student_stats(uuid, text), public.refresh_achievements(uuid), public.admin_overview(text) to authenticated;
