-- Fase A (produto): planos, limites por plano, assinaturas e contador de uso.
-- Os limites ficam em tabela (ajuste sem deploy) e podem ser sobrescritos por usuário.
-- Toda checagem é no servidor: entitlement() é a única fonte de verdade.

create table public.plans (
  code text primary key,
  name text not null,
  price_cents int not null default 0,
  price_year_cents int,
  is_public boolean not null default true,
  sort int not null default 0
);

-- quota nula = ilimitado; 0 = recurso indisponível no plano
create table public.plan_limits (
  plan_code text not null references public.plans (code) on delete cascade,
  feature text not null check (feature in ('simulado', 'essay_ai', 'transcribe', 'tutor_msg', 'export', 'export_size', 'study_plan')),
  period text not null check (period in ('day', 'week', 'month', 'none')),
  quota int check (quota is null or quota >= 0),
  primary key (plan_code, feature)
);

create table public.user_limit_overrides (
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null,
  period text not null check (period in ('day', 'week', 'month', 'none')),
  quota int check (quota is null or quota >= 0),
  note text,
  primary key (user_id, feature)
);

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan_code text not null references public.plans (code),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_end timestamptz,
  current_period_end timestamptz,         -- nulo = sem vencimento (cortesia/família)
  provider text,                          -- stripe | asaas | manual
  provider_sub_id text,
  family_owner_id uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null,
  units int not null default 1,
  at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);
create index usage_events_user_feature on public.usage_events (user_id, feature, at desc);

insert into public.plans (code, name, price_cents, price_year_cents, sort) values
  ('free', 'Grátis', 0, null, 0),
  ('estudante', 'Estudante', 990, 7900, 1),
  ('pro', 'Pro', 1990, 15900, 2),
  ('familia', 'Família', 2990, null, 3);

insert into public.plan_limits (plan_code, feature, period, quota) values
  ('free', 'simulado', 'month', 1), ('free', 'essay_ai', 'week', 1), ('free', 'transcribe', 'week', 2),
  ('free', 'tutor_msg', 'day', 5), ('free', 'export', 'month', 5), ('free', 'export_size', 'none', 20), ('free', 'study_plan', 'month', 0),
  ('estudante', 'simulado', 'month', null), ('estudante', 'essay_ai', 'week', 3), ('estudante', 'transcribe', 'week', 6),
  ('estudante', 'tutor_msg', 'day', 40), ('estudante', 'export', 'month', 10), ('estudante', 'export_size', 'none', 180), ('estudante', 'study_plan', 'month', 0),
  ('pro', 'simulado', 'month', null), ('pro', 'essay_ai', 'day', 2), ('pro', 'transcribe', 'day', 4),
  ('pro', 'tutor_msg', 'day', 150), ('pro', 'export', 'month', null), ('pro', 'export_size', 'none', 180), ('pro', 'study_plan', 'month', null),
  ('familia', 'simulado', 'month', null), ('familia', 'essay_ai', 'day', 2), ('familia', 'transcribe', 'day', 4),
  ('familia', 'tutor_msg', 'day', 150), ('familia', 'export', 'month', null), ('familia', 'export_size', 'none', 180), ('familia', 'study_plan', 'month', null);

-- ---------------------------------------------------------------- RLS
alter table public.plans enable row level security;
alter table public.plan_limits enable row level security;
alter table public.user_limit_overrides enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;

grant select on public.plans, public.plan_limits to anon, authenticated;
create policy plans_read on public.plans for select to anon, authenticated using (is_public or public.is_admin());
create policy plan_limits_read on public.plan_limits for select to anon, authenticated using (true);
create policy plans_admin on public.plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy plan_limits_admin on public.plan_limits for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy overrides_own on public.user_limit_overrides for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy overrides_admin on public.user_limit_overrides for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy subscriptions_own on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy subscriptions_admin on public.subscriptions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy usage_own on public.usage_events for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- escrita em usage_events só por funções security definer

-- ---------------------------------------------------------------- plano efetivo e direito de uso
-- Plano efetivo: trial válido ou assinatura ativa (sem vencimento ou não vencida); senão, Grátis.
create or replace function public._effective_plan(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.plan_code from public.subscriptions s
    where s.user_id = p_user
      and ((s.status = 'trialing' and s.trial_end > now())
        or (s.status in ('active', 'past_due') and (s.current_period_end is null or s.current_period_end > now())))
  ), 'free');
$$;

-- início do período corrente no fuso de São Paulo
create or replace function public._period_start(p_period text)
returns timestamptz language sql stable set search_path = public as $$
  select case p_period
    when 'day' then date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
    when 'week' then date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
    when 'month' then date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
    else '-infinity'::timestamptz end;
$$;

create or replace function public._usage(p_user uuid, p_feature text, p_since timestamptz)
returns int language sql stable security definer set search_path = public as $$
  select case p_feature
    -- IA de redação/discursivas e transcrição já são registradas em ai_jobs (falhas não contam)
    when 'essay_ai' then (select count(*)::int from public.ai_jobs j where j.user_id = p_user and j.kind in ('essay', 'discursive')
                           and j.status <> 'failed' and j.created_at >= p_since)
    when 'transcribe' then (select count(*)::int from public.ai_jobs j where j.user_id = p_user and j.kind = 'transcribe'
                           and j.status <> 'failed' and j.created_at >= p_since)
    else (select coalesce(sum(units), 0)::int from public.usage_events u where u.user_id = p_user and u.feature = p_feature and u.at >= p_since)
  end;
$$;

-- {feature, plan, period, quota (null = ilimitado), used, remaining, resets_at, unlimited}
create or replace function public._entitlement(p_user uuid, p_feature text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_plan text := public._effective_plan(p_user); v_period text; v_quota int; v_used int; v_admin boolean;
begin
  select (role = 'admin') into v_admin from public.profiles where id = p_user;
  select period, quota into v_period, v_quota from public.user_limit_overrides where user_id = p_user and feature = p_feature;
  if not found then
    select period, quota into v_period, v_quota from public.plan_limits where plan_code = v_plan and feature = p_feature;
    if not found then v_period := 'none'; v_quota := 0; end if;
  end if;
  if coalesce(v_admin, false) then v_quota := null; end if;
  v_used := public._usage(p_user, p_feature, public._period_start(v_period));
  return jsonb_build_object(
    'feature', p_feature, 'plan', v_plan, 'period', v_period, 'quota', v_quota, 'used', v_used,
    'remaining', case when v_quota is null then null else greatest(v_quota - v_used, 0) end,
    'unlimited', v_quota is null,
    'resets_at', case v_period when 'day' then public._period_start('day') + interval '1 day'
                               when 'week' then public._period_start('week') + interval '1 week'
                               when 'month' then public._period_start('month') + interval '1 month' end);
end $$;

create or replace function public.entitlement(p_feature text)
returns jsonb language sql stable security definer set search_path = public as $$
  select public._entitlement(auth.uid(), p_feature);
$$;

-- resumo do plano do usuário logado (tela de perfil/planos)
create or replace function public.my_plan()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plan', public._effective_plan(auth.uid()),
    'subscription', (select to_jsonb(s) - 'provider_sub_id' from public.subscriptions s where s.user_id = auth.uid()),
    'limits', (select jsonb_object_agg(f, public._entitlement(auth.uid(), f))
               from unnest(array['simulado', 'essay_ai', 'transcribe', 'tutor_msg', 'export']) f));
$$;

-- reserva atômica de uso (para recursos contados em usage_events). Lança 'plan_limit:<feature>'.
create or replace function public._consume(p_user uuid, p_feature text, p_units int default 1, p_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('usage:' || p_user::text || ':' || p_feature));
  e := public._entitlement(p_user, p_feature);
  if not (e ->> 'unlimited')::boolean and (e ->> 'used')::int + p_units > (e ->> 'quota')::int then
    raise exception 'plan_limit:%', p_feature using errcode = 'P0001';
  end if;
  insert into public.usage_events (user_id, feature, units, meta) values (p_user, p_feature, p_units, p_meta);
end $$;

-- ai_quota (usada pela tela de redação) agora vem do plano; mantém o formato antigo + período e plano
create or replace function public.ai_quota()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('limit', coalesce((e ->> 'quota')::int, 0), 'used', (e ->> 'used')::int,
                            'unlimited', (e ->> 'unlimited')::boolean, 'period', e ->> 'period', 'plan', e ->> 'plan')
  from (select public._entitlement(auth.uid(), 'essay_ai') e) s;
$$;

create or replace function public._reserve_ai_job(p_kind text, p_ref jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare e jsonb; v_id uuid; v_feature text := case when p_kind = 'transcribe' then 'transcribe' else 'essay_ai' end;
begin
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || auth.uid()::text));
  e := public._entitlement(auth.uid(), v_feature);
  if not (e ->> 'unlimited')::boolean and (e ->> 'used')::int >= (e ->> 'quota')::int then
    raise exception 'quota_exceeded';
  end if;
  insert into public.ai_jobs (user_id, kind, ref) values (auth.uid(), p_kind, p_ref) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public._reserve_ai_job(text, jsonb) from public, anon, authenticated;

-- simulado por prova (prova inteira) consome 1 do plano; treino/personalizado/revisão não
create or replace function public.trg_attempt_plan_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.mode = 'simulado' and new.exam_id is not null then
    perform public._consume(new.user_id, 'simulado', 1, jsonb_build_object('exam_id', new.exam_id));
  end if;
  return new;
end $$;
create trigger exam_attempts_plan_limit before insert on public.exam_attempts
  for each row execute function public.trg_attempt_plan_limit();

revoke execute on function public._effective_plan(uuid), public._usage(uuid, text, timestamptz), public._entitlement(uuid, text),
  public._consume(uuid, text, int, jsonb), public.trg_attempt_plan_limit() from public, anon, authenticated;
grant execute on function public.entitlement(text), public.my_plan(), public.ai_quota() to authenticated;

-- ---------------------------------------------------------------- cadastro: trial do Pro por 7 dias
-- Novas contas ganham 7 dias de Pro. Contas criadas pelo admin (convite ou "Novo aluno") viram Família
-- no servidor (ver actions), sem passar por aqui.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  insert into public.subscriptions (user_id, plan_code, status, trial_end, provider)
  values (new.id, 'pro', 'trialing', now() + interval '7 days', 'trial');
  return new;
end $$;

-- convites carregam o plano que a conta recebe (família do admin, por padrão)
alter table public.invites add column plan_code text not null default 'familia' references public.plans (code);

-- ---------------------------------------------------------------- dados existentes
-- A família que já usa o app vira plano Família (sem vencimento); quem já usa não passa pelo onboarding.
insert into public.subscriptions (user_id, plan_code, status, provider)
select id, 'familia', 'active', 'manual' from public.profiles where role = 'student'
on conflict (user_id) do nothing;
update public.profiles set preferences = preferences || '{"onboarded": true}'::jsonb;
