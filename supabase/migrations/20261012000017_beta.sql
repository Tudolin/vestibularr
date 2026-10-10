-- Beta: enquanto não há pagamento, todos os alunos usam o plano Pro (limites de custo da IA continuam valendo).
-- O admin desliga em Admin → Alunos quando o pagamento entrar. Pode rodar de novo sem erro.

insert into public.settings (key, value, description) values
  ('beta_open_access', 'true', 'Beta: todos os alunos com acesso do plano Pro (desligar quando o pagamento entrar)')
on conflict (key) do nothing;

create or replace function public._beta_open()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from public.settings where key = 'beta_open_access'), false);
$$;

create or replace function public._effective_plan(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.plan_code from public.subscriptions s
    where s.user_id = p_user
      and ((s.status = 'trialing' and s.trial_end > now())
        or (s.status in ('active', 'past_due') and (s.current_period_end is null or s.current_period_end > now())))
      and s.plan_code <> 'free'
  ), case when public._beta_open() then 'pro' else 'free' end);
$$;

create or replace function public.my_plan()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plan', public._effective_plan(auth.uid()),
    'beta', public._beta_open(),
    'subscription', (select to_jsonb(s) - 'provider_sub_id' from public.subscriptions s where s.user_id = auth.uid()),
    'limits', (select jsonb_object_agg(f, public._entitlement(auth.uid(), f))
               from unnest(array['simulado', 'essay_ai', 'transcribe', 'tutor_msg', 'export']) f));
$$;

revoke execute on function public._beta_open() from public, anon;
grant execute on function public._beta_open() to authenticated;
