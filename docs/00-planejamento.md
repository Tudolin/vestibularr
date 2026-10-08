# Vestibularr — Planejamento (pré-código)

Status: **aguardando seu OK nas dúvidas da seção 6 antes da Fase 1.**

## 1. Edital UFPR 2027 — confirmado

Fonte: Edital n.º 50/2026-NC/PROGRAP (PDF de 86 páginas, cópia hospedada no Vestibulando Web; li o texto completo localmente). Itens citados entre parênteses.

| Tema | O que o edital diz |
|---|---|
| Estrutura (6.3, 6.4) | Duas provas comuns, **aplicadas no mesmo dia e horário**: objetiva de conhecimentos gerais + discursiva de Compreensão e Produção de Textos (CPT). |
| Tempo (8.3) | Início às 14h, **duração única de 5h30min** para as duas provas. Não há tempo separado por prova. |
| Objetiva (6.7) | **80 questões, 80 pontos**, eliminatória e classificatória. **4 alternativas** (não 5), uma correta; dupla marcação conta como errada. Zero na objetiva elimina. |
| Distribuição (6.7.2) | Português 10 · Biologia 8 · Física 8 · Geografia 8 · História 8 · Matemática 8 · Química 8 · Língua Estrangeira 7 · Literatura 5 · Filosofia 5 · Sociologia 5. |
| Pesos (6.7.3) | Até **2 disciplinas específicas por curso** têm peso maior (Anexo XX): ≤5 questões → 3; 6–10 → 2,5; ≥11 → 2. Demais questões peso 1. |
| Discursiva (6.11) | **2 questões**: uma de até **15 linhas = 25 pts**, outra de até **5 linhas = 15 pts**; total **40 pts**. Eliminatória (zero elimina). Manuscrita. |
| Critérios (6.11.2) | (a) fidelidade ao comando e leitura dos textos-base; (b) domínio da estrutura do gênero/tipo; (c) organização global, coesão, coerência; (d) língua culta (concordância, regência, colocação, vocabulário); (e) estruturas sintáticas e pontuação; (f) legibilidade e ortografia. **O edital não divulga a pontuação por critério**; o NC publica depois, no espelho. |
| Zeramento (6.11.4) | Branco, lápis, não em português, espaço errado, **qualquer identificação do candidato**, impropérios, **fuga ao tema ou à tipologia**. |
| Correção (6.10.2) | Só são corrigidas as discursivas dos melhor classificados na objetiva (3× as vagas do curso). A plataforma não simula essa fila. |
| Nota (9.9) | `(Σ acertos×peso + nota discursiva) / (máx. objetiva ponderada + 40) × 1000`, escala milesimal. |
| Desempate (9.11) | Objetivas específicas → discursiva → renda → idade. |

Consequências para o modelo:
- `alternatives` precisa suportar **4 ou 5 opções** conforme o formato (ENEM = 5, UFPR 2027 = 4). Você pediu A–E; vale para o ENEM.
- O simulado UFPR 2027 usa **um cronômetro único de 5h30** para 80 objetivas + 2 CPT.
- Os critérios (a)–(f) viram a rubrica inicial da CPT, com pesos editáveis (os oficiais por critério não estão no edital).
- **Não encontrei no texto do edital a lista de obras literárias** (nenhuma ocorrência de "obras"). Notícias dizem que há lista nova; ela deve estar no programa de provas, no site do NC. Vejo em dúvida 3.
- Anexo XX (disciplinas com peso por curso) está no PDF; posso carregar como seed dos cursos UFPR.

**Alerta sobre a premissa da UTFPR:** uma fonte secundária (Blog do Vestibular) diz que a UTFPR terá **vestibular próprio em 2027** (40 objetivas + redação de 15–20 linhas, prova em 22/11/2026, inscrições até 13/10/2026), sem citar Sisu. Isso contradiz "100% via Sisu". Não confirmei no edital oficial. Dúvida 1.

Formato ENEM usado como base (conhecimento geral, sem checagem nova): dia 1 = 90 questões (45 Linguagens + 45 Humanas) + redação; dia 2 = 90 questões (45 Natureza + 45 Matemática); 5 alternativas. Tempos e datas ficam em `exam_formats.structure`, editáveis, porque o INEP muda isso.

## 2. Arquitetura

```
Browser (PWA)
 ├─ Next.js App Router (RSC + client islands)
 │   ├─ (auth)   /login
 │   ├─ (student) /inicio /estudar /simulados /redacao /desempenho /perfil /dicas
 │   └─ (admin)  /admin/**
 ├─ TanStack Query (cache servidor)  +  Zustand/estado local da prova
 ├─ IndexedDB (idb): outbox de operações + cópia local da tentativa
 └─ Service worker: shell offline, cache de assets e de questões da tentativa em curso
        │ HTTPS
Vercel Hobby (Next route handlers / server actions)
 ├─ Supabase SSR client (cookies, refresh token) — usa RLS com o JWT do usuário
 ├─ service-role client SÓ em server actions do admin (criar usuário) e jobs
 └─ Gemini (somente servidor)
        │
Supabase: Postgres (RLS) · Auth e-mail/senha · Storage (PDFs, imagens, fotos de redação)
```

Decisões e justificativas:

1. **Sem signup público.** Auth com signups desligados; o admin cria o usuário via `auth.admin.createUser` numa server action (service-role, nunca no cliente) e o trigger cria `profiles`. Usuário desativado (`profiles.is_active=false`) é barrado no middleware e nas policies.
2. **Autorização em duas camadas.** Middleware cuida de rotas; **RLS é a fonte da verdade**. Função `is_admin()` (`security definer`, `stable`) lê `profiles.role`. Conteúdo (provas, questões, temas) é leitura para autenticados e escrita só admin. Dados do aluno: `user_id = auth.uid()` ou admin.
3. **Gabarito não vaza.** `answer_keys` (gabarito, resolução, espelho discursivo) só é legível pelo aluno se ele já respondeu aquela questão e (tentativa finalizada **ou** modo treino). O feedback imediato do treino usa a RPC `check_answer(question_id, choice)`.
4. **Cronômetro no servidor.** `exam_attempts` guarda `started_at`, `deadline_at`, `paused_total_ms`, `status`. Toda resposta do servidor devolve `server_now`; o cliente calcula o offset e exibe `deadline_at - (agora + offset)`. Offline o relógio local continua, mas a verdade é reconciliada na volta. Ao fim do prazo o servidor marca `expired` na primeira escrita/leitura e rejeita respostas posteriores ao `deadline_at`.
5. **Autosave e offline.** Cada ação vira uma operação `{op_id, attempt_id, question_id, field, value, client_ts}` gravada primeiro no IndexedDB (outbox) e enviada com debounce de ~2 s, ao trocar de questão e ao reconectar (evento `online` + Background Sync quando disponível). O servidor aplica via RPC `apply_attempt_ops(jsonb)`: idempotente por `op_id`, **última escrita por campo** comparando `client_ts` com `field_ts` guardado (jsonb por campo em `attempt_answers`). Indicador Salvo/Salvando/Offline lê o tamanho da outbox.
6. **Redação nunca perde texto.** `essay_versions` é append-only: cada autosave com conteúdo diferente cria versão (com compactação: no máx. 1 versão a cada N s, mais versões marcadas "envio"). `essays.content` é só o ponteiro para a mais recente. Conflito entre dispositivos: vence o `client_ts` maior, e a outra versão continua no histórico, com opção de restaurar.
7. **IA dentro do limite da Vercel Hobby.** Correção é **assíncrona**: `POST /api/corrections` valida cota, cria `ai_jobs(status=queued)` e responde 202; o trabalho roda em `after()` (Next) com `maxDuration` no teto do plano; a UI acompanha por polling do TanStack Query (ou Supabase Realtime). Falhou o parse do Zod → 1 nova tentativa com o erro no prompt → então `failed` com opção de reenviar. *Precisa checar o teto de duração e o suporte a `after()` na Hobby no momento do deploy; se for curto, quebro em etapas (transcrição / correção) como jobs separados.*
8. **Cota de IA.** Tabela `settings` (chave/valor, editável pelo admin) com `ai_daily_limit_per_student`; contagem por `ai_jobs` do dia (fuso America/Sao_Paulo). Modelo em `GEMINI_MODEL`.
9. **Foto de redação.** Upload ao Storage (bucket privado, policy por pasta `user_id/`), job de transcrição com Gemini, aluno revisa e só então vira `essay_version`.
10. **Notas.** Pontuação em `lib/scoring/` com funções puras e testadas: UFPR (fórmula 9.9), ENEM por área, nota ponderada Sisu. TRI real não é reproduzível sem os parâmetros do INEP; a estimativa será uma **aproximação declarada** (ver dúvida 6) e a UI sempre avisa.
11. **Busca global.** Postgres full-text (`tsvector` + `pg_trgm`, config `portuguese`) em questões, temas e dicas. Sem serviço externo.
12. **Atenção operacional:** o plano gratuito do Supabase **pausa projetos inativos** (hoje, depois de ~1 semana sem uso — conferir). Mitigação: cron diário da Vercel batendo num endpoint leve; documentado no README.

## 3. Modelo de dados

Mudanças em relação à sua lista, com motivo:

| Mudança | Motivo |
|---|---|
| `exam_formats.structure jsonb` | Seções, nº de questões, nº de alternativas, tempo e pontuação ficam em dados versionados; novo formato = novo registro, sem deploy. |
| `exam_questions` (nova) | Liga prova ↔ questão com posição, seção e peso. Uma questão pode servir a simulado e treino. |
| `exam_sections` não criada | Cabe em `structure` + `exam_questions.section`. |
| `answer_keys` separada de `questions` | Protege gabarito por RLS (decisão 3). Guarda gabarito, resolução e espelho discursivo. |
| `essay_themes` ganha `kind` (`enem`/`ufpr_cpt`), `task_type`, `line_limit`, `max_score`, `support_texts`, `official_mirror` | ENEM e CPT compartilham as mesmas tabelas (`essays`, `essay_versions`, `essay_corrections`) em vez de duplicar; a rubrica muda por `kind`. |
| `rubrics` + `rubric_criteria` | Rubrica versionada; critérios com pesos, escala e descrição. Cada correção grava o `rubric_id`/versão usada. |
| `ai_jobs` (nova) | Fila assíncrona e contagem de cota. |
| `attempt_ops_log` (nova, enxuta) | Idempotência por `op_id` da sincronização. |
| `course_cutoffs` (nova) | Notas de corte por curso/ano/modalidade, separadas de `courses`. |
| `settings`, `app_pages` | Cota de IA, lista de obras do ano (página editável) e afins. |

Tabelas (colunas principais; todas com `id uuid`, `created_at`, e `updated_at` quando mutáveis):

- **profiles**: `id (=auth.users.id)`, `full_name`, `role (admin|student)`, `is_active`, `target_exam_board_ids`, `target_course_ids`, `last_seen_at`, `preferences jsonb` (tema, fonte).
- **exam_boards**: `code (ENEM|UFPR)`, `name`.
- **exam_formats**: `board_id`, `code` (`UFPR_2fases_ate_2026`, `UFPR_fase_unica_2027`, `ENEM_dia1`, `ENEM_dia2`), `valid_from_year`, `valid_to_year`, `structure jsonb`.
- **exams**: `board_id`, `format_id`, `year`, `name`, `day_or_booklet`, `pdf_path`, `answer_pdf_path`, `is_published`.
- **literary_works**: `board_id`, `year_from`, `year_to`, `title`, `author`, `notes`.
- **questions**: `board_id`, `exam_id`, `number`, `kind (objective|discursive)`, `subject`, `area (linguagens|humanas|natureza|matematica|null)`, `topic`, `work_id`, `statement_md`, `images jsonb`, `source_ref`, `search tsvector`, `is_active`.
- **alternatives**: `question_id`, `label (A–E)`, `text_md`, `image`.
- **answer_keys**: `question_id (unique)`, `correct_label`, `explanation_md`, `official_mirror_md`, `max_score`.
- **exam_questions**: `exam_id`, `question_id`, `position`, `section`, `weight`.
- **exam_attempts**: `user_id`, `exam_id` (null se personalizado), `mode (simulado|treino|custom)`, `config jsonb`, `status`, `started_at`, `deadline_at`, `paused_total_ms`, `finished_at`, `current_question_id`, `last_device`, `score jsonb`.
- **attempt_answers**: `attempt_id`, `question_id`, `choice`, `discursive_text`, `flagged`, `time_spent_ms`, `strikes jsonb`, `highlights jsonb`, `field_ts jsonb`, `answered_at`. `unique(attempt_id, question_id)`.
- **error_notebook**: `user_id`, `question_id`, `source_attempt_id`, `box (1–5)`, `next_review_at`, `last_result`, `resolved_at`. Repetição espaçada: caixas de Leitner com intervalos 1/3/7/14/30 dias.
- **essay_themes**, **essays** (`user_id`, `theme_id`, `kind`, `status`, `current_version_id`), **essay_versions** (`essay_id`, `content`, `source (typed|photo)`, `client_ts`, `is_submission`, `device`), **essay_corrections** (`version_id`, `rubric_id`, `scores jsonb`, `total`, `feedback jsonb` com justificativas, trechos `[start,end]` e sugestões, `intervention_check jsonb`, `model`, `admin_comment`, `status`).
- **rubrics**, **rubric_criteria**.
- **courses**: `institution`, `name`, `campus`, `via (sisu|vestibular)`, `weights jsonb` (por área ENEM; ou disciplinas específicas UFPR + peso), `year`. **course_cutoffs**: `course_id`, `year`, `modality`, `cutoff`.
- **student_goals**: `user_id`, `kind (daily_questions|weekly_minutes|…)`, `target`, `period`.
- **study_sessions**: `user_id`, `started_at`, `ended_at`, `active_seconds` (heartbeat), `context`.
- **access_logs**: `user_id`, `event (login|page)`, `path`, `device`, `user_agent`, `at`. Insert pelo próprio usuário; leitura só admin.
- **achievements** (definições em código; tabela guarda `user_id`, `code`, `earned_at`).
- **tips**: `slug`, `title`, `body_md`, `category`, `order`, `is_published`.
- **ai_jobs**, **settings**, **attempt_ops_log** (acima).

RLS, resumindo: conteúdo → `select` autenticado, escrita `is_admin()`; dados do aluno → dono ou admin; `answer_keys` → regra da decisão 3; `access_logs` → insert do dono, select admin; todas as tabelas com `enable row level security` e sem policy padrão permissiva. Testes de RLS rodam contra Postgres real (shims de `auth.uid()`), cobrindo: aluno A não lê aluno B, aluno não escreve conteúdo, aluno não lê gabarito antes de responder, desativado não acessa.

## 4. Design system

- **Base:** shadcn/ui sobre Tailwind, tokens como variáveis CSS em `:root` e `.dark` (`next-themes`, padrão = preferência do sistema, alternância manual no Perfil e no topo).
- **Tipografia:** Plus Jakarta Sans (títulos) + Inter (texto), via `next/font` (sem requisição externa). Escala: 12/14/16/18/24/32/40. Leitura de questão com tamanho ajustável (A− / A / A+) guardado em `profiles.preferences`.
- **Forma:** raio 16 px em cards, 12 px em botões/inputs, 24 px em sheets; sombras suaves no claro, bordas sutis no escuro.
- **Toque:** alvo mínimo 44 px; alternativas em tela cheia com altura ≥ 56 px.
- **Cores:** primária índigo; semânticas acerto (verde), erro (vermelho), atenção (âmbar). Cores por área (cada uma com tom de fundo suave, tom de texto e tom sólido):

| Área | Cor base | Uso |
|---|---|---|
| Linguagens | violeta | chip, barra de progresso, mapa |
| Ciências Humanas | âmbar/laranja | idem |
| Ciências da Natureza | verde-esmeralda | idem |
| Matemática | azul | idem |

  Os valores exatos saem na Fase 1 com **verificação automática de contraste AA** (4,5:1 texto, 3:1 componentes) nos dois temas; cor nunca é o único sinal (ícone + texto no mapa de questões: respondida ✓, branco ○, revisão ⚑).
- **Movimento:** Framer Motion com micro-animações curtas (150–250 ms), respeitando `prefers-reduced-motion`.
- **Navegação:** celular = barra inferior (Início, Estudar, Redação, Desempenho, Perfil); ≥ lg = sidebar colapsável. Simulado no PC = duas colunas (questão | painel com mapa + cronômetro); no celular = tela cheia, gesto de deslizar e botão de mapa em bottom sheet.
- **Componentes base (Fase 1):** Button, Card, Badge de área, Input, Select, Tabs, Dialog/Sheet, Toast (sonner), Skeleton, EmptyState, Progress, SaveIndicator, ThemeToggle, AppShell (mobile/desktop), DataTable paginada.
- **Atalhos (simulado):** A–E (ou A–D no UFPR 2027), ←/→, M; ajuda com `?`.

## 5. Plano de fases e entregas

| Fase | Entrega | Como mostro |
|---|---|---|
| 1 | Scaffold Next+TS+Tailwind+shadcn, tema, AppShell, auth, papéis, migrations + RLS, admin cria/edita/desativa alunos, testes de RLS | Capturas mobile/desktop claro/escuro + resultado dos testes |
| 2 | Banco de questões, importação JSON/CSV com prévia, seed ENEM, filtros paginados, busca | Capturas + contagem importada |
| 3 | Simulados, treino, autosave, retomada entre dispositivos, offline, caderno de erros | Capturas + testes de sincronização e pontuação |
| 4 | Redação ENEM, CPT UFPR, correção por IA, rubricas editáveis | Capturas (IA com respostas simuladas se não houver chave) |
| 5 | Desempenho aluno/admin, metas, gamificação, logs, cursos/Sisu | Capturas |
| 6 | Dicas, PWA, acessibilidade, Lighthouse, README, deploy | Relatório Lighthouse |

Um commit (ou poucos) por fase na branch `ccr-f16406c3-1vhua6`. Não abro PR sem você pedir.

Limite do ambiente: aqui não tenho projeto Supabase nem sua chave do Gemini. Desenvolvo contra Postgres local (testes de RLS e SQL) e deixo o app pronto para apontar para o seu projeto via `.env`. Telas que dependem de Supabase real eu valido com o que for possível e aviso o que ficou sem validar.

## 6. Dúvidas em aberto

1. **UTFPR:** a premissa "100% Sisu" pode estar desatualizada (fonte secundária fala em vestibular próprio 2027). Você quer a UTFPR como terceiro `exam_board` (vestibular próprio) além do ENEM/Sisu, ou fica só pelo Sisu? Posso conferir o edital oficial se você me passar o link.
2. **Supabase:** você já tem um projeto (região, plano)? Sem ele, desenvolvo só com Postgres local e você aplica as migrations depois.
3. **Obras literárias UFPR 2027:** não estão no edital. Você tem o link do programa de provas do NC, ou prefiro tentar achar e deixar para você validar?
4. **Seed ENEM:** minha sugestão é um dataset aberto de questões de edições anteriores do ENEM (candidatos: o projeto enem.dev e o conjunto `maritaca-ai/enem` no Hugging Face). Preciso conferir licença e se imagens vêm completas; confirma essa direção? A alternativa é você fornecer JSON/CSV.
5. **Provas antigas da UFPR:** as questões e espelhos entram pela importação do admin (sem scraping do site do NC). Você mesmo carrega, ou quer que eu prepare um formato de importação bem simples para facilitar?
6. **Nota ENEM estimada:** sem os parâmetros do INEP, proponho mapear % de acerto por área para uma faixa de nota (editável, por exemplo 300–900) e rotular como estimativa. Serve?
7. **Cronômetro UFPR:** um único relógio de 5h30 para objetivas + CPT, com sugestão (não obrigatória) de divisão. Combinado?
8. **Gemini:** qual modelo padrão (ex.: um Flash) e qual limite diário de correções por aluno você quer começar? Padrão que usarei: 5/dia.
9. **Next.js:** fixo a última versão estável no momento do scaffold. Algum motivo para travar em outra?
10. **Nome do app/idioma de marca:** "Vestibularr" mesmo (nome do repo)?
