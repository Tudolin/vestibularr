-- Fase 2: banco de questões, provas, obras literárias, importação.

-- ---- Correção de formatos do ENEM -----------------------------------------
-- Até 2016 o 1º dia era Humanas + Natureza e o 2º, Linguagens + Matemática + redação.
-- Desde 2017: dia 1 = Linguagens + Humanas + redação; dia 2 = Natureza + Matemática.
update public.exam_formats set valid_from_year = 2017 where code in ('ENEM_dia1', 'ENEM_dia2');
insert into public.exam_formats (board_id, code, name, valid_from_year, valid_to_year, structure)
select b.id, f.code, f.name, 2009, 2016, f.structure::jsonb
from public.exam_boards b
join (values
  ('ENEM_antigo_dia1', 'ENEM — Dia 1 (até 2016)',
   '{"duration_minutes":270,"alternatives":5,"sections":[{"key":"humanas","name":"Ciências Humanas e suas Tecnologias","questions":45},{"key":"natureza","name":"Ciências da Natureza e suas Tecnologias","questions":45}]}'),
  ('ENEM_antigo_dia2', 'ENEM — Dia 2 (até 2016)',
   '{"duration_minutes":330,"alternatives":5,"sections":[{"key":"linguagens","name":"Linguagens, Códigos e suas Tecnologias","questions":45},{"key":"matematica","name":"Matemática e suas Tecnologias","questions":45},{"key":"redacao","name":"Redação","kind":"essay","max_score":1000}]}')
) as f(code, name, structure) on b.code = 'ENEM'
on conflict (code) do nothing;

-- ---- Obras literárias (UFPR) ------------------------------------------------
create table public.literary_works (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.exam_boards (id) on delete cascade,
  title text not null,
  author text,
  year_from int,
  year_to int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger literary_works_updated_at before update on public.literary_works
  for each row execute function public.set_updated_at();
create unique index literary_works_title on public.literary_works (board_id, lower(title));

-- ---- Provas ----------------------------------------------------------------
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.exam_boards (id) on delete cascade,
  format_id uuid references public.exam_formats (id) on delete set null,
  year int not null,
  name text not null,
  day text,
  pdf_url text,
  answer_pdf_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, year, name)
);
create trigger exams_updated_at before update on public.exams
  for each row execute function public.set_updated_at();

-- ---- Questões --------------------------------------------------------------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.exam_boards (id) on delete cascade,
  exam_id uuid references public.exams (id) on delete set null,
  year int,
  number int,
  language text check (language in ('ingles', 'espanhol')),
  kind text not null default 'objective' check (kind in ('objective', 'discursive')),
  area text check (area in ('linguagens', 'humanas', 'natureza', 'matematica')),
  subject text,
  topic text,
  work_id uuid references public.literary_works (id) on delete set null,
  section text,
  statement_md text not null,
  images jsonb not null default '[]'::jsonb,
  source_ref text,
  external_id text,
  is_active boolean not null default true,
  search tsvector generated always as (
    to_tsvector('portuguese'::regconfig,
      coalesce(statement_md, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(subject, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger questions_updated_at before update on public.questions
  for each row execute function public.set_updated_at();
create unique index questions_external on public.questions (board_id, external_id) where external_id is not null;
create unique index questions_exam_number on public.questions (exam_id, number, coalesce(language, '')) where exam_id is not null and number is not null;
create index questions_filter on public.questions (board_id, area, year);
create index questions_work on public.questions (work_id) where work_id is not null;
create index questions_search on public.questions using gin (search);

create table public.alternatives (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label text not null check (label in ('A', 'B', 'C', 'D', 'E')),
  text_md text not null default '',
  image_url text,
  unique (question_id, label)
);

-- Gabarito, resolução e espelho. Separado para poder esconder do aluno (Fase 3 libera após responder).
create table public.answer_keys (
  question_id uuid primary key references public.questions (id) on delete cascade,
  correct_label text check (correct_label in ('A', 'B', 'C', 'D', 'E')),
  explanation_md text,
  official_mirror_md text,
  max_score numeric
);

create table public.exam_questions (
  exam_id uuid not null references public.exams (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  position int not null,
  section text,
  weight numeric not null default 1,
  primary key (exam_id, question_id)
);
create index exam_questions_pos on public.exam_questions (exam_id, position);

-- ---- Envios de alunos (staging; admin aprova) ------------------------------
create table public.question_imports (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  filename text,
  payload jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index question_imports_status on public.question_imports (status, created_at desc);

-- ---- RLS -------------------------------------------------------------------
alter table public.literary_works enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.alternatives enable row level security;
alter table public.answer_keys enable row level security;
alter table public.exam_questions enable row level security;
alter table public.question_imports enable row level security;

create policy literary_works_select on public.literary_works for select to authenticated using (public.is_active_user());
create policy literary_works_admin on public.literary_works for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy exams_select on public.exams for select to authenticated
  using (public.is_active_user() and (is_published or public.is_admin()));
create policy exams_admin on public.exams for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy questions_select on public.questions for select to authenticated
  using (public.is_active_user() and (is_active or public.is_admin()));
create policy questions_admin on public.questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy alternatives_select on public.alternatives for select to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id));
create policy alternatives_admin on public.alternatives for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy exam_questions_select on public.exam_questions for select to authenticated using (public.is_active_user());
create policy exam_questions_admin on public.exam_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Só admin lê gabarito nesta fase. A Fase 3 acrescenta a liberação ao aluno após responder.
create policy answer_keys_admin on public.answer_keys for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy question_imports_insert on public.question_imports for insert to authenticated
  with check (submitted_by = auth.uid() and status = 'pending' and public.is_active_user());
create policy question_imports_select_own on public.question_imports for select to authenticated
  using (submitted_by = auth.uid());
create policy question_imports_select_admin on public.question_imports for select to authenticated using (public.is_admin());
create policy question_imports_admin_write on public.question_imports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy question_imports_admin_delete on public.question_imports for delete to authenticated using (public.is_admin());

-- ---- Importação atômica e idempotente -------------------------------------
-- p = {board, exams:[{name,year,day,format,pdf_url,answer_pdf_url,questions:[...]}], questions:[...]}
-- Reimportar atualiza (chave: prova+número+idioma, ou board+external_id). Só admin / service-role.
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
          correct_label = excluded.correct_label, explanation_md = excluded.explanation_md,
          official_mirror_md = excluded.official_mirror_md, max_score = excluded.max_score;
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
