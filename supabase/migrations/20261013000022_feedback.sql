-- 0022: feedbacks dos alunos (beta). Elogios, ideias, melhorias e problemas num lugar só, com resposta da equipe.
-- Idempotente.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('elogio', 'ideia', 'melhoria', 'problema')),
  rating smallint check (rating between 1 and 5),
  message text not null check (char_length(btrim(message)) between 3 and 2000),
  page text check (char_length(page) <= 200),
  device text check (char_length(device) <= 300),
  status text not null default 'novo' check (status in ('novo', 'lido', 'resolvido')),
  reply text check (char_length(reply) <= 2000),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feedback_user on public.feedback (user_id, created_at desc);
create index if not exists feedback_status on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;

drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to authenticated with check (user_id = auth.uid() and public.is_active_user());
drop policy if exists feedback_admin on public.feedback;
create policy feedback_admin on public.feedback
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists feedback_delete on public.feedback;
create policy feedback_delete on public.feedback
  for delete to authenticated using (public.is_admin());

-- aluno só cria como "novo", sem resposta; no máximo 20 por dia (evita spam acidental)
create or replace function public.trg_feedback_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.status := 'novo'; new.reply := null; new.replied_at := null;
    end if;
    if (select count(*) from public.feedback where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
      raise exception 'feedback_limit';
    end if;
  else
    if new.reply is distinct from old.reply then new.replied_at := case when new.reply is null then null else now() end; end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
revoke execute on function public.trg_feedback_guard() from public, anon, authenticated;
drop trigger if exists feedback_guard on public.feedback;
create trigger feedback_guard before insert or update on public.feedback
  for each row execute function public.trg_feedback_guard();
