-- Fase 4: redação ENEM, produção textual UFPR (CPT), rubricas como dados, correção por IA com cota diária.

-- ---------------------------------------------------------------- rubricas (editáveis pelo admin)
-- criteria: [{key, name, description, max (ENEM: pontos; UFPR: fração do total da questão), step?}]
create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('enem', 'ufpr', 'discursive')),
  name text not null,
  version int not null default 1,
  is_active boolean not null default true,
  criteria jsonb not null,
  instructions text not null default '',
  created_at timestamptz not null default now(),
  unique (kind, version)
);
create unique index rubrics_one_active on public.rubrics (kind) where is_active;

insert into public.rubrics (kind, name, version, criteria, instructions) values
('enem', 'Redação ENEM — 5 competências', 1, '[
  {"key":"c1","name":"Competência 1","description":"Domínio da modalidade escrita formal da língua portuguesa (gramática, ortografia, acentuação, pontuação, concordância, regência, crase, estrutura sintática).","max":200,"step":40},
  {"key":"c2","name":"Competência 2","description":"Compreensão da proposta e aplicação de conceitos de várias áreas para desenvolver o tema dentro dos limites do texto dissertativo-argumentativo em prosa; uso de repertório sociocultural legitimado, pertinente e produtivo.","max":200,"step":40},
  {"key":"c3","name":"Competência 3","description":"Seleção, relação, organização e interpretação de informações, fatos, opiniões e argumentos em defesa de um ponto de vista (projeto de texto).","max":200,"step":40},
  {"key":"c4","name":"Competência 4","description":"Conhecimento dos mecanismos linguísticos necessários para a construção da argumentação (coesão: conectivos, referenciação, articulação entre parágrafos e períodos).","max":200,"step":40},
  {"key":"c5","name":"Competência 5","description":"Proposta de intervenção para o problema abordado, respeitando os direitos humanos, com os cinco elementos: agente, ação, meio/modo, finalidade/efeito e detalhamento.","max":200,"step":40}
]', 'Notas de cada competência só podem ser 0, 40, 80, 120, 160 ou 200. Nota 0 em todas (redação anulada) se: fuga total ao tema, não atendimento ao tipo dissertativo-argumentativo, texto com até 7 linhas, parte desconectada do tema, impropérios/desenhos, desrespeito aos direitos humanos em C5 zera só a C5.'),
('ufpr', 'Produção textual UFPR (CPT)', 1, '[
  {"key":"comando","name":"Atendimento ao comando","description":"Faz exatamente o que a questão pede (fidelidade à proposta, edital 6.11.2 a).","max":0.25},
  {"key":"genero","name":"Adequação ao gênero/tipo","description":"Domínio da estrutura textual e discursiva do gênero ou tipo pedido (6.11.2 b).","max":0.20},
  {"key":"fidelidade","name":"Fidelidade aos textos de apoio","description":"Leitura e uso correto das informações dos textos-base, sem distorções nem cópia (6.11.2 a).","max":0.20},
  {"key":"coesao","name":"Coesão e coerência","description":"Organização global, articulação entre partes, progressão e não contradição (6.11.2 c).","max":0.15},
  {"key":"norma","name":"Norma-padrão","description":"Concordância, regência, colocação, pontuação, estruturas sintáticas da escrita e ortografia (6.11.2 d, e, f).","max":0.15},
  {"key":"limite","name":"Respeito ao limite","description":"Respeita o número de linhas pedido; texto acima do limite perde este critério e pode ter o excedente desconsiderado.","max":0.05}
]', 'Os pesos por critério são ESTIMATIVAS: o edital lista os critérios mas não divulga a pontuação de cada um. Zera a questão se: fuga ao tema ou à tipologia pedida, identificação do candidato (nome, assinatura), texto em branco ou em outra língua (edital 6.11.4).'),
('discursive', 'Discursiva com espelho oficial', 1, '[
  {"key":"conteudo","name":"Conteúdo esperado","description":"Presença dos pontos do espelho oficial de resposta.","max":0.8},
  {"key":"expressao","name":"Expressão escrita","description":"Clareza, correção e articulação da resposta.","max":0.2}
]', 'Compare a resposta com o espelho oficial. Pontue cada elemento do espelho presente; não exija palavras idênticas, exija o conceito.');

-- ---------------------------------------------------------------- temas / propostas
create table public.essay_themes (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('enem', 'ufpr')),
  title text not null,
  prompt_md text not null default '',
  support_texts_md text,
  task_type text not null default 'dissertativo'
    check (task_type in ('dissertativo', 'resumo', 'expositivo', 'argumentativo', 'analise_dados', 'continuidade', 'genero')),
  genre text,
  line_limit int not null default 30 check (line_limit between 1 and 60),
  min_lines int not null default 0,
  max_score numeric not null default 1000 check (max_score > 0),
  official_mirror_md text,
  year int,
  source text not null default 'admin' check (source in ('oficial', 'admin')),
  is_published boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger essay_themes_updated_at before update on public.essay_themes for each row execute function public.set_updated_at();

-- Temas oficiais da redação do ENEM (só o título; os textos motivadores são do INEP: o admin pode colar).
insert into public.essay_themes (kind, title, year, source, line_limit, min_lines, max_score, prompt_md) select 'enem', t, y, 'oficial', 30, 8, 1000,
  'A partir da leitura dos textos motivadores e com base nos conhecimentos construídos ao longo de sua formação, redija texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa sobre o tema "' || t || '", apresentando proposta de intervenção que respeite os direitos humanos. Selecione, organize e relacione, de forma coerente e coesa, argumentos e fatos para defesa de seu ponto de vista.'
from (values
  ('Perspectivas acerca do envelhecimento na sociedade brasileira', 2025),
  ('Desafios para a valorização da herança africana no Brasil', 2024),
  ('Desafios para o enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil', 2023),
  ('Desafios para a valorização de comunidades e povos tradicionais no Brasil', 2022),
  ('Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil', 2021),
  ('O estigma associado às doenças mentais na sociedade brasileira', 2020),
  ('Democratização do acesso ao cinema no Brasil', 2019),
  ('Manipulação do comportamento do usuário pelo controle de dados na internet', 2018),
  ('Desafios para a formação educacional de surdos no Brasil', 2017),
  ('Caminhos para combater a intolerância religiosa no Brasil', 2016),
  ('A persistência da violência contra a mulher na sociedade brasileira', 2015),
  ('Publicidade infantil em questão no Brasil', 2014),
  ('Efeitos da implantação da Lei Seca no Brasil', 2013),
  ('O movimento imigratório para o Brasil no século XXI', 2012),
  ('Viver em rede no século XXI: os limites entre o público e o privado', 2011),
  ('O trabalho na construção da dignidade humana', 2010),
  ('O indivíduo frente à ética nacional', 2009)
) as v(t, y);

-- Propostas de prática no formato CPT UFPR 2027 (textos-base escritos para o app, não são questões oficiais).
insert into public.essay_themes (kind, title, task_type, genre, line_limit, max_score, source, prompt_md, support_texts_md) values
('ufpr', 'Resumo: o uso de celulares nas escolas', 'resumo', null, 15, 25, 'admin',
 'Leia o texto de apoio e escreva um **resumo** de até 15 linhas, em terceira pessoa, que apresente a questão discutida, os argumentos a favor e contra e a conclusão do autor. Não copie frases do texto.',
 'Nos últimos anos, várias redes de ensino passaram a restringir o uso de celulares em sala de aula. Defensores da medida afirmam que o aparelho dispersa a atenção, prejudica a socialização no recreio e expõe estudantes a cyberbullying. Críticos lembram que o celular pode ser ferramenta pedagógica — para pesquisa, gravação de experimentos e acessibilidade — e que proibir não ensina o uso responsável. O autor conclui que a restrição faz sentido como regra geral, desde que acompanhada de momentos planejados de uso pedagógico e de educação digital.'),
('ufpr', 'Carta do leitor sobre transporte público', 'genero', 'carta do leitor', 15, 25, 'admin',
 'Você leu uma reportagem sobre o aumento da tarifa de ônibus na sua cidade. Escreva uma **carta do leitor** (até 15 linhas) ao jornal, posicionando-se sobre o tema com dois argumentos. **Não se identifique**: assine apenas como "Leitor(a)".',
 'Reportagem (trecho): a tarifa passará de R$ 5,50 para R$ 6,20. A prefeitura alega aumento do diesel; usuários reclamam de ônibus lotados e intervalos longos nos bairros mais afastados.'),
('ufpr', 'Análise de dados: tempo de tela de adolescentes', 'analise_dados', null, 5, 15, 'admin',
 'Com base na tabela, escreva um texto de até **5 linhas** que descreva a tendência principal dos dados e uma comparação relevante entre as faixas etárias.',
 '| Idade | Horas por dia em telas (2019) | Horas por dia em telas (2024) |\n|---|---|---|\n| 12–13 | 3,1 | 4,6 |\n| 14–15 | 4,0 | 5,7 |\n| 16–17 | 4,8 | 6,1 |');

-- ---------------------------------------------------------------- redações e versões
create table public.essays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  theme_id uuid not null references public.essay_themes (id) on delete restrict,
  kind text not null check (kind in ('enem', 'ufpr')),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  current_version_id uuid,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index essays_user on public.essays (user_id, updated_at desc);
create trigger essays_updated_at before update on public.essays for each row execute function public.set_updated_at();

-- Append-only (exceto compactação do rascunho recente do MESMO aparelho). Nunca se apaga uma versão.
create table public.essay_versions (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null references public.essays (id) on delete cascade,
  content text not null check (length(content) <= 12000),
  source text not null default 'typed' check (source in ('typed', 'photo')),
  is_submission boolean not null default false,
  client_ts bigint not null,
  device text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index essay_versions_essay on public.essay_versions (essay_id, created_at desc);
alter table public.essays add constraint essays_current_version_fk
  foreign key (current_version_id) references public.essay_versions (id) on delete set null;

-- ---------------------------------------------------------------- IA: fila de trabalhos + cota
create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('essay', 'discursive', 'transcribe')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  ref jsonb not null default '{}'::jsonb,
  error text,
  attempts int not null default 0,
  model text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index ai_jobs_user_day on public.ai_jobs (user_id, created_at desc);

create table public.essay_corrections (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null references public.essays (id) on delete cascade,
  version_id uuid not null references public.essay_versions (id) on delete cascade,
  job_id uuid references public.ai_jobs (id) on delete set null,
  rubric_id uuid references public.rubrics (id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  scores jsonb,
  total numeric,
  max_total numeric,
  feedback jsonb,
  model text,
  error text,
  admin_comment text,
  admin_comment_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index essay_corrections_essay on public.essay_corrections (essay_id, created_at desc);

-- correção IA de discursivas de simulados/treinos (lote por tentativa)
create table public.discursive_feedback (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  job_id uuid references public.ai_jobs (id) on delete set null,
  score numeric,
  max_score numeric,
  feedback jsonb,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- ---------------------------------------------------------------- RLS
alter table public.rubrics enable row level security;
alter table public.essay_themes enable row level security;
alter table public.essays enable row level security;
alter table public.essay_versions enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.essay_corrections enable row level security;
alter table public.discursive_feedback enable row level security;

create policy rubrics_select on public.rubrics for select to authenticated using (public.is_active_user());
create policy rubrics_admin on public.rubrics for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy themes_select on public.essay_themes for select to authenticated using (public.is_active_user() and (is_published or public.is_admin()));
create policy themes_admin on public.essay_themes for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy essays_select_own on public.essays for select to authenticated using (user_id = auth.uid() and public.is_active_user());
create policy essays_select_admin on public.essays for select to authenticated using (public.is_admin());
create policy versions_select_own on public.essay_versions for select to authenticated
  using (exists (select 1 from public.essays e where e.id = essay_id and e.user_id = auth.uid()));
create policy versions_select_admin on public.essay_versions for select to authenticated using (public.is_admin());

create policy ai_jobs_select_own on public.ai_jobs for select to authenticated using (user_id = auth.uid());
create policy ai_jobs_select_admin on public.ai_jobs for select to authenticated using (public.is_admin());

create policy corrections_select_own on public.essay_corrections for select to authenticated
  using (exists (select 1 from public.essays e where e.id = essay_id and e.user_id = auth.uid()));
create policy corrections_select_admin on public.essay_corrections for select to authenticated using (public.is_admin());
-- admin só pode alterar o comentário humano
create policy corrections_admin_comment on public.essay_corrections for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke update on public.essay_corrections from authenticated;
grant update (admin_comment, admin_comment_at) on public.essay_corrections to authenticated;

create policy discursive_feedback_select_own on public.discursive_feedback for select to authenticated
  using (exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = auth.uid()));
create policy discursive_feedback_select_admin on public.discursive_feedback for select to authenticated using (public.is_admin());

insert into public.settings (key, value, description) values
  ('enem_score_bands', '{"linguagens":[300,800],"humanas":[300,820],"natureza":[300,850],"matematica":[330,950]}', 'Faixas para a estimativa linear de nota ENEM por área (não é TRI)')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- RPCs do aluno
create or replace function public.start_essay(p_theme uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_kind text;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'permission denied' using errcode = '42501'; end if;
  select kind into v_kind from public.essay_themes where id = p_theme and is_published;
  if v_kind is null then raise exception 'tema não encontrado'; end if;
  -- reaproveita rascunho aberto do mesmo tema
  select id into v_id from public.essays where user_id = auth.uid() and theme_id = p_theme and status = 'draft' order by updated_at desc limit 1;
  if v_id is null then
    insert into public.essays (user_id, theme_id, kind) values (auth.uid(), p_theme, v_kind) returning id into v_id;
  end if;
  return v_id;
end $$;

-- Salva rascunho. Regras para NUNCA perder texto:
--  • mesmo aparelho/origem, última versão (não enviada) com < 2 min e sem grande remoção → atualiza (compactação);
--  • senão → nova versão;
--  • "atual" = versão com maior client_ts; uma escrita mais antiga (outro aparelho offline) vira versão
--    no histórico, mas não substitui a atual.
create or replace function public.save_essay_draft(p_essay uuid, p_content text, p_client_ts bigint, p_device text default null, p_source text default 'typed')
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.essays; cur public.essay_versions; last public.essay_versions; v_id uuid; made_current boolean := false;
begin
  select * into e from public.essays where id = p_essay and user_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if e.status <> 'draft' then raise exception 'essay_submitted'; end if;
  if length(p_content) > 12000 then raise exception 'texto longo demais'; end if;
  if p_source not in ('typed', 'photo') then raise exception 'origem inválida'; end if;

  select * into cur from public.essay_versions where id = e.current_version_id;
  select * into last from public.essay_versions where essay_id = e.id order by created_at desc limit 1;

  if cur.id is not null and cur.content = p_content then
    return jsonb_build_object('version_id', cur.id, 'current', true, 'server_now', public.server_time_ms());
  end if;

  -- Compacta só "continuação de digitação": mesmo aparelho, mesma origem, < 2 min, e sem apagar mais
  -- da metade do texto. Trocar o texto (foto, colar outro, apagar muito) sempre gera versão nova.
  if last.id is not null and not last.is_submission and coalesce(last.device, '') = coalesce(p_device, '')
     and last.source = p_source and length(p_content) * 2 >= length(last.content)
     and last.created_at > now() - interval '2 minutes' and p_client_ts >= last.client_ts and last.id = e.current_version_id then
    update public.essay_versions set content = p_content, client_ts = p_client_ts, source = p_source, updated_at = now() where id = last.id;
    v_id := last.id;
  else
    insert into public.essay_versions (essay_id, content, client_ts, device, source)
    values (e.id, p_content, p_client_ts, left(p_device, 40), p_source) returning id into v_id;
  end if;

  if cur.id is null or p_client_ts >= cur.client_ts then
    update public.essays set current_version_id = v_id where id = e.id;
    made_current := true;
  end if;
  return jsonb_build_object('version_id', v_id, 'current', made_current or v_id = e.current_version_id, 'server_now', public.server_time_ms());
end $$;

-- Restaura uma versão antiga como nova versão atual (o histórico continua intacto).
create or replace function public.restore_essay_version(p_essay uuid, p_version uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare e public.essays; v public.essay_versions; v_id uuid;
begin
  select * into e from public.essays where id = p_essay and user_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if e.status <> 'draft' then raise exception 'essay_submitted'; end if;
  select * into v from public.essay_versions where id = p_version and essay_id = e.id;
  if not found then raise exception 'versão não encontrada'; end if;
  insert into public.essay_versions (essay_id, content, client_ts, device, source)
  values (e.id, v.content, public.server_time_ms(), 'restauração', v.source) returning id into v_id;
  update public.essays set current_version_id = v_id where id = e.id;
  return v_id;
end $$;

-- Cota diária de IA (por aluno, dia em America/Sao_Paulo). Falhas não consomem cota. Admin sem limite.
create or replace function public.ai_quota()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'limit', coalesce((select (value #>> '{}')::int from public.settings where key = 'ai_daily_limit_per_student'), 5),
    'used', (select count(*)::int from public.ai_jobs j
             where j.user_id = auth.uid() and j.status <> 'failed'
               and (j.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date),
    'unlimited', public.is_admin());
$$;

create or replace function public._reserve_ai_job(p_kind text, p_ref jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare q jsonb := public.ai_quota(); v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || auth.uid()::text));
  q := public.ai_quota();
  if not (q ->> 'unlimited')::boolean and (q ->> 'used')::int >= (q ->> 'limit')::int then
    raise exception 'quota_exceeded';
  end if;
  insert into public.ai_jobs (user_id, kind, ref) values (auth.uid(), p_kind, p_ref) returning id into v_id;
  return v_id;
end $$;

-- Envia a redação: congela a versão atual como submissão e reserva um trabalho de IA (cota).
create or replace function public.submit_essay(p_essay uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.essays; cur public.essay_versions; v_sub uuid; v_job uuid; v_corr uuid; v_rubric uuid;
begin
  if not public.is_active_user() then raise exception 'permission denied' using errcode = '42501'; end if;
  select * into e from public.essays where id = p_essay and user_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  select * into cur from public.essay_versions where id = e.current_version_id;
  if cur.id is null or length(trim(cur.content)) < 20 then raise exception 'texto_vazio'; end if;
  v_job := public._reserve_ai_job('essay', jsonb_build_object('essay_id', e.id));
  insert into public.essay_versions (essay_id, content, client_ts, device, source, is_submission)
  values (e.id, cur.content, public.server_time_ms(), cur.device, cur.source, true) returning id into v_sub;
  select id into v_rubric from public.rubrics where kind = e.kind and is_active;
  insert into public.essay_corrections (essay_id, version_id, job_id, rubric_id) values (e.id, v_sub, v_job, v_rubric) returning id into v_corr;
  update public.ai_jobs set ref = ref || jsonb_build_object('correction_id', v_corr, 'version_id', v_sub) where id = v_job;
  update public.essays set status = 'submitted', submitted_at = now(), current_version_id = v_sub where id = e.id;
  return jsonb_build_object('job_id', v_job, 'correction_id', v_corr);
end $$;

-- Reabre como rascunho para reescrever (nova rodada de correção depois). Histórico mantido.
create or replace function public.reopen_essay(p_essay uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.essays set status = 'draft' where id = p_essay and user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
end $$;

-- Correção em lote das discursivas de uma tentativa encerrada (ou de treino): 1 trabalho = 1 cota.
create or replace function public.request_discursive_feedback(p_attempt uuid, p_questions uuid[] default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts; v_job uuid; n int;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  if not (a.status in ('finished', 'expired') or a.mode in ('treino', 'revisao')) then raise exception 'tentativa em andamento'; end if;
  select count(*) into n from public.attempt_answers aa join public.questions q on q.id = aa.question_id
   where aa.attempt_id = a.id and q.kind = 'discursive' and coalesce(trim(aa.discursive_text), '') <> ''
     and (p_questions is null or aa.question_id = any (p_questions));
  if n = 0 then raise exception 'sem_respostas'; end if;
  v_job := public._reserve_ai_job('discursive', jsonb_build_object('attempt_id', a.id, 'questions', to_jsonb(p_questions)));
  return v_job;
end $$;

create or replace function public.reserve_transcription()
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_user() then raise exception 'permission denied' using errcode = '42501'; end if;
  return public._reserve_ai_job('transcribe', '{}'::jsonb);
end $$;

revoke execute on function public._reserve_ai_job(text, jsonb) from public, anon, authenticated;
revoke execute on function public.start_essay(uuid), public.save_essay_draft(uuid, text, bigint, text, text),
  public.restore_essay_version(uuid, uuid), public.ai_quota(), public.submit_essay(uuid), public.reopen_essay(uuid),
  public.request_discursive_feedback(uuid, uuid[]), public.reserve_transcription() from public, anon;
grant execute on function public.start_essay(uuid), public.save_essay_draft(uuid, text, bigint, text, text),
  public.restore_essay_version(uuid, uuid), public.ai_quota(), public.submit_essay(uuid), public.reopen_essay(uuid),
  public.request_discursive_feedback(uuid, uuid[]), public.reserve_transcription() to authenticated;
