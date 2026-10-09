# Plano de produto: Vestibularr comercial

Objetivo: transformar o app familiar em produto. Ele terá:
- uma vitrine pública com "Comece grátis";
- planos baratos;
- recursos de IA (correção de redação e um tutor próprio para tirar dúvidas);
- estudo offline em EPUB/PDF (Kindle e tablets).

Status: **plano, ainda sem código**. A execução começa às 15:30, pela Fase A.

---

## 0. Antes de vender: riscos e pré-requisitos (não é código, mas bloqueia a venda)

| Item | Situação hoje | O que fazer |
|---|---|---|
| **Hospedagem** | Vercel **Hobby**, que **proíbe uso comercial** | Migrar para o Vercel Pro (US$ 20/mês) antes da primeira cobrança |
| **Banco** | Supabase Free (pausa por inatividade; 500 MB) | Supabase Pro (US$ 25/mês) quando houver usuários pagantes; backups diários |
| **IA** | Gemini no plano gratuito (os dados podem ser usados para treino; limite baixo) | Plano pago do Gemini (pré-pago) para usuários pagantes; o custo por uso é de centavos (ver §4) |
| **Conteúdo** | Provas do INEP (documento público) + textos e imagens de terceiros dentro das questões (charges, poemas) + dados do enem.dev/maritaca | Consultar um advogado sobre o uso comercial. Mitigação: citar a fonte em cada questão (já fazemos), não vender "a prova", e sim a plataforma, as resoluções (que são nossas) e a IA; ter um canal de remoção (takedown) |
| **LGPD** | Não há termos nem política | Termos de Uso, Política de Privacidade, consentimento para menores (o vestibulando costuma ter 16 ou 17 anos), exclusão de conta e exportação de dados |
| **Empresa** | Sem CNPJ | MEI ou ME para emitir nota fiscal (alguns gateways aceitam CPF no começo) |

**Custo fixo estimado:** cerca de US$ 45/mês (aproximadamente R$ 250). Com o plano de R$ 9,90, o ponto de equilíbrio fica em torno de **30 assinantes**, já descontadas as taxas.

---

## 1. Planos (proposta: tudo barato, a IA é o que diferencia)

| | **Grátis** | **Estudante** — R$ 9,90/mês (R$ 79/ano) | **Pro** — R$ 19,90/mês (R$ 159/ano) | **Família** — R$ 29,90/mês |
|---|---|---|---|---|
| Banco de questões + resoluções | ✅ ilimitado | ✅ | ✅ | ✅ |
| Simulados por prova (cronômetro, offline) | 1 por mês | ilimitado | ilimitado | ilimitado |
| Treino, caderno de erros, desempenho | ✅ | ✅ | ✅ | ✅ |
| Correção de redação por IA | 1 por semana | 3 por semana | 2 por dia | Pro × 4 contas |
| **Tutor IA** (tirar dúvidas) | 5 mensagens/dia | 40 mensagens/dia | 150 mensagens/dia + modelo melhor | Pro × 4 |
| Exportar EPUB/PDF | 5 por mês (até 20 questões cada) | 10 por mês | ilimitado | ilimitado |
| Cartão-resposta (prova feita no papel ou Kindle) | ✅ | ✅ | ✅ | ✅ |
| Plano de estudos personalizado (IA) | — | — | ✅ | ✅ |
| Contas | 1 | 1 | 1 | até 4 (por convite, que já existe) |

- Teste grátis de 7 dias do Pro no cadastro, sem cartão.
- Os limites ficam em uma **tabela** (`plan_limits`), não no código: dá para ajustar sem deploy e criar um "limite personalizado" para um usuário específico.

---

## 2. Arquitetura (o que muda no app)

### 2.1 Modelo de dados (novas migrations)
```
plans(code pk, name, price_cents, interval, is_public)            -- free, estudante, pro, familia
plan_limits(plan_code, feature, period, quota)                    -- feature: essay_ai | tutor_msg | export | simulado | study_plan
user_limit_overrides(user_id, feature, period, quota)             -- limite personalizado por usuário (admin)
subscriptions(user_id, plan_code, status, provider, provider_sub_id, current_period_end, trial_end, family_owner_id)
usage_events(user_id, feature, at, units, meta)                    -- substitui/generaliza ai_jobs como contador
billing_events(provider, event_id unique, payload, processed_at)  -- webhooks idempotentes
```
- Uma função `entitlement(user, feature)` retorna `{quota, used, remaining, period_end}` e é usada **no servidor e na RLS/RPC**. O cliente nunca decide o limite.
- A cota diária de IA que existe hoje (`_reserve_ai_job`) passa a ler `entitlement(...)` (com o mesmo lock consultivo e a mesma regra de que falhas não contam).
- Papéis: `profiles.role` continua `admin` ou `student`. "Admin" passa a ser **o dono da plataforma**. Um plano Família tem um `family_owner_id` que convida até 3 membros, reaproveitando os convites que já existem.

### 2.2 Cadastro público ("Comece grátis")
- Hoje não há cadastro público. É preciso abrir o cadastro **com confirmação de e-mail**, **Cloudflare Turnstile** (captcha gratuito) e limite de taxa por IP.
- O trigger `handle_new_user` continua criando `student`, agora com `subscription = free` e trial do Pro por 7 dias.
- Login com Google (Supabase OAuth): opcional, mas aumenta muito a conversão.
- Onboarding em 3 passos: vestibular (ENEM, UFPR ou ambos), curso-alvo e meta diária. Depois disso, o vídeo de boas-vindas (que já existe).

### 2.3 Pagamentos
- **Recomendação: Stripe** (Checkout + Customer Portal + webhooks; aceita cartão e **Pix** no Brasil; o trial e o upgrade/downgrade já vêm prontos).
  - Alternativas: **Asaas** (Pix recorrente e boleto, aceita pessoa física, taxas baixas) ou **Mercado Pago** (marca conhecida, Pix).
- Fluxo: `/planos` → Server Action cria a Checkout Session → Stripe → webhook `/api/billing/webhook` (assinatura verificada, idempotente por `event_id`) → atualiza `subscriptions`.
- O "Gerenciar assinatura" abre o Customer Portal.
- Rebaixamento: no fim do período o usuário volta ao Grátis e **nada é apagado**; só os limites mudam.

---

## 3. Vitrine pública (landing) — `/` para quem não está logado
Construída com o material que já temos: o vídeo de apresentação, as capturas reais, os números e a identidade visual.

1. **Hero:** "Estude para o ENEM e a UFPR com resolução de cada questão e uma IA que tira suas dúvidas." Botões **Comece grátis** e "Ver em 2 minutos" (o vídeo).
2. **Prova social e números:** 1.088 questões resolvidas, simulados no tempo oficial, funciona offline.
3. **Recursos** (alternando texto e captura real): simulado com cronômetro no servidor, treino com resolução, caderno de erros, redação com IA, desempenho, celular/PWA, **tutor IA** e **EPUB/Kindle** (selos "novo" quando lançarem).
4. **Como funciona:** os 3 passos do vídeo.
5. **Planos:** tabela da seção 1, com alternância entre mensal e anual.
6. **FAQ:** é oficial do INEP? Funciona sem internet? Posso cancelar? Serve para a UTFPR? É seguro para menores?
7. **Rodapé:** Termos, Privacidade, contato e fontes dos dados.

Requisitos: renderização estática (SSG), Lighthouse ≥ 95, `metadata`/OpenGraph (imagem de compartilhamento), `sitemap.ts`, `robots.ts` liberando a landing e bloqueando o app, e eventos de conversão (Vercel Analytics, gratuito).

---

## 4. Tutor IA ("assistente próprio")
- **Onde aparece:**
  - (a) Botão "Tirar dúvida" em cada questão, após responder, já com o contexto: enunciado, alternativas, gabarito e a nossa resolução.
  - (b) Aba **Tutor** com chat livre sobre as matérias.
  - (c) Na redação: "por que perdi nota na C3?".
- **Como funciona:**
  - Route Handler com **streaming** (resposta aparecendo aos poucos), usando o Gemini (Flash-Lite no Grátis e no Estudante, Flash no Pro).
  - Prompt de sistema de professor: em português, socrático, sem entregar a resposta antes de o aluno tentar.
  - Histórico salvo em `tutor_threads` / `tutor_messages` (RLS: só o dono).
- **Contexto (RAG):** começar com busca textual no Postgres (FTS, que já existe) nas resoluções e dicas. Depois, `pgvector` com embeddings do Gemini para buscar "questões parecidas" e o "conteúdo que caiu em anos anteriores".
- **Custo:** cerca de 1.500 tokens por mensagem no Flash-Lite dá frações de centavo por mensagem. Mesmo o Pro (150/dia) fica abaixo de R$ 2 por usuário por mês no uso máximo.
- **Segurança:** limite por plano (`tutor_msg`), tamanho máximo de entrada, filtro de assuntos fora de escopo e aviso de que a IA pode errar.

---

## 5. Estudar por EPUB/PDF (Kindle e tablets) + cartão-resposta
- **Montar um caderno:** escolher área, assunto, ano ou prova inteira, ou "meus erros". Opções: incluir gabarito e resoluções no final e o tamanho da fonte.
- **EPUB 3** (gerado no servidor, num Route Handler):
  - XHTML por questão, imagens **embutidas** (baixadas e redimensionadas), `nav.xhtml` com índice.
  - O gabarito e as resoluções ficam num capítulo no fim, com **links de ida e volta** (Kindle e Kobo navegam bem assim).
  - Montado com `jszip` + templates próprios (sem dependência pesada) e salvo em cache no **Supabase Storage** por 7 dias.
  - Funciona com o "Enviar para o Kindle" (a Amazon aceita EPUB).
- **PDF:** página de impressão com CSS de impressão (`@page`, quebras por questão, duas colunas opcionais) + "Salvar como PDF" do navegador. Custo zero, e não precisa de Chromium no servidor (a Vercel não roda bem). Se depois for preciso gerar no servidor, usar `@react-pdf/renderer`.
- **Cartão-resposta:** cada caderno exportado recebe um código, como `VR-7K2P`. A pessoa resolve no Kindle ou no papel e depois digita as letras no app (ou fotografa o cartão, futuramente com IA). A tentativa vira um simulado normal: nota, desempenho e caderno de erros continuam funcionando.
- **Limites:** `export` por plano; até 180 questões por arquivo.

---

## 6. Ordem de execução (cada fase com commit, testes e e2e no build de produção)

| Fase | Entrega | Esforço |
|---|---|---|
| **A — 15:30** | Landing pública + "Comece grátis" (cadastro com confirmação de e-mail e Turnstile) + onboarding + Termos e Privacidade (rascunho) + tabelas `plans`/`plan_limits`/`subscriptions`/`usage_events` + `entitlement()` + **cotas atuais migradas para os planos** (todo mundo no Grátis ou em trial; o seu admin fica como "dono") | 1 sessão |
| **B** | Página `/planos`, checkout, webhook, portal, trial de 7 dias, painel do admin com assinantes e limites personalizados por usuário | 1 sessão |
| **C** | Tutor IA (dúvida na questão + aba Tutor + na redação), streaming e cotas | 1 sessão |
| **D** | Exportar EPUB e PDF + cartão-resposta | 1 sessão |
| **E** | Resoluções de 2009–2018 (para o banco ficar maior no Grátis), e-mails transacionais (Resend), SEO, analytics de funil, plano de estudos IA (Pro) | contínuo |

---

## 7. Decisões que preciso de você antes da Fase B (a Fase A não depende delas)
1. **Preços e limites** da seção 1: aprova ou ajusta?
2. **Gateway:** Stripe (recomendado), Asaas ou Mercado Pago? Vai cobrar como **pessoa física ou CNPJ**?
3. **Nome e domínio** do produto (Vestibularr? Já tem domínio?), e-mail de contato e de suporte.
4. **Plano Família:** manter? (Aproveita o seu caso de uso original.)
5. **Login com Google** na Fase A: sim ou não? (Precisa criar o OAuth no Google Cloud; eu passo o passo a passo.)
6. **Conteúdo e direitos:** confirmar que vai buscar orientação jurídica antes de cobrar (seção 0).
