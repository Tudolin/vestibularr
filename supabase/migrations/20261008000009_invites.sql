-- Convites por link (uso único) para criar conta de aluno ou de admin.
-- Só o hash SHA-256 do token fica no banco; o link completo aparece uma única vez para o admin.
-- O resgate é feito no servidor com a service-role (a pessoa ainda não tem conta), com UPDATE condicional
-- atômico: um convite nunca cria duas contas.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  role public.user_role not null default 'student',
  email text check (email is null or email = lower(email)),
  note text check (char_length(note) <= 120),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
create index invites_created_at on public.invites (created_at desc);

alter table public.invites enable row level security;
create policy invites_admin on public.invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin() and created_by = auth.uid());
