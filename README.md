# Vestibularr

Plataforma de estudos para ENEM e Vestibular UFPR (uso familiar: 1 admin + alunos).
Next.js (App Router) · TypeScript · Tailwind · Supabase · Vercel.

Planejamento, edital UFPR 2027 e decisões: [`docs/00-planejamento.md`](docs/00-planejamento.md).
Status: **Fases 1–6 concluídas.** Falta só colar a chave do Gemini (passo 6 do deploy).

## Setup local

```bash
npm install
cp .env.example .env.local   # preencha as chaves (abaixo)
npm run dev                  # http://localhost:3000
```

### Variáveis de ambiente

| Variável | Onde obter | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem (anon / publishable) | pública; protegida por RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (service_role) | **segredo**, só servidor. Ignora RLS |
| `GEMINI_API_KEY` | Google AI Studio → Get API key | **segredo**, só servidor. Sem ela, o app funciona e a IA fica desligada |
| `GEMINI_MODEL` | opcional | padrão `gemini-flash-lite-latest` (o mais barato); troque pelo nome que o AI Studio mostrar |

### Banco (Supabase)

1. Aplique as migrations de `supabase/migrations/` em ordem: SQL Editor do painel, ou
   `npx supabase link --project-ref <ref> && npx supabase db push`.
2. Authentication → Sign In / Providers → **desligue "Allow new users to sign up"**
   (só o admin cria contas; o app também não oferece cadastro).
3. Mantenha o refresh token com validade longa (sessão persistente).

### Aplicando migrations novas
Cada fase traz uma migration nova em `supabase/migrations/` (Fase 2: `…0002_question_bank.sql`; Fase 3: `…0003_attempts.sql`; Fase 4: `…0004_essays_ai.sql`; Fase 5: `…0005_performance.sql`; Fase 6: `…0006_tips.sql`).
Aplique **só as que ainda não rodou**, em ordem. Nunca edite uma migration já aplicada.

### Primeiro admin

```bash
npm run create-admin -- voce@exemplo.com "Seu Nome" "senha-forte-aqui"
```

Depois entre em `/login` e crie os alunos em **Administração → Alunos**: direto (você define a senha) ou por
**convite por link**. Em **Convidar**, escolha aluno ou administrador; opcionalmente, anote para quem é, trave o e-mail e
defina a validade (1–30 dias). O link `/convite/<token>` aparece **uma única vez** (o banco guarda só o hash SHA-256), vale
para **um único cadastro** e pode ser revogado. A pessoa cria nome, e-mail e senha e já entra logada. Precisa da migration `0009`.

## Produto: vitrine, cadastro e planos (Fase A)

- **Vitrine** em `/` para quem não está logado (logado vai direto para `/inicio`), com recursos, vídeo, planos e perguntas
  frequentes; **Termos** (`/termos`) e **Privacidade** (`/privacidade`) em rascunho — preencha os campos entre colchetes.
- **Cadastro público** em `/cadastro` ("Comece grátis"): nome, e-mail, senha, aceite dos termos (com aviso para menores)
  e anti-robô Cloudflare Turnstile. Toda conta nova ganha **7 dias de Pro** e passa por um **onboarding** (vestibular,
  curso-alvo e meta diária) antes do vídeo de boas-vindas.
- **Planos e limites** (migration `0010`): `plans`, `plan_limits` (limites editáveis sem deploy), `user_limit_overrides`
  (limite personalizado por usuário), `subscriptions` e `usage_events`. A função `entitlement(feature)` é a única fonte de
  verdade; a cota de correção por IA e o limite de simulados por prova já seguem o plano. A família que já usa o app
  foi migrada para o plano **Família** sem vencimento, e contas criadas pelo admin (convite ou "Novo aluno") também.
  Os valores exibidos na vitrine ficam em `src/lib/plans.ts` (um teste garante que batem com o banco).

**Configurar no Supabase** (Authentication):
1. *Sign In / Providers → Email*: ligue **Confirm email**.
2. *URL Configuration*: **Site URL** = a URL do site (ex.: `https://vestibularr.com.br`) e, em **Redirect URLs**,
   adicione `https://SEU-DOMINIO/auth/confirm` (e `http://localhost:3000/auth/confirm` para testar local).
3. (Recomendado) *Emails → Confirm signup*: troque o link por
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding` — funciona mesmo se a pessoa
   abrir o e-mail em outro aparelho. O formato padrão do Supabase também é aceito.
4. Para volume real de cadastros, configure um SMTP próprio (o envio padrão do Supabase tem limite baixo por hora).

**Variáveis novas** (`.env.local` e Vercel): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e
`TURNSTILE_SECRET_KEY` (crie um widget gratuito em Cloudflare → Turnstile; sem as chaves, o anti-robô fica desligado).

## Guia e vídeo de apresentação

- **Primeiro acesso:** todo usuário vê um vídeo de boas-vindas (2 min) até marcar **"Não mostrar novamente"**
  (salvo no perfil, vale em todos os aparelhos). Fechar sem marcar esconde só na sessão atual do navegador.
- **Aba Guia** (menu lateral e Perfil): o vídeo, capítulos que pulam para o trecho e o mesmo conteúdo em texto;
  dá para religar o vídeo ao entrar.
- O vídeo (`public/guia/vestibularr-apresentacao.mp4`) é gerado a partir de `docs/video/`: composição em HTML
  com telas reais do app, motor de animação determinístico e trilha sintetizada (sem direitos autorais):
  ```bash
  python3 docs/video/trilha.py /tmp/trilha.wav 126.2
  node docs/video/render.mjs public/guia/vestibularr-apresentacao.mp4 30 /tmp/trilha.wav
  ```
  As capturas usadas ficam em `docs/video/shots/` (geradas pelos testes e2e; não versionadas).

## Banco de questões (Fase 2)

**Seed do ENEM** (2009–2024, ~2.900 questões; 2009–2023 vêm da API pública enem.dev e 2024 do dataset `maritaca-ai/enem`, Apache-2.0; baixa na hora, não versionamos os dados):

```bash
npm run seed:enem                        # tudo (leva ~5 min por causa do limite de taxa da API)
npm run seed:enem -- --years 2022,2023   # só alguns anos
npm run seed:enem -- --out enem.json     # só baixa e valida, sem tocar no banco
```
É idempotente (rodar de novo atualiza). A API traz a **área**, mas não disciplina/assunto nem resolução comentada; a área é
derivada da posição oficial (blocos de 45 questões), porque a rotulagem da API tem erros. Questões anuladas ou ausentes
na fonte são puladas e listadas no final (alguns anos têm 1–3 a menos).
As imagens ficam hospedadas nas fontes (enem.dev e GitHub); se saírem do ar, aparecem como imagem quebrada.
**2024:** a fonte só tem a versão de inglês da língua estrangeira e a questão 124 está anulada (pulada).
**ENEM 2025:** não há dataset aberto. Opções: importar você mesmo (JSON/CSV) ou usar a extração por IA a partir do PDF oficial do INEP (planejada para depois da Fase 4, quando o Gemini estiver configurado).

**Resoluções comentadas** (ENEM 2019–2024, todas as questões válidas; versionadas em `data/resolucoes/enem-<ano>.json`;
escritas com auxílio de IA, uma por questão, resolvendo antes de olhar o gabarito e conferindo depois):

```bash
npm run seed:resolucoes                  # aplica todos os anos disponíveis
npm run seed:resolucoes -- --years 2023  # só um ano
```
Precisa das migrations `0007` e `0008`. Só grava quando o gabarito bate com o do banco (divergências e ausentes são listados).
Os arquivos também trazem **correções conferidas no PDF oficial do INEP** (cadernos 1 e 7 e gabaritos): enunciados e
alternativas que vieram truncados ou trocados da fonte, figuras recortadas do PDF (em `public/questoes/`), gabaritos errados no
enem.dev (2021: 15, 25, 38, 53, 139, 145, 152; 2022: 143) e questões anuladas (desativadas). O `seed:enem` aplica as mesmas
correções, então rodar de novo não traz os defeitos de volta nem apaga resoluções. Ordem recomendada:
`seed:enem` → `seed:resolucoes` → `seed:taxonomia`.
**2024:** a fonte numera as questões por outro caderno; conteúdo e gabarito estão corretos, só a numeração difere do caderno 1/7.

**Assuntos e TRI oficial** (migration `0011`): cada questão do ENEM 2019–2024 tem matéria e assunto
(`data/taxonomia/enem-<ano>.json`, taxonomia em `data/taxonomia/taxonomia.json`; classificados com auxílio de IA a partir das
resoluções) e os **dados oficiais do INEP** (`data/inep/enem-<ano>.json`): habilidade da Matriz de Referência (H1–H30) e os
parâmetros TRI (a, b, c) de cada item, tirados dos microdados do ENEM (`ITENS_PROVA_<ano>.csv`) e casados com as nossas
questões pelo gabarito (100% de concordância em todos os anos).

```bash
npm run seed:taxonomia                  # aplica assunto + habilidade + TRI em todos os anos
npm run seed:taxonomia -- --years 2023  # só um ano
python3 scripts/inep-itens.py <pasta>   # regenera data/inep a partir dos ITENS_PROVA_<ano>.csv dos microdados
```
Com isso, o **Desempenho** e o **Resultado** do simulado estimam a nota pela TRI (EAP, escala 500 + 100·θ) em vez da
aproximação linear, e mostram **Pontos fortes** e **Onde focar** (assuntos que mais caem × chance de errar). Os filtros de
matéria/assunto do treino e o mapa de calor passam a funcionar para o ENEM. É a base da triagem e do plano de estudos
(`docs/02-plano-engajamento.md`).

**Só questões com resolução:** com a configuração `only_solved_questions` ligada (padrão), alunos só veem e sorteiam questões
com resolução comentada (ou espelho, nas discursivas) — no banco, na busca, nos simulados, treinos e revisões. Questões de
tentativas antigas continuam visíveis no histórico. O admin vê tudo e liga/desliga em **Administração → Questões**.

**Importar provas** (admin → Importar, ou aluno → Estudar → Enviar prova, que passa pela aprovação do admin):
arquivos `.json` ou `.csv`; exemplos em `public/exemplo-importacao.json|csv`. A prévia mostra erros por questão antes de gravar.
Reimportar a mesma prova atualiza em vez de duplicar (chave: prova + número + idioma).

## Simulados e treino (Fase 3)

- **Simulado por prova** (Estudar → Simulados): prova inteira na ordem e no tempo oficial do formato
  (ENEM dia 1 = 5h30, dia 2 = 5h; UFPR 2027 = 5h30 com cronômetro único). ENEM pede o idioma (inglês/espanhol).
- **Personalizado / Treino**: filtros por vestibular, área, disciplina, assunto, quantidade e tempo. No treino o gabarito
  aparece na hora (e a questão trava). Há o **Modelo UFPR 2027** (80 objetivas por disciplina + 2 discursivas), montado
  com as disciplinas UFPR que existirem no banco.
- **Autosave**: cada ação vira uma operação gravada primeiro no IndexedDB e enviada com debounce de 2 s, ao trocar de
  questão, ao esconder a aba e ao reconectar. O servidor aplica por `op_id` (idempotente) com **última escrita por campo**.
  Indicador: Salvo / Salvando / Offline — será sincronizado.
- **Cronômetro**: o prazo é do servidor (`deadline_at`); o cliente só calcula a diferença de relógio. Avisos aos 30 e 10 min.
  Ao zerar, o servidor encerra a prova; respostas dadas antes do prazo e enviadas depois (offline) ainda contam.
- **Retomar em outro aparelho**: abre na mesma questão, com as mesmas respostas e o mesmo tempo restante.
- **Caderno de erros**: erros entram sozinhos; revisão em 1, 3, 7, 14 e 30 dias (caixas de Leitner).
- Atalhos no PC: A–E marcar, Shift+letra riscar, ←/→, M revisão, H marca-texto. No celular: deslizar, toque longo risca.

## Redação e correção por IA (Fase 4)

- **ENEM**: 17 temas oficiais (2009–2025, só o título; cole os textos motivadores em Admin → Temas se quiser).
  Correção nas 5 competências (0–200 em degraus de 40), com justificativa, trechos comentados no texto, sugestões e
  checagem dos 5 elementos da proposta de intervenção.
- **UFPR (CPT)**: propostas por tipo de tarefa (resumo, gênero, análise de dados…), limite de linhas por proposta e
  rubrica com os critérios do edital. **Os pesos de cada critério são estimativas** (o edital não os divulga); edite em Admin → Rubricas.
- **Discursivas antigas da UFPR**: treino com "Discursivas"; no resultado, "Corrigir com IA" corrige todas as respostas
  da prova numa única chamada, comparando com o espelho oficial.
- **Rascunho nunca se perde**: cada digitação vai primeiro para o IndexedDB; versões no servidor (compacta só a digitação
  contínua do mesmo aparelho; trocar o texto, colar outro ou apagar muito gera versão nova). Histórico com "Restaurar".
- **Foto da folha**: o navegador reduz a imagem, a IA transcreve sem corrigir e o aluno revisa antes de usar.
- **IA**: chamada só no servidor; resposta em JSON validada por Zod, com 1 nova tentativa mostrando o erro ao modelo.
  A correção roda depois da resposta (`after()`, até 60 s) e a tela acompanha o status. Notas são **estimativas**.
- **Cota**: `ai_daily_limit_per_student` (padrão 5/dia, fuso de São Paulo) em `settings`. Falhas não contam. Admin sem limite.

## Desempenho, metas e painel do admin (Fase 5)

- **Aluno (Desempenho)**: questões, % de acerto, sequência de dias (vale até ontem), tempo de estudo da semana,
  evolução em 8 semanas, pontos fortes/fracos, mapa de calor por assunto, média por competência da redação,
  conquistas (calculadas no servidor) e metas editáveis. Filtro ENEM / UFPR.
- **Cursos-alvo**: 62 cursos UFPR já vêm do **Anexo XX do edital 2027** (disciplinas com peso; extraídos do PDF e
  conferidos contra a regra 6.7.3.1). Cursos Sisu (ex.: UTFPR) e notas de corte são cadastrados pelo admin.
  A nota UFPR estimada aplica o seu % por disciplina às 80 questões com o peso do curso + CPT; a nota Sisu usa a
  estimativa por área + média das redações. Quando falta dado, o app diz o que falta em vez de inventar.
- **Tempo de estudo**: ping a cada 60 s com a aba visível (máx. 90 s por ping). Log de páginas: 1 registro por página a cada 10 min.
- **Admin**: visão geral por aluno (último acesso, aparelho, logins, questões, simulados, redações, metas, assuntos mais
  fracos), painel completo de cada aluno, log de acessos e cadastro de cursos/notas de corte. Filtro ENEM / UFPR em tudo.

## Testes

```bash
npm run db:test:start   # Postgres local descartável na porta 54329 (precisa dos binários do PostgreSQL)
npm test                # RLS, importação, tentativas/sincronização (Postgres real), pontuação, fila offline, contraste AA
npm run typecheck && npm run lint
```

Os testes de RLS aplicam as migrations num Postgres puro com um shim do schema `auth` do Supabase
(`supabase/tests/shim.sql`) e verificam, por papel, o que cada usuário lê e escreve.

## Design system

Vitrine em `/design` (somente em desenvolvimento). Tokens em `src/app/globals.css`;
`src/lib/contrast.test.ts` falha se algum par texto/fundo cair abaixo de AA nos temas claro e escuro.
Capturas da Fase 1 em `docs/screenshots/fase-1/`.

## Dicas, busca, PWA e acessibilidade (Fase 6)

- **Dicas** (`/dicas`): 7 páginas iniciais (estrutura da redação ENEM, competências, gêneros da CPT, repertórios,
  conectivos, erros comuns, estratégia de prova). O admin edita em Admin → Dicas, com prévia.
- **Busca global** (`/busca`, ícone de lupa): questões (texto completo em português), temas de redação e dicas.
- **PWA**: instalável (manifest + ícones), service worker com página offline. Provas, redações e páginas de estudo
  abertas recentemente **recarregam sem internet**; ao sair da conta, as páginas guardadas são apagadas.
- **Acessibilidade**: contraste AA verificado por teste, navegação por teclado, rótulos ARIA, alvos ≥ 44 px,
  `prefers-reduced-motion`, e tamanho de fonte de leitura ajustável (Perfil e tela da prova).
- **Lighthouse**: veja [`docs/lighthouse.md`](docs/lighthouse.md).

## Deploy na Vercel (passo a passo)

1. **Banco (Supabase)**: no SQL Editor, rode as migrations que ainda não rodou, **em ordem**
   (`20261008000003` → `…0004` → `…0005` → `…0006`). Em *Authentication → Sign In / Providers*,
   deixe "Allow new users to sign up" **desligado**. Em *Authentication → URL Configuration*, coloque a URL da
   Vercel em **Site URL**.
2. **Vercel**: *Add New → Project → Import* do repositório no GitHub (framework Next.js detectado).
   Se for publicar a partir desta branch, em *Settings → Git* ajuste a *Production Branch* (ou faça merge na `main`).
3. **Variáveis** (*Settings → Environment Variables*, ambiente Production):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e
   `CRON_SECRET` (um texto aleatório longo, ex.: `openssl rand -hex 32`). **Nunca** prefixe a service-role com `NEXT_PUBLIC_`.
4. **Deploy**. O `vercel.json` agenda uma chamada diária a `/api/keepalive` (protegida pelo `CRON_SECRET`),
   que impede o Supabase gratuito de pausar o projeto por inatividade.
5. **Celulares**: abra a URL e use "Instalar app" (Perfil) ou "Adicionar à Tela de Início" no iPhone.
6. **Por último, a IA**: crie a chave em *Google AI Studio → Get API key*, adicione `GEMINI_API_KEY` na Vercel
   (e, se quiser, `GEMINI_MODEL`) e faça *Redeploy*. Teste enviando uma redação. Sem a chave, tudo funciona,
   exceto correção e transcrição (o app avisa).

Custos: Vercel Hobby (uso pessoal, não comercial), Supabase Free (500 MB de banco) e Gemini no plano gratuito
(limite diário de 5 correções por aluno configurável em `settings`).

## Limitações conhecidas

- **Notas são estimativas**: ENEM por aproximação linear (não é TRI); redação e CPT corrigidas por IA;
  pesos por critério da CPT UFPR são estimados (o edital não os divulga).
- **ENEM 2025** não tem fonte aberta: importe por JSON/CSV. 2024 tem só a versão em inglês da língua estrangeira.
  Imagens das questões ficam hospedadas nas fontes (enem.dev, GitHub).
- **Arquivos**: PDFs das provas são cadastrados por link; a foto da redação é transcrita e **não fica guardada**
  (o Storage do Supabase não é usado nesta versão, por privacidade e para economizar cota).
- **Pausa no simulado**: permitida (o prazo é deslocado pelo tempo parado). Na prova real não existe pausa.
- **Lighthouse** da `/prova` no modo simulado: 82 (detalhes em `docs/lighthouse.md`).
