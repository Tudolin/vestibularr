-- Fase 1: perfis, papéis, configurações, vestibulares/formatos e logs de acesso.
-- RLS habilitado em todas as tabelas. Sem policy = sem acesso.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tipos
create type public.user_role as enum ('admin', 'student');

-- ------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  role public.user_role not null default 'student',
  is_active boolean not null default true,
  target_boards text[] not null default '{}',
  preferences jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Funções de papel. SECURITY DEFINER evita recursão de RLS ao consultar profiles.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_active
  );
$$;

-- Todo usuário novo nasce como aluno. O papel admin só é concedido por
-- service-role (server action do admin / script de bootstrap), nunca por metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_select_admin on public.profiles
  for select to authenticated using (public.is_admin());
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() and public.is_active_user())
  with check (id = auth.uid());

-- Aluno só pode alterar campos "seguros"; role/is_active/email só via service-role.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, preferences, target_boards, last_seen_at)
  on public.profiles to authenticated;

-- ------------------------------------------------------------- settings
create table public.settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();
alter table public.settings enable row level security;
create policy settings_select on public.settings
  for select to authenticated using (public.is_active_user());
create policy settings_admin_write on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.settings (key, value, description) values
  ('ai_daily_limit_per_student', '5', 'Máximo de correções por IA por aluno por dia'),
  ('timezone', '"America/Sao_Paulo"', 'Fuso usado para "dia" de estudo e cotas');

-- ---------------------------------------------- vestibulares e formatos
create table public.exam_boards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
create table public.exam_formats (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.exam_boards (id) on delete cascade,
  code text not null unique,
  name text not null,
  valid_from_year int,
  valid_to_year int,
  structure jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger exam_formats_updated_at before update on public.exam_formats
  for each row execute function public.set_updated_at();

alter table public.exam_boards enable row level security;
alter table public.exam_formats enable row level security;
create policy exam_boards_select on public.exam_boards
  for select to authenticated using (public.is_active_user());
create policy exam_boards_admin on public.exam_boards
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy exam_formats_select on public.exam_formats
  for select to authenticated using (public.is_active_user());
create policy exam_formats_admin on public.exam_formats
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.exam_boards (code, name) values
  ('ENEM', 'ENEM'),
  ('UFPR', 'Vestibular UFPR');

-- structure: seções com nº de questões, alternativas, peso e pontuação; duração em minutos.
insert into public.exam_formats (board_id, code, name, valid_from_year, valid_to_year, structure)
select b.id, f.code, f.name, f.vfrom, f.vto, f.structure::jsonb
from public.exam_boards b
join (values
  ('ENEM', 'ENEM_dia1', 'ENEM — Dia 1', 2009, null,
   '{"duration_minutes":330,"alternatives":5,"sections":[{"key":"linguagens","name":"Linguagens, Códigos e suas Tecnologias","questions":45},{"key":"humanas","name":"Ciências Humanas e suas Tecnologias","questions":45},{"key":"redacao","name":"Redação","kind":"essay","max_score":1000}]}'),
  ('ENEM', 'ENEM_dia2', 'ENEM — Dia 2', 2009, null,
   '{"duration_minutes":300,"alternatives":5,"sections":[{"key":"natureza","name":"Ciências da Natureza e suas Tecnologias","questions":45},{"key":"matematica","name":"Matemática e suas Tecnologias","questions":45}]}'),
  ('UFPR', 'UFPR_2fases_ate_2026', 'UFPR — 1ª e 2ª fases (até 2026)', null, 2026,
   '{"phases":2,"alternatives":5,"notes":"Detalhes por edição ficam em exams; 2ª fase com CPT de 3 questões e provas específicas."}'),
  ('UFPR', 'UFPR_fase_unica_2027', 'UFPR — Fase única (2027)', 2027, null,
   '{"duration_minutes":330,"alternatives":4,"single_timer":true,"edital":"50/2026-NC/PROGRAP","sections":[{"key":"objetiva","name":"Prova objetiva de conhecimentos gerais","questions":80,"max_score":80,"subjects":{"portugues":10,"biologia":8,"fisica":8,"geografia":8,"historia":8,"matematica":8,"quimica":8,"lem":7,"literatura":5,"filosofia":5,"sociologia":5},"weights":{"default":1,"specific_max_subjects":2,"tiers":[{"max_questions":5,"weight":3},{"max_questions":10,"weight":2.5},{"max_questions":null,"weight":2}]}},{"key":"cpt","name":"Compreensão e Produção de Textos","kind":"discursive","max_score":40,"questions":[{"lines":15,"max_score":25},{"lines":5,"max_score":15}]}],"score_scale":1000}')
) as f(board, code, name, vfrom, vto, structure) on f.board = b.code;

-- ---------------------------------------------------------- access_logs
create table public.access_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event text not null check (event in ('login', 'page', 'logout')),
  path text,
  device text,
  user_agent text,
  at timestamptz not null default now()
);
create index access_logs_user_at on public.access_logs (user_id, at desc);
alter table public.access_logs enable row level security;
create policy access_logs_insert_own on public.access_logs
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());
create policy access_logs_select_admin on public.access_logs
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------- privilégios
-- Nenhum acesso para anon. authenticated passa por RLS.
revoke all on all tables in schema public from anon;
