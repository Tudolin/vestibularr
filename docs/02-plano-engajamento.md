# Plano de engajamento: triagem, plano de estudos, desafios diários e tripulação

Objetivo: fazer o aluno voltar todo dia e estudar o que mais precisa.

Status: **E1 concluída** (assunto de cada questão + habilidade e TRI oficiais do INEP + nota TRI e "Onde focar" no
Desempenho). Próxima: E2 (triagem). Pagamentos (Fase B do plano de produto) ficam por último, provavelmente com AbacatePay.
As quatro features formam um ciclo só:

```
Triagem ─► mapa de forças e fraquezas ─► Plano de estudos (até a data da prova)
   ▲                                              │
   │                                              ▼
re-triagem mensal ◄── domínio atualizado ◄── Desafio diário (10 min, streak, XP)
                                                  │
                                                  ▼
                                   Tripulação: amigos, competições, boosts
```

A peça central é um **mapa de domínio por assunto** (`skill_mastery`):
- a triagem cria o mapa;
- cada questão respondida (treino, simulado, desafio) atualiza o mapa;
- o plano e o desafio diário leem o mapa para decidir o que vem a seguir.

---

## 0. Pré-requisito: classificar as questões por assunto

Hoje as questões do ENEM só têm `area` (Linguagens, Humanas, Natureza, Matemática). Para dizer "você vai mal em
Estequiometria", cada questão precisa de **matéria → assunto → habilidade**.

| Fonte | O que dá | Custo |
|---|---|---|
| **Microdados do INEP** (arquivo de itens de cada prova) | Para cada questão: a **habilidade da Matriz de Referência** (H1–H30 por área) e os **parâmetros TRI** (discriminação, dificuldade, acerto ao acaso). São dados públicos e oficiais (a confirmar no download de cada ano) | Um script de importação |
| **IA (Gemini) + revisão por amostragem** | Matéria e assunto em português claro ("Química › Estequiometria"), a partir de uma taxonomia fixa de cerca de 150 assuntos | Centavos para as 1.088 questões; eu reviso uma amostra |

Resultado: as colunas `subject`, `topic` e `skill_code` preenchidas, e `irt_a`, `irt_b` e `irt_c` quando houver.
Com os parâmetros TRI, a triagem estima a **nota na escala do ENEM** (≈ 300–900), e não só a "% de acerto".

---

## 1. Triagem (nivelamento)

**Quando:**
- No primeiro acesso, logo depois do onboarding, aparece "Descubra seu nível (20 min)" ou "Pular, faço depois".
- Quem pular verá um lembrete na tela inicial até fazer a triagem.
- Pode refazer a cada 30 dias. A re-triagem mostra a evolução.

**Como funciona (adaptativa):**
- São cerca de 32 questões reais: 8 por área, mais 4 de UFPR se esse for o vestibular escolhido.
- Começa em dificuldade média.
  - Se acertar, vem uma mais difícil; se errar, vem uma mais fácil. É uma TRI simplificada, igual à lógica dos testes adaptativos.
  - Assim são poucas questões para uma estimativa boa.
- Sem cronômetro agressivo e sem mostrar o gabarito durante a triagem.
  - Só no fim aparece o relatório, com a resolução de cada questão.
  - Vale também um "não sei", para não forçar chute.

**Resultado (tela de relatório, compartilhável):**
- A nota estimada por área, com uma faixa de incerteza, comparada à **nota de corte do curso desejado**. A tabela `course_cutoffs` já existe.
- "Pontos fortes" e "Onde focar": os 3–5 assuntos com maior **peso na prova × lacuna**.
- O nível de cada área (Iniciante → Navegante → Capitão, com o mascote) e o ponto de partida do plano de estudos.

**Dados:**
- `diagnostic_sessions(user_id, started_at, finished_at, result jsonb)` e `diagnostic_answers`.
- `skill_mastery(user_id, topic, rating, confidence, updated_at)`. É um rating estilo Elo por assunto, atualizado em **toda** resposta do app, não só na triagem.
- A escolha das questões e o cálculo ficam no servidor (RPC). O cliente nunca vê o gabarito antes de responder, como já acontece no simulado.

---

## 2. Plano de estudos

**Entrada:**
- Data da prova: o ENEM e a UFPR vêm de uma tabela `exam_calendar` mantida pelo admin; dá para pôr uma data própria.
- Dias e horas disponíveis por semana.
- Curso desejado, que já vem do onboarding.
- O mapa de domínio.

**Algoritmo (no servidor, determinístico, sem depender de IA):**
1. A **prioridade de cada assunto** é `peso na prova × (1 − domínio) × ganho possível`.
   - O peso vem da frequência do assunto nas provas de 2019–2024; a prioridade é maior quando a nota está longe do corte.
2. Os assuntos são distribuídos nas semanas até a prova, com três fases:
   - **Base**: assuntos fracos e muito cobrados;
   - **Aprofundamento**;
   - **Reta final**: revisão e simulados.
3. Cada dia tem blocos concretos, por exemplo:
   - "Estequiometria — 12 questões (25 min)";
   - "Revisar 8 erros do caderno";
   - "Redação: tema da semana" (sábado);
   - "Simulado de 1 dia" (a cada 2–3 semanas, aumentando perto da prova).
4. **Revisão espaçada:** um assunto estudado volta em 3, 7 e 21 dias, e o que foi errado volta antes.
5. **Recalibração semanal:**
   - Se o aluno faltou, o plano se reorganiza sem acumular culpa: o atrasado é redistribuído, não vira uma pilha.
   - Se o domínio subiu, o assunto sai da prioridade.

**Onde aparece:**
- O cartão **"Hoje"** na tela inicial, com os blocos do dia e uma barra de progresso.
- A aba **Plano**, com a semana e o mês, a contagem regressiva até a prova e a "previsão de nota se seguir o plano".

**IA (opcional, plano Pro):** o tutor explica o plano ("por que estou estudando isso hoje?") e ajusta pedidos em linguagem natural ("tenho prova da escola quinta, alivia").

**Dados:** `study_plans(user_id, exam_date, weekly_hours, created_at, params)` e
`plan_items(plan_id, day, kind, topic, target, done_count, status)`.

---

## 3. Desafios diários (estilo Duolingo)

**O desafio do dia:**
- São **7 questões e cerca de 10 minutos**, escolhidas para o aluno:
  - 3 do assunto prioritário do plano;
  - 2 de revisão (erros antigos ou revisão espaçada);
  - 1 de um assunto forte, para manter;
  - 1 "chefão": mais difícil e com XP em dobro.
- É o mesmo desafio o dia todo e vira à meia-noite no horário de Brasília (o app já usa esse fuso).
- O feedback é imediato a cada questão, com a resolução e reações do mascote.

**Streak (sequência):**
- Hoje a sequência conta "estudou ≥ 1 min no dia". Passa a contar **completar o desafio diário ou a meta do plano**.
- **Escudos de sequência:**
  - protegem 1 dia perdido;
  - o aluno ganha 1 escudo a cada 7 dias seguidos, até 2 guardados;
  - não são vendidos, para não virar "pagar para ganhar".
- Marcos: 7, 30, 100 e 365 dias, com conquistas e chapéus/acessórios para o mascote do perfil.

**XP e níveis:**
- XP por acerto ponderado pela dificuldade, mais bônus por completar o desafio, terminar um simulado ou enviar redação.
- O XP só é calculado no servidor (anti-trapaça) e tem limite diário.
- O XP semanal alimenta as competições da tripulação (§4).

**Notificações:**
- **Web Push** pelo app instalado (PWA, que já temos). No iPhone, o push só funciona com o app adicionado à tela de início; o app ensina isso no momento certo.
- **E-mail** como reserva, só para lembrete de sequência.
- O aluno escolhe o horário. Há silêncio das 22h às 8h e no máximo 1 lembrete por dia.
- Tom divertido, sem culpa: "O Capitão tá te esperando no convés ⚓".
- Eventos sociais também notificam: boost recebido, pedido de amizade, resultado da competição.

**Dados:** `daily_challenges(user_id, day, question_ids, completed_at, xp)`, `xp_events`,
`push_subscriptions`, `notification_prefs`, mais um job agendado (Vercel Cron ou `pg_cron`) para enviar os lembretes.

---

## 4. Tripulação (amizades e comunidade, estilo GymRats)

**Amizades:**
- Cada aluno escolhe um **@apelido**. O nome real não é público.
- Para adicionar: link/QR de convite, busca por @apelido ou contatos do convite que já existe.
- Pedido de amizade → aceitar ou recusar. Também dá para bloquear e denunciar.

**Tripulação (grupo de estudos):**
- Até 12 pessoas, com nome, bandeira (emoji ou cor) e capitão (quem criou). Entra-se por link de convite.
- **Mural da tripulação:** atividade automática ("Ana completou o desafio 🔥 12 dias", "João fez 820 no simulado de Natureza") e reações.
- **Competições:**
  - Semanal automática: ranking de XP da tripulação, que zera na segunda.
  - Desafios criados pelo capitão: "quem fizer mais questões de Matemática até domingo".
  - Mais tarde, **tripulação × tripulação**.
- **Duelo 1×1:** as mesmas 5 questões para os dois; ganha quem acertar mais (empate: o mais rápido).

**Boosts e recompensas:**
- **Vento a favor:** o aluno manda um boost para um amigo, que ganha +50% de XP por 15 minutos. Dá para mandar 1 por dia.
- **Salva-vidas:** quando um amigo está prestes a perder a sequência, dá para mandar um empurrão (uma notificação personalizada).
- **Recompensas:** baús semanais para o top 3 da tripulação, com escudo de sequência, chapéu raro ou moldura de perfil. Tudo é cosmético ou de proteção; nada interfere no estudo.

**Segurança (muitos alunos têm menos de 18 anos):**
- **Sem chat livre na primeira versão.** Há só reações e mensagens prontas ("bora estudar!", "mandou bem!"). Isso evita assédio e o custo de moderação. Um chat moderado pode vir depois.
- Perfil visível só para amigos por padrão. Sem foto (o avatar é o mascote personalizável).
- Bloquear e denunciar em todo lugar; o admin vê as denúncias.
- A LGPD exige consentimento dos responsáveis para menores; isso já está previsto nos Termos (§0 do plano de produto).

**Dados:**
- `profiles.username`, `friendships(requester, addressee, status)`;
- `crews(id, name, flag, owner_id, invite_code)`, `crew_members(crew_id, user_id, role)`;
- `activity_events` (alimenta o mural);
- `boosts(from_user, to_user, kind, expires_at)`;
- `competitions` e `competition_scores`;
- `reports` (denúncias).

O RLS limita a leitura a amigos e membros da mesma tripulação. O mural em tempo real usa o Supabase Realtime.

---

## 5. Onde entra nos planos pagos (proposta)

| | Grátis | Estudante | Pro |
|---|---|---|---|
| Triagem | 1 a cada 60 dias | 1 a cada 30 dias | ilimitada |
| Desafio diário, sequência, XP | ✅ | ✅ | ✅ |
| Tripulação, amigos, duelos | ✅ (entrar e criar 1) | ✅ | ✅ |
| Plano de estudos | **semana atual** | plano completo | completo + ajustes com IA |
| Relatório detalhado da triagem (nota estimada por assunto) | resumo | ✅ | ✅ |

Princípio: **o lado social e o hábito são grátis**, porque trazem gente e retenção. O que se paga é a **profundidade**: o plano completo e a IA.

---

## 6. Ordem sugerida

| Etapa | Entrega | Depende de |
|---|---|---|
| **E1 — Taxonomia + domínio** | Importar habilidades e parâmetros TRI dos microdados; classificar matéria e assunto; `skill_mastery` atualizado em toda resposta; aba "Assuntos" no Desempenho | — |
| **E2 — Triagem** | Fluxo adaptativo no onboarding (com "pular"), relatório e re-triagem | E1 |
| **E3 — Desafio diário + XP + sequência + notificações** | Desafio personalizado, escudos, push e e-mail | E1 |
| **E4 — Plano de estudos** | Data da prova, gerador, cartão "Hoje", recalibração semanal | E1, E2 |
| **E5 — Tripulação** | @apelido, amizades, tripulação, mural, competição semanal, boosts e duelos | E3 (XP) |

Isso convive com as fases do plano de produto:
- a **Fase B (pagamentos)** pode vir antes ou depois;
- as features da §5 já usam a tabela de limites que existe.

---

## 7. Decisões para você

1. **Ordem:** começar por E1 → E2 (triagem), ou fazer a Fase B (pagamentos) primeiro?
2. **Chat:** concorda em começar sem chat livre (só reações e mensagens prontas) por causa dos menores de idade?
3. **Competição pública:** ligas semanais com desconhecidos (como as divisões do Duolingo) ou só entre amigos e tripulação? Recomendo só entre amigos na primeira versão.
4. **Planos:** aprova a divisão grátis/pago da §5?
5. **Notificações:** push + e-mail estão ok? (O e-mail precisa de um provedor como o Resend, com plano grátis de 3 mil por mês.)
6. **Mascote:** confirma a v5 (o seu esboço) como o personagem? Ele vai aparecer na triagem, nas reações do desafio e nos níveis.
