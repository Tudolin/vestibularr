-- Fase 6: páginas de dicas em markdown, editáveis pelo admin. Conteúdo inicial escrito para o app.

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  title text not null,
  summary text not null default '',
  category text not null default 'geral',
  body_md text not null default '',
  sort int not null default 100,
  is_published boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger tips_updated_at before update on public.tips for each row execute function public.set_updated_at();
alter table public.tips enable row level security;
create policy tips_select on public.tips for select to authenticated using (public.is_active_user() and (is_published or public.is_admin()));
create policy tips_admin on public.tips for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.tips (slug, title, summary, category, sort, body_md) values
('estrutura-redacao-enem', 'Estrutura da dissertação do ENEM', 'Introdução, desenvolvimento e conclusão com proposta de intervenção completa.', 'Redação ENEM', 10,
$md$## O que a banca espera

Um texto **dissertativo-argumentativo** em prosa, com até **30 linhas**, que defenda um ponto de vista sobre o tema e termine com uma **proposta de intervenção** que respeite os direitos humanos.

## Modelo de 4 parágrafos

1. **Introdução (3–5 linhas)**
   - Contextualize com um repertório (fato histórico, dado, lei, obra, filósofo) **ligado ao tema**.
   - Apresente a **tese**: o problema e os dois motivos que você vai discutir.
2. **Desenvolvimento 1 (7–9 linhas)** — primeiro motivo: tópico frasal → explicação → repertório → fechamento ligado ao tema.
3. **Desenvolvimento 2 (7–9 linhas)** — segundo motivo, mesma estrutura, com outro repertório.
4. **Conclusão (5–7 linhas)** — retome a tese e faça a **proposta de intervenção**.

## A proposta de intervenção (Competência 5)

Inclua os **5 elementos**:

| Elemento | Pergunta | Exemplo |
|---|---|---|
| Agente | Quem faz? | O Ministério da Saúde |
| Ação | O quê? | deve ampliar centros de convivência para idosos |
| Meio/modo | Como? | por meio de parcerias com prefeituras |
| Finalidade | Para quê? | a fim de reduzir o isolamento social |
| Detalhamento | Um detalhe a mais de qualquer elemento | — que hoje atendem só 10% dos municípios |

## Checklist antes de passar a limpo

- [ ] Título? **Não é obrigatório** no ENEM.
- [ ] O tema aparece com as palavras-chave na introdução e na conclusão.
- [ ] Cada parágrafo de desenvolvimento tem **um** repertório e **uma** ideia central.
- [ ] Conectivos entre os parágrafos (veja a página de conectivos).
- [ ] Nenhuma frase na 1ª pessoa do singular ("eu acho").
$md$),
('competencias-enem', 'As 5 competências do ENEM', 'O que cada competência avalia e como perder menos pontos.', 'Redação ENEM', 20,
$md$Cada competência vale de **0 a 200**, em degraus de 40 (0, 40, 80, 120, 160, 200). Total: 1000.

| Competência | Avalia | Para 200 |
|---|---|---|
| **C1** | Norma-padrão | No máximo 2 desvios leves; estrutura sintática excelente |
| **C2** | Tema + tipo textual + repertório | Repertório **legitimado, pertinente e produtivo**; nada de fuga ao tema |
| **C3** | Projeto de texto | Argumentos organizados, sem informação solta, com autoria |
| **C4** | Coesão | Conectivos variados entre e dentro dos parágrafos, sem repetição |
| **C5** | Proposta de intervenção | Os 5 elementos, articulados à discussão |

## Zera a redação inteira

- Fuga total ao tema ou não atender ao tipo dissertativo-argumentativo.
- Texto com **até 7 linhas**.
- Parte do texto propositalmente desconectada do tema, impropérios, desenhos.
- Folha em branco ou texto em outra língua.

> Desrespeitar os direitos humanos zera **a C5**, não a redação toda.
$md$),
('generos-ufpr', 'Gêneros e tarefas da CPT (UFPR)', 'Resumo, carta, análise de dados, continuidade: o que cada comando pede.', 'UFPR', 30,
$md$A prova de **Compreensão e Produção de Textos** da UFPR 2027 tem **2 questões**: uma de até **15 linhas (25 pontos)** e outra de até **5 linhas (15 pontos)** (Edital 50/2026, item 6.11).

## Critérios (item 6.11.2)

a) fidelidade ao que a questão propõe e leitura correta dos textos-base · b) estrutura do gênero/tipo pedido · c) organização, coesão e coerência · d) norma culta (concordância, regência, colocação, vocabulário) · e) sintaxe e pontuação · f) legibilidade e ortografia.

## Tarefas frequentes

- **Resumo**: 3ª pessoa, sem opinião, sem copiar frases; apresente o tema, os argumentos principais e a conclusão do autor. Cite o autor ("Segundo o texto…", "O autor defende…").
- **Texto expositivo**: explica um fenômeno com base nos textos; objetividade e progressão.
- **Texto argumentativo curto**: tese clara já na 1ª frase + 1 ou 2 argumentos.
- **Análise de dados/gráfico**: descreva a **tendência principal**, compare grupos/períodos com números e não invente causas que o gráfico não mostra.
- **Continuidade textual**: mantenha narrador, tempo verbal, personagens e estilo do trecho dado.
- **Gênero específico** (carta, e-mail, artigo de opinião, notícia…): respeite o formato (vocativo, despedida, título…). **Nunca assine com seu nome**: identificação zera a questão.

## Erros que zeram (6.11.4)

Em branco, a lápis, em outra língua, no espaço errado, **qualquer identificação**, fuga ao tema ou à tipologia.
$md$),
('repertorios', 'Repertórios coringa', 'Autores, conceitos e dados que servem para muitos temas — usados com pertinência.', 'Redação ENEM', 40,
$md$Repertório bom é **pertinente** (ligado ao tema) e **produtivo** (você explica a relação). Decorar sem conectar não pontua.

## Filosofia e sociologia

- **Zygmunt Bauman — modernidade líquida**: relações frágeis e efêmeras (redes sociais, consumo, trabalho).
- **Émile Durkheim — fato social / anomia**: normas coletivas; ausência delas gera desorganização.
- **Hannah Arendt — banalidade do mal**: injustiças sustentadas pela omissão de pessoas comuns.
- **Paulo Freire — educação libertadora**: educação como prática de autonomia e cidadania.
- **Pierre Bourdieu — violência simbólica**: dominação naturalizada por linguagem e cultura.

## Documentos e leis

- **Constituição de 1988**: art. 5º (igualdade), art. 6º (direitos sociais), art. 205 (educação), art. 196 (saúde), art. 230 (proteção ao idoso).
- **Estatuto da Pessoa Idosa (Lei 10.741/2003)**, **ECA (Lei 8.069/1990)**, **Lei Maria da Penha (Lei 11.340/2006)**.
- **Declaração Universal dos Direitos Humanos (1948)**.

## Literatura e cultura

- **Vidas Secas** (Graciliano Ramos): miséria, seca e desumanização.
- **Quarto de Despejo** (Carolina Maria de Jesus): fome e exclusão urbana.
- **O Cortiço** (Aluísio Azevedo): determinismo social e moradia precária.

> Antes de usar um dado numérico, confira a fonte. Na dúvida, prefira um repertório conceitual que você domina.
$md$),
('conectivos', 'Conectivos por função', 'Para coesão (C4): como ligar ideias sem repetir "além disso".', 'Redação ENEM', 50,
$md$| Função | Conectivos |
|---|---|
| Adição | além disso, ademais, outrossim, não só… mas também |
| Oposição | entretanto, contudo, no entanto, todavia, em contrapartida |
| Causa | visto que, uma vez que, porquanto, haja vista |
| Consequência | por conseguinte, consequentemente, de modo que, logo |
| Exemplificação | a exemplo de, como ilustra, é o caso de |
| Conclusão | portanto, dessa forma, assim, em suma, diante disso |
| Finalidade | a fim de, com o intuito de, para que |
| Tempo | desde então, à medida que, concomitantemente |

## Dicas

- Varie: a C4 penaliza a repetição do mesmo conectivo.
- Use conectivos **entre** parágrafos (início de cada um) e **dentro** deles.
- Referenciação também é coesão: retome termos com pronomes e sinônimos ("os idosos" → "essa parcela da população").
$md$),
('erros-comuns', 'Erros comuns de português', 'Crase, vírgula, concordância e outros desvios que mais tiram ponto.', 'Língua portuguesa', 60,
$md$## Vírgula

- **Nunca** entre sujeito e verbo: ~~"Os idosos brasileiros, enfrentam…"~~.
- Use vírgula depois de adjunto adverbial deslocado longo: "No Brasil contemporâneo, …".

## Crase

- **Antes de palavra feminina** que aceita artigo, quando o termo anterior pede "a": "assistência **à** população".
- Não use antes de verbo, de palavra masculina ou de "uma": "a partir de", "a fim de", "a uma pessoa".

## Concordância

- "**Existem** problemas" / "**Há** problemas" (haver = existir fica no singular).
- "**Faz** dez anos" (tempo decorrido, singular).

## Outros

- "Onde" só para lugar; para ideias use "em que", "no qual".
- "Mas" (oposição) ≠ "mais" (quantidade).
- Evite "a nível de", "enquanto" no sentido de "como", e o "gerundismo" ("vamos estar fazendo").
$md$),
('estrategia-de-prova', 'Estratégia de prova e gestão de tempo', 'Ordem de resolução, tempo por questão e o que fazer quando travar.', 'Estratégia', 70,
$md$## ENEM

- **Dia 1 (5h30)**: 90 questões + redação. Reserve **1h20 a 1h30 para a redação** (rascunho + passar a limpo) e cerca de **2,5 min por questão**.
- **Dia 2 (5h)**: 90 questões de Natureza e Matemática, cerca de **3 min por questão**.
- Faça primeiro as que você domina; **marque e pule** as longas (no app: tecla **M**).
- Pela TRI, acertar as fáceis pesa: não deixe questões fáceis para o fim.
- Nos últimos 30 minutos: passe o gabarito para o cartão-resposta, sem deixar para os 5 minutos finais.

## UFPR 2027 (fase única, 5h30)

- 80 objetivas + 2 discursivas no **mesmo tempo**. Sugestão: **~3 min por objetiva (4h)** e **~1h30 para a CPT**.
- Comece pela CPT se você escreve devagar: discursiva em branco **zera** e elimina.
- Disciplinas com **peso do seu curso** (Anexo XX) valem mais: priorize-as.

## Quando travar

1. Releia o comando (o que exatamente se pede?).
2. Elimine alternativas absurdas (no app: **Shift+letra** ou toque longo).
3. Chute com critério e siga: voltar depois com a cabeça fresca rende mais.
$md$);

-- busca global também nas dicas
create index tips_search on public.tips using gin (to_tsvector('portuguese', title || ' ' || summary || ' ' || body_md));
