/** Vídeo de apresentação (docs/video → public/guia) e capítulos, usados no modal de boas-vindas e na página Guia. */
export const GUIDE_VIDEO = "/guia/vestibularr-apresentacao-v2.mp4";
export const GUIDE_POSTER = "/guia/poster-v2.jpg";
export const GUIDE_PREF = "guide_dismissed";

export type GuideChapter = { t: number; title: string; text: string; href?: string; cta?: string };

export const GUIDE_CHAPTERS: GuideChapter[] = [
  { t: 6, title: "Por que o Vestibularr existe", text: "Sua vaga na federal não depende de quanto você pode pagar. Um app para estudar do seu jeito, onde e quando quiser." },
  { t: 13, title: "O que tem a bordo", text: "Grátis para começar, 1.088 questões oficiais do ENEM com resolução, 10 minutos por dia e IA que ajuda na redação." },
  { t: 20, title: "Descubra seu nível", text: "A triagem adaptativa estima sua nota pela TRI oficial do INEP e mostra os assuntos onde focar.", href: "/triagem", cta: "Fazer a triagem" },
  { t: 28, title: "Desafio do dia", text: "7 questões escolhidas para você, com um chefão de XP em dobro no final. Sequência de dias e escudos para os dias difíceis.", href: "/inicio", cta: "Zarpar!" },
  { t: 37, title: "Treino com resolução", text: "Marque, confirme em Responder e veja na hora: “Arr, acertou!” ou “Err… quase!”, com a resolução de cada alternativa.", href: "/estudar/personalizado?modo=treino", cta: "Fazer um treino" },
  { t: 45.5, title: "O mapa do tesouro", text: "Cada desafio leva o navio a uma ilha. Com 5 na semana, o baú abre: +100 XP e 1 escudo de sequência.", href: "/inicio", cta: "Ver o mapa" },
  { t: 54.5, title: "Simulados no tempo oficial", text: "ENEM e UFPR 2027 com cronômetro no servidor: comece no celular e termine no computador, sem perder nada.", href: "/estudar/simulados", cta: "Ver simulados" },
  { t: 62.5, title: "Saiba onde focar", text: "Acertos por área e assunto, nota estimada, distância até o seu curso e o caderno de erros que volta em 1, 3, 7, 14 e 30 dias.", href: "/desempenho", cta: "Ver desempenho" },
  { t: 70.5, title: "Redação com IA", text: "Escreva no app ou mande a foto da folha. A IA corrige pelas competências do ENEM (ou pela grade da UFPR) e ajuda na estrutura.", href: "/redacao", cta: "Escrever redação" },
  { t: 79, title: "Tripulação", text: "Amigos, tripulações e a liga da semana, de Grumete a Lenda dos Mares. Mande um vento a favor: +50% de XP por 15 minutos.", href: "/tripulacao", cta: "Abrir Tripulação" },
  { t: 88, title: "Do seu jeito", text: "Estude sem internet, baixe PDF e EPUB, use o modo foco (pomodoro, som, respiração) e receba lembretes no celular.", href: "/perfil#offline", cta: "Estudar sem internet" },
  { t: 97, title: "Grátis para começar", text: "Questões e resoluções ilimitadas para sempre. No beta, tudo liberado. Não somos cursinho: somos o app que te ajuda a chegar mais preparado." },
  { t: 104, title: "Agora é a sua vez", text: "Bora, tripulação? Faça a triagem, depois o desafio do dia, e chame os amigos para a sua tripulação.", href: "/inicio", cta: "Começar" },
];
