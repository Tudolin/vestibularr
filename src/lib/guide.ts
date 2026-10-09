/** Vídeo de apresentação (docs/video → public/guia) e capítulos, usados no modal de boas-vindas e na página Guia. */
export const GUIDE_VIDEO = "/guia/vestibularr-apresentacao.mp4";
export const GUIDE_POSTER = "/guia/poster.jpg";
export const GUIDE_PREF = "guide_dismissed";

export type GuideChapter = { t: number; title: string; text: string; href?: string; cta?: string };

export const GUIDE_CHAPTERS: GuideChapter[] = [
  { t: 7, title: "O que você encontra", text: "Questões do ENEM 2019–2024 com resolução comentada, simulados no tempo oficial, correção de redação por IA e progresso salvo sozinho — até sem internet." },
  { t: 15.5, title: "Entrar ou aceitar o convite", text: "Não há cadastro público. Entre com e-mail e senha ou abra o link de convite que o administrador mandou e crie sua senha." },
  { t: 24, title: "Seu painel do dia", text: "A tela Início mostra o que fazer hoje: continuar um simulado, revisar erros que venceram, sua sequência de dias e as metas.", href: "/inicio", cta: "Abrir Início" },
  { t: 32, title: "Escolha como estudar", text: "Simulado da prova inteira, treino com a resposta na hora, personalizado por área e assunto, e revisão do caderno de erros.", href: "/estudar", cta: "Abrir Estudar" },
  { t: 41.5, title: "Simulado sem perder nada", text: "O cronômetro roda no servidor: comece no celular e termine no computador. Cada marcação é salva sozinha e continua funcionando offline.", href: "/estudar/simulados", cta: "Ver simulados" },
  { t: 52, title: "Treino com resolução", text: "Respondeu? A correção aparece na hora, com a resolução comentada: o raciocínio, a resposta e por que as outras alternativas estão erradas.", href: "/estudar/personalizado?modo=treino", cta: "Fazer um treino" },
  { t: 62.5, title: "Caderno de erros", text: "Toda questão errada volta para revisão em 1, 3, 7, 14 e 30 dias, até você acertar de vez.", href: "/estudar/erros", cta: "Abrir caderno" },
  { t: 70, title: "Redação com correção por IA", text: "Escreva no app (o rascunho é salvo a cada palavra) ou envie a foto da folha. Receba nota e comentários por competência.", href: "/redacao", cta: "Escrever redação" },
  { t: 80, title: "Veja sua evolução", text: "Acertos por área e assunto, pontos fracos, metas da semana, conquistas e a nota estimada para o curso que você quer.", href: "/desempenho", cta: "Ver desempenho" },
  { t: 90, title: "Instale no celular", text: "No navegador do celular, toque em “Adicionar à tela inicial”. Abre rápido, em tela cheia, e a prova continua mesmo sem internet." },
  { t: 98, title: "Para quem administra", text: "Convide alunos ou outro admin por link de uso único, acompanhe cada aluno, importe provas e escolha mostrar só questões com resolução." },
  { t: 109.5, title: "Seu primeiro dia em 5 passos", text: "1) Crie sua senha pelo convite. 2) Defina meta e curso no Perfil. 3) Faça um treino de 10 questões da sua área mais fraca. 4) Leia as resoluções e revise os erros nos dias marcados. 5) Uma redação por semana e um simulado por mês.", href: "/perfil", cta: "Abrir Perfil" },
];
