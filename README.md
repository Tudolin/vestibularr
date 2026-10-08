# Vestibularr

Plataforma de estudos para ENEM e Vestibular UFPR (uso familiar: 1 admin + alunos).
Next.js (App Router) · TypeScript · Tailwind · Supabase · Vercel.

Planejamento, edital UFPR 2027 e decisões: [`docs/00-planejamento.md`](docs/00-planejamento.md).
Status: **Fase 1 concluída** (setup, design system, auth, papéis, RLS, admin cria alunos).

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

### Primeiro admin

```bash
npm run create-admin -- voce@exemplo.com "Seu Nome" "senha-forte-aqui"
```

Depois entre em `/login` e crie os alunos em **Administração → Alunos**.

## Testes

```bash
npm run db:test:start   # Postgres local descartável na porta 54329 (precisa dos binários do PostgreSQL)
npm test                # RLS/migrations (Postgres real) + contraste AA dos tokens
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
