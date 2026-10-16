-- 0023: análise para o admin — ritmo de estudo e pontos fortes/fracos da turma e de cada aluno.
-- Só leitura, só admin. Datas no fuso de São Paulo. Idempotente.

-- Ritmo pelas últimas 4 semanas: quantos dias estudou e quando foi a última vez.
create or replace function public._rhythm_segment(p_last timestamptz, p_days28 int)
returns text language sql immutable as $$
  select case
    when p_last is null then 'nunca'
    when p_last < now() - interval '7 days' then 'parado'
    when p_days28 >= 12 then 'constante'
    when p_days28 >= 5 then 'regular'
    else 'esporadico' end
$$;

-- Respostas objetivas corrigíveis dos alunos (base das duas análises)
create or replace function public._admin_answers(p_board text, p_user uuid, p_since timestamptz)
returns table (user_id uuid, area text, subject text, topic text, ok boolean, at timestamptz, day date, hour int, dow int, ms bigint)
language sql stable security definer set search_path = public as $$
  select a.user_id, q.area, q.subject, q.topic, aa.choice = k.correct_label,
         coalesce(aa.answered_at, aa.updated_at),
         (coalesce(aa.answered_at, aa.updated_at) at time zone 'America/Sao_Paulo')::date,
         extract(hour from coalesce(aa.answered_at, aa.updated_at) at time zone 'America/Sao_Paulo')::int,
         extract(dow from coalesce(aa.answered_at, aa.updated_at) at time zone 'America/Sao_Paulo')::int,
         least(aa.time_spent_ms, 30 * 60000)
    from public.attempt_answers aa
    join public.exam_attempts a on a.id = aa.attempt_id
    join public.profiles p on p.id = a.user_id and p.role = 'student'
    join public.questions q on q.id = aa.question_id and q.kind = 'objective'
    join public.exam_boards b on b.id = q.board_id
    join public.answer_keys k on k.question_id = aa.question_id and k.correct_label is not null
   where aa.choice is not null
     and coalesce(aa.answered_at, aa.updated_at) >= p_since
     and (p_board is null or b.code = p_board)
     and (p_user is null or a.user_id = p_user)
$$;
revoke execute on function public._admin_answers(text, uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------- turma
create or replace function public.admin_cohort(p_board text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  res jsonb;
begin
  if not public.is_admin() then raise exception 'permission denied' using errcode = '42501'; end if;
  drop table if exists _ans;
  create temp table _ans on commit drop as select * from public._admin_answers(p_board, null, now() - interval '120 days');
  create index on _ans (user_id);

  drop table if exists _st;
  create temp table _st on commit drop as
    select p.id, p.full_name, p.email, p.is_active, p.created_at, p.last_seen_at,
           s.last_at, coalesce(s.days28, 0) days28, coalesce(s.a7, 0) a7, coalesce(s.prev7, 0) prev7,
           coalesce(s.a30, 0) a30, s.acc30, s.min7,
           public._rhythm_segment(s.last_at, coalesce(s.days28, 0)::int) segment,
           (select x.topic from _ans x where x.user_id = p.id and x.topic is not null and x.day > today - 90
             group by x.topic having count(*) >= 5 order by avg(x.ok::int), count(*) desc limit 1) weakest,
           (select x.topic from _ans x where x.user_id = p.id and x.topic is not null and x.day > today - 90
             group by x.topic having count(*) >= 5 order by avg(x.ok::int) desc, count(*) desc limit 1) strongest
      from public.profiles p
      left join (select x.user_id, max(x.at) last_at,
                        count(distinct x.day) filter (where x.day > today - 28) days28,
                        count(*) filter (where x.day > today - 7) a7,
                        count(*) filter (where x.day <= today - 7 and x.day > today - 14) prev7,
                        count(*) filter (where x.day > today - 30) a30,
                        round(avg(x.ok::int) filter (where x.day > today - 30) * 100) acc30,
                        round(sum(x.ms) filter (where x.day > today - 7) / 60000.0) min7
                   from _ans x group by x.user_id) s on s.user_id = p.id
     where p.role = 'student';

  select jsonb_build_object(
    'totals', (select jsonb_build_object(
        'students', count(*),
        'active7', count(*) filter (where a7 > 0),
        'active30', count(*) filter (where a30 > 0),
        'new7', count(*) filter (where created_at > now() - interval '7 days'),
        'answers7', coalesce(sum(a7), 0),
        'answers_prev7', coalesce(sum(prev7), 0),
        'acc30', (select round(avg(ok::int) * 100) from _ans where day > today - 30),
        'per_active7', round(avg(a7) filter (where a7 > 0)),
        'minutes7', coalesce(sum(min7), 0),
        'daily7', (select count(*) from public.daily_challenges where completed_at > now() - interval '7 days'),
        'daily_users7', (select count(distinct user_id) from public.daily_challenges where completed_at > now() - interval '7 days'))
      from _st),
    'segments', (select jsonb_object_agg(segment, n) from (select segment, count(*) n from _st group by segment) z),
    'daily', (select jsonb_agg(jsonb_build_object('day', d::date, 'students', coalesce(x.students, 0), 'answers', coalesce(x.answers, 0), 'correct', coalesce(x.correct, 0)) order by d)
                from generate_series(today - 29, today, interval '1 day') d
                left join (select day, count(distinct user_id) students, count(*) answers, count(*) filter (where ok) correct
                             from _ans where day > today - 30 group by day) x on x.day = d::date),
    'hours', (select jsonb_agg(coalesce(x.n, 0) order by h) from generate_series(0, 23) h
                left join (select hour, count(*) n from _ans where day > today - 30 group by hour) x on x.hour = h),
    'weekdays', (select jsonb_agg(coalesce(x.n, 0) order by w) from generate_series(0, 6) w
                left join (select dow, count(*) n from _ans where day > today - 30 group by dow) x on x.dow = w),
    'by_area', coalesce((select jsonb_agg(jsonb_build_object('key', area, 'answered', n, 'correct', c, 'students', s) order by c::numeric / n)
                from (select area, count(*) n, count(*) filter (where ok) c, count(distinct user_id) s from _ans
                       where area is not null and day > today - 90 group by area) z), '[]'),
    'by_subject', coalesce((select jsonb_agg(jsonb_build_object('key', subject, 'answered', n, 'correct', c, 'students', s) order by c::numeric / n)
                from (select subject, count(*) n, count(*) filter (where ok) c, count(distinct user_id) s from _ans
                       where subject is not null and day > today - 90 group by subject having count(*) >= 10) z), '[]'),
    'weak_topics', coalesce((select jsonb_agg(t) from (select jsonb_build_object('key', topic, 'subject', subject, 'answered', count(*), 'correct', count(*) filter (where ok), 'students', count(distinct user_id)) t
                from _ans where topic is not null and day > today - 90 group by topic, subject having count(*) >= 10
                order by avg(ok::int), count(*) desc limit 8) z), '[]'),
    'strong_topics', coalesce((select jsonb_agg(t) from (select jsonb_build_object('key', topic, 'subject', subject, 'answered', count(*), 'correct', count(*) filter (where ok), 'students', count(distinct user_id)) t
                from _ans where topic is not null and day > today - 90 group by topic, subject having count(*) >= 10
                order by avg(ok::int) desc, count(*) desc limit 8) z), '[]'),
    'students', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', id, 'name', full_name, 'email', email, 'active', is_active, 'created_at', created_at, 'last_seen_at', last_seen_at,
                  'last_at', last_at, 'days28', days28, 'a7', a7, 'prev7', prev7, 'a30', a30, 'acc30', acc30, 'min7', coalesce(min7, 0),
                  'segment', segment, 'weakest', weakest, 'strongest', strongest, 'streak', public._xp_streak(id))
                  order by last_at desc nulls last, full_name) from _st), '[]')
  ) into res;
  return res;
end $$;

-- ---------------------------------------------------------------- um aluno
create or replace function public.admin_student_rhythm(p_user uuid, p_board text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  res jsonb;
begin
  if not public.is_admin() then raise exception 'permission denied' using errcode = '42501'; end if;
  drop table if exists _ra;
  create temp table _ra on commit drop as select * from public._admin_answers(p_board, p_user, now() - interval '120 days');

  select jsonb_build_object(
    'calendar', (select jsonb_agg(jsonb_build_object('day', d::date, 'answers', coalesce(x.n, 0), 'correct', coalesce(x.c, 0), 'minutes', coalesce(x.m, 0)) order by d)
                   from generate_series(today - 83, today, interval '1 day') d
                   left join (select day, count(*) n, count(*) filter (where ok) c, round(sum(ms) / 60000.0) m from _ra group by day) x on x.day = d::date),
    'hours', (select jsonb_agg(coalesce(x.n, 0) order by h) from generate_series(0, 23) h
                left join (select hour, count(*) n from _ra where day > today - 60 group by hour) x on x.hour = h),
    'weekdays', (select jsonb_agg(coalesce(x.n, 0) order by w) from generate_series(0, 6) w
                left join (select dow, count(*) n from _ra where day > today - 60 group by dow) x on x.dow = w),
    'summary', (select jsonb_build_object(
        'last_at', max(at),
        'days28', count(distinct day) filter (where day > today - 28),
        'a7', count(*) filter (where day > today - 7),
        'prev7', count(*) filter (where day <= today - 7 and day > today - 14),
        'acc7', round(avg(ok::int) filter (where day > today - 7) * 100),
        'acc_prev7', round(avg(ok::int) filter (where day <= today - 7 and day > today - 14) * 100),
        'per_day', round(count(*) filter (where day > today - 28)::numeric / nullif(count(distinct day) filter (where day > today - 28), 0)),
        'min_per_day', round(sum(ms) filter (where day > today - 28) / 60000.0 / nullif(count(distinct day) filter (where day > today - 28), 0)),
        'sec_per_q', round(avg(ms) filter (where day > today - 28 and ms > 0) / 1000.0),
        'segment', public._rhythm_segment(max(at), (count(distinct day) filter (where day > today - 28))::int))
      from _ra),
    'subjects', coalesce((select jsonb_agg(jsonb_build_object('key', subject, 'answered', n, 'correct', c, 'recent', r, 'recent_correct', rc) order by c::numeric / n)
                from (select subject, count(*) n, count(*) filter (where ok) c,
                             count(*) filter (where day > today - 14) r, count(*) filter (where ok and day > today - 14) rc
                        from _ra where subject is not null group by subject) z), '[]')
  ) into res;
  return res;
end $$;

revoke execute on function public.admin_cohort(text), public.admin_student_rhythm(uuid, text) from public, anon;
grant execute on function public.admin_cohort(text), public.admin_student_rhythm(uuid, text) to authenticated;
