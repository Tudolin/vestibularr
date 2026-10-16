/** Explicações dos botões "?" (HelpTip): curtas, em linguagem simples, com um exemplo quando ajuda. */
export type Help = { title: string; body: string[]; example?: string };

export const HELP = {
  tri: {
    title: "Nota pela TRI",
    body: [
      "TRI (Teoria de Resposta ao Item) é o jeito que o ENEM calcula a nota. Não conta só quantas você acertou: conta quais.",
      "Acertar as fáceis e errar as difíceis vale mais do que o contrário, porque mostra que você sabe de verdade, sem chute.",
      "Usamos os mesmos parâmetros oficiais do INEP para cada questão. Por isso a nota é uma estimativa, não a nota oficial.",
    ],
    example: "Duas pessoas acertam 30 questões. Quem acertou as fáceis e médias costuma tirar mais do que quem acertou difíceis e errou fáceis.",
  },
  triagem: {
    title: "Triagem",
    body: [
      "Um teste de cerca de 30 questões reais do ENEM que vai se ajustando a você: acertou, vem uma mais difícil; errou, uma mais fácil.",
      "No fim, você vê sua nota estimada por área e os assuntos onde vale mais a pena focar. Dá para pausar e continuar depois.",
    ],
  },
  onde_focar: {
    title: "Onde focar",
    body: [
      "Juntamos duas coisas: o quanto cada assunto cai na prova e a sua chance de errar nele.",
      "Os primeiros da lista são os que mais podem aumentar sua nota com menos esforço.",
    ],
  },
  desafio: {
    title: "Desafio do dia",
    body: [
      "Umas 7 questões rápidas escolhidas para você: algumas do seu assunto mais fraco, revisão dos erros, uma do que você já domina.",
      "A última é o chefão: a mais difícil do dia, que vale XP em dobro.",
      "Leva uns 10 minutos. Fazer todo dia é o que mantém a sequência.",
    ],
  },
  sequencia: {
    title: "Sequência",
    body: ["Quantos dias seguidos você estudou (ganhou XP pelo menos uma vez no dia). Pulou um dia sem escudo, a sequência volta a zero."],
  },
  escudo: {
    title: "Escudo de sequência",
    body: [
      "A cada 7 dias seguidos você ganha um escudo (pode guardar até 2). O baú do mapa do tesouro também dá um.",
      "Se você esquecer de estudar um dia, o escudo é gasto sozinho e sua sequência continua.",
    ],
  },
  mapa_tesouro: {
    title: "Mapa do tesouro",
    body: [
      "Cada desafio do dia que você termina leva o navio para a próxima ilha da semana.",
      "Com 5 desafios na semana, o baú abre: +100 XP e 1 escudo. Toda segunda começa um mapa novo.",
    ],
  },
  xp: {
    title: "XP",
    body: [
      "Pontos de esforço. Você ganha respondendo questões (acerto em questão difícil vale mais), terminando simulados, triagens e desafios.",
      "Errar também dá um pouquinho: o que conta é estudar. O XP define seu nível e sua posição na liga.",
    ],
  },
  liga: {
    title: "Liga da semana",
    body: [
      "Você disputa com outros estudantes do seu nível quem faz mais XP na semana. As divisões vão de Grumete a Lenda dos Mares.",
      "No fim da semana, os 7 primeiros sobem de divisão e os 5 últimos (ou quem ficou sem XP) descem.",
    ],
  },
  vento: {
    title: "Vento a favor",
    body: ["Um impulso que um amigo pode te mandar (ou você manda para ele): +50% de XP por 15 minutos. Aproveite para estudar logo em seguida."],
  },
  caderno_erros: {
    title: "Caderno de erros",
    body: [
      "Toda questão que você erra entra aqui e volta para revisão na hora certa: 1, 3, 7, 14 e 30 dias depois.",
      "Acertou na revisão, ela espaça mais; errou de novo, volta para o começo. É a forma mais eficiente de não esquecer.",
    ],
  },
  mapa_calor: {
    title: "Mapa de calor",
    body: [
      "Cada quadrado é um assunto, com a sua porcentagem de acerto: verde a partir de 70%, amarelo de 40% a 69% e vermelho abaixo de 40%.",
      "Cinza quer dizer que você respondeu poucas questões (menos de 3) daquele assunto: ainda não dá para avaliar.",
    ],
  },
  simulado_treino: {
    title: "Simulado ou treino?",
    body: [
      "Simulado: como no dia da prova. Tem tempo e o gabarito só aparece no fim.",
      "Treino: sem pressa. Você vê se acertou e a resolução logo depois de cada questão.",
    ],
  },
  // ---- admin
  ritmo: {
    title: "Ritmo de estudo",
    body: [
      "Conta em quantos dias diferentes o aluno respondeu questões nas últimas 4 semanas.",
      "Constante: 12 dias ou mais. Regular: 5 a 11. Esporádico: 1 a 4. Parado: não estuda há mais de 7 dias. Não começou: nunca respondeu.",
      "Estudar um pouco todo dia vale mais do que muito num dia só: por isso o ritmo olha os dias, não a quantidade.",
    ],
  },
  atencao: {
    title: "Precisam de atenção",
    body: [
      "Alunos ativos que parecem estar se afastando: pararam há mais de 7 dias, criaram a conta há 3 dias e não começaram, estudaram pelo menos 50% menos nesta semana ou estão com acerto abaixo de 40% no mês.",
      "É um bom momento para mandar uma mensagem ou ver o painel do aluno.",
    ],
  },
  turma_fracos: {
    title: "Pontos fracos da turma",
    body: ["Assuntos com pelo menos 10 respostas nos últimos 90 dias, do menor para o maior acerto. Mostram onde vale reforçar conteúdo, dicas ou resoluções para todo mundo."],
  },
} satisfies Record<string, Help>;

export type HelpKey = keyof typeof HELP;
