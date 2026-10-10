-- Cole no SQL Editor do Supabase: mostra quais migrations já estão aplicadas (true) e quais faltam (false).
-- Aplique as que faltam NA ORDEM, uma por vez, cada uma no seu próprio SQL Editor.
select
  to_regclass('public.exam_attempts') is not null                                                    as "0003_attempts",
  to_regclass('public.essays') is not null                                                           as "0004_essays_ai",
  to_regclass('public.student_goals') is not null                                                    as "0005_performance",
  to_regclass('public.tips') is not null                                                             as "0006_tips",
  exists (select 1 from pg_proc where proname = 'apply_explanations')                                as "0007_explanations",
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'has_solution') as "0008_only_solved",
  to_regclass('public.invites') is not null                                                          as "0009_invites",
  to_regclass('public.plan_limits') is not null                                                      as "0010_plans",
  exists (select 1 from pg_proc where proname = 'answer_facts')                                      as "0011_taxonomy",
  exists (select 1 from pg_proc where proname = 'triagem_start')                                     as "0012_triagem",
  exists (select 1 from pg_proc where proname = '_triagem_available')                                as "0013_triagem_vazia",
  to_regclass('public.friendships') is not null                                                      as "0014_social",
  to_regclass('public.push_subscriptions') is not null                                               as "0015_notifications",
  to_regclass('public.exports') is not null                                                          as "0016_exports",
  exists (select 1 from pg_proc where proname = '_beta_open')                                        as "0017_beta",
  to_regclass('public.daily_challenges') is not null                                                 as "0018_desafio",
  -- dados: questões com TRI (precisa do npm run seed:taxonomia). A triagem exige pelo menos 8 por área.
  (select count(*) from public.questions where irt_b is not null)                                    as "questoes_com_tri";
