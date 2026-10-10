-- "Sobre você" (opcional): dados demográficos para entender o público em números agregados.
-- Tabela separada de profiles: não entra em nenhuma RPC social; o aluno vê/edita/apaga os seus; o admin só vê totais.
-- Pode rodar de novo sem erro.

create table if not exists public.profile_demographics (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  age_range text check (age_range in ('ate14', '15_16', '17', '18_19', '20_24', '25_mais', 'nd')),
  gender text check (gender in ('feminino', 'masculino', 'nao_binario', 'outro', 'nd')),
  school_type text check (school_type in ('publica', 'particular', 'bolsista', 'eja', 'nd')),
  school_year text check (school_year in ('1em', '2em', '3em', 'concluido', 'superior', 'nd')),
  state text check (state ~ '^[A-Z]{2}$'),
  city text check (char_length(city) <= 60),
  referral text check (referral in ('amigo', 'escola', 'instagram', 'tiktok', 'youtube', 'google', 'outro')),
  updated_at timestamptz not null default now()
);
alter table public.profile_demographics enable row level security;
drop policy if exists demo_own_select on public.profile_demographics;
create policy demo_own_select on public.profile_demographics for select to authenticated using (user_id = auth.uid());
drop policy if exists demo_own_insert on public.profile_demographics;
create policy demo_own_insert on public.profile_demographics for insert to authenticated with check (user_id = auth.uid());
drop policy if exists demo_own_update on public.profile_demographics;
create policy demo_own_update on public.profile_demographics for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists demo_own_delete on public.profile_demographics;
create policy demo_own_delete on public.profile_demographics for delete to authenticated using (user_id = auth.uid());

-- Totais por pergunta (só admin). Grupos com menos de 3 pessoas aparecem como "poucos" para não identificar ninguém.
create or replace function public.demographics_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; part jsonb; f text;
begin
  if not public.is_admin() then raise exception 'permission denied' using errcode = '42501'; end if;
  select jsonb_build_object(
    'students', (select count(*) from public.profiles where role = 'student' and is_active),
    'answered', (select count(*) from public.profile_demographics d join public.profiles p on p.id = d.user_id where p.role = 'student' and p.is_active))
    into r;
  foreach f in array array['age_range', 'gender', 'school_type', 'school_year', 'state', 'referral'] loop
    execute format($q$
      select coalesce(jsonb_agg(jsonb_build_object('value', v, 'n', case when n < 3 then null else n end) order by n desc), '[]'::jsonb)
        from (select coalesce(%1$I, 'sem_resposta') v, count(*)::int n
                from public.profiles p left join public.profile_demographics d on d.user_id = p.id
               where p.role = 'student' and p.is_active group by 1) s $q$, f) into part;
    r := r || jsonb_build_object(f, part);
  end loop;
  return r;
end $$;
revoke execute on function public.demographics_summary() from public, anon;
grant execute on function public.demographics_summary() to authenticated;
