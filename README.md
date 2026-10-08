# Vestibularr

Plataforma de estudos para ENEM e Vestibular UFPR (uso familiar: 1 admin + alunos).
Next.js (App Router) · TypeScript · Tailwind · Supabase · Vercel.

Planejamento, edital UFPR 2027 e decisões: [`docs/00-planejamento.md`](docs/00-planejamento.md).
Status: **Fases 1–3 concluídas** (design system, auth, RLS; banco de questões e importação; simulados, treino, autosave offline e caderno de erros).

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

### Banco (Supabase)

1. Aplique as migrations de `supabase/migrations/` em ordem: SQL Editor do painel, ou
   `npx supabase link --project-ref <ref> && npx supabase db push`.
2. Authentication → Sign In / Providers → **desligue "Allow new users to sign up"**
   (só o admin cria contas; o app também não oferece cadastro).
3. Mantenha o refresh token com validade longa (sessão persistente).

### Aplicando migrations novas
Cada fase traz uma migration nova em `supabase/migrations/` (Fase 2: `…0002_question_bank.sql`; Fase 3: `…0003_attempts.sql`).
Aplique **só as que ainda não rodou**, em ordem. Nunca edite uma migration já aplicada.

### Primeiro admin

```bash
npm run create-admin -- voce@exemplo.com "Seu Nome" "senha-forte-aqui"
```

Depois entre em `/login` e crie os alunos em **Administração → Alunos**.

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

## Deploy na Vercel

Adicione as três variáveis acima em Project → Settings → Environment Variables
(a service-role nunca com prefixo `NEXT_PUBLIC_`). Detalhes completos na Fase 6.

> O plano gratuito do Supabase pausa projetos sem atividade por alguns dias. A Fase 6 inclui um cron de "manter vivo".
