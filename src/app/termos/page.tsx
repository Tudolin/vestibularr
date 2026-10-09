import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function TermosPage() {
  return (
    <LegalPage title="Termos de Uso" updated="9 de outubro de 2026">
      <p>Estes Termos regem o uso do Vestibularr, plataforma de estudos para o ENEM e vestibulares, operada por <b>[RAZÃO SOCIAL / NOME]</b>, inscrita no CNPJ/CPF <b>[NÚMERO]</b>, contato <b>[E-MAIL DE SUPORTE]</b>. Ao criar uma conta, você concorda com estes Termos e com a Política de Privacidade.</p>
      <h2>1. Quem pode usar</h2>
      <p>Qualquer pessoa pode criar uma conta. Menores de 18 anos precisam da autorização do pai, mãe ou responsável legal, que responde pelo uso e por eventuais assinaturas.</p>
      <h2>2. Sua conta</h2>
      <ul>
        <li>Você é responsável por manter sua senha em sigilo e pelas atividades feitas na sua conta.</li>
        <li>A conta é pessoal; no plano Família, cada membro tem a própria conta, convidada pelo titular.</li>
        <li>Podemos suspender contas usadas para fraude, abuso dos recursos de IA, tentativa de acesso indevido ou violação destes Termos.</li>
      </ul>
      <h2>3. Planos, teste grátis e cancelamento</h2>
      <ul>
        <li>O plano Grátis não exige pagamento. Contas novas recebem 7 dias de teste do plano Pro, sem cartão; ao fim do teste, a conta volta ao Grátis automaticamente.</li>
        <li>Planos pagos são cobrados de forma recorrente (mensal ou anual) pelo meio de pagamento escolhido e podem ser cancelados a qualquer momento; o acesso segue até o fim do período já pago.</li>
        <li>Direito de arrependimento: em contratações pela internet, você pode desistir em até 7 dias da primeira cobrança, com reembolso integral (art. 49 do Código de Defesa do Consumidor).</li>
        <li>Os limites de cada plano (por exemplo, correções de redação por IA) são informados na página de planos e podem ser ajustados com aviso prévio.</li>
      </ul>
      <h2>4. Conteúdo</h2>
      <ul>
        <li>As questões vêm de provas públicas (INEP/ENEM e UFPR), com a fonte indicada em cada uma. Textos e imagens de terceiros contidos nas provas pertencem aos seus autores.</li>
        <li>As resoluções comentadas, a organização do conteúdo e o software são do Vestibularr. Não é permitido copiar em massa, revender ou redistribuir esse material.</li>
        <li>Se você é titular de algum conteúdo e quer sua remoção, escreva para <b>[E-MAIL DE SUPORTE]</b>.</li>
      </ul>
      <h2>5. Inteligência artificial</h2>
      <p>Correções de redação, notas estimadas e respostas do tutor são geradas por IA e podem conter erros. Use-as como apoio ao estudo, não como avaliação oficial. Notas estimadas não garantem aprovação nem refletem a correção oficial das bancas.</p>
      <h2>6. Disponibilidade</h2>
      <p>Trabalhamos para manter o serviço disponível e seus dados salvos, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros. Não nos responsabilizamos por resultados em provas.</p>
      <h2>7. Alterações e foro</h2>
      <p>Podemos atualizar estes Termos; mudanças relevantes serão avisadas no app ou por e-mail. Fica eleito o foro do domicílio do consumidor.</p>
    </LegalPage>
  );
}
