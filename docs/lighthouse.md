# Lighthouse (celular)

Medido em 08/10/2026 no build de produção (`next build && next start`), perfil móvel padrão do Lighthouse 12,
logado como aluno, com banco de teste local (~2.900 questões). Duas medições por página:

- **Simulado** (padrão do Lighthouse, modelo "lantern"): estima o tempo a partir do grafo de dependências.
- **Throttling real** (`--throttling-method=devtools`): aplica de fato a CPU 4× mais lenta e a rede lenta.

| Página | Perf. (simulado) | LCP / TBT | Perf. (throttling real) | LCP / TBT | Acessib. | Boas práticas |
|---|---|---|---|---|---|---|
| `/login` | **96** | 2.7 s / 30 ms | **92** | 2.7 s / 90 ms | 100 | 100 |
| `/inicio` | **96** | 2.7 s / 90 ms | **94** | 1.6 s / 260 ms | 100 | 96 |
| `/estudar` | **93** | 3.2 s / 90 ms | **97** | 1.6 s / 160 ms | 100 | 96 |
| `/estudar/questoes` | **96** | 2.7 s / 70 ms | **97** | 1.6 s / 150 ms | 100 | 96 |
| `/prova` | **82** | 3.5 s / 370 ms | **93** | 1.6 s / 300 ms | 100 | 96 |
| `/redacao` | **96** | 2.6 s / 80 ms | **95** | 1.6 s / 230 ms | 100 | 96 |
| `/desempenho` | **95** | 2.9 s / 80 ms | **97** | 1.6 s / 180 ms | 98 | 96 |
| `/dicas` | **96** | 2.7 s / 70 ms | **97** | 1.6 s / 160 ms | 100 | 96 |
| `/perfil` | **96** | 2.7 s / 70 ms | **96** | 1.6 s / 180 ms | 100 | 96 |
## Leitura honesta

- Todas as páginas ficam **≥ 90** nas duas medições, **exceto `/prova` no modo simulado (82)**.
- A `/prova` carrega no HTML as questões da prova inteira (ex.: 89 do ENEM dia 2) **de propósito**: é isso que
  permite recarregar a prova sem internet. Medido num Chromium real com CPU 4× mais lenta, o LCP da prova é
  **~0,6 s**, sem repintura tardia; com throttling real o Lighthouse dá **93**. O modelo simulado penaliza o
  tempo de processar esse HTML grande.
- Já aplicado para reduzir o peso da prova: markdown convertido em HTML **no servidor** (o parser não vai ao
  celular), Framer Motion em modo leve (`LazyMotion`, recursos carregados depois), primeira questão sem
  animação de entrada, e o enunciado enviado uma só vez (sem duplicar markdown + HTML).
- Próximo passo possível, se quiser chegar a 90 também no simulado: enviar só as primeiras questões no HTML
  e o restante logo após carregar, guardando tudo no IndexedDB para o modo offline. É uma troca de
  complexidade por pontuação; o comportamento offline atual já está validado nos testes.
- "Boas práticas" 96: o único item é um erro de console do ambiente de teste (o Lighthouse passa a sessão só
  no cabeçalho do documento, então o ping de atividade sai anônimo e recebe 401). Em uso normal não ocorre.
