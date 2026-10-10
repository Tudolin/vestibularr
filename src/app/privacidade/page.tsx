import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade" updated="9 de outubro de 2026">
      <p>Esta Política explica como o Vestibularr (controlador: <b>[RAZÃO SOCIAL / NOME]</b>, contato do encarregado de dados: <b>[E-MAIL]</b>) trata seus dados pessoais, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
      <h2>1. Dados que coletamos</h2>
      <ul>
        <li><b>Cadastro:</b> nome, e-mail e senha (guardada de forma criptografada pelo nosso provedor de autenticação).</li>
        <li><b>Estudo:</b> respostas, simulados, redações e suas versões, metas, tempo de estudo e conquistas.</li>
        <li><b>“Sobre você” (opcional):</b> faixa de idade, gênero, tipo de escola, ano escolar, estado/cidade e como conheceu o app. Responder é opcional, toda pergunta aceita “prefiro não dizer” e você pode mudar ou apagar em Perfil → Sobre você.</li>
        <li><b>Uso e segurança:</b> registros de acesso (data, tipo de aparelho e navegador) e dados técnicos para prevenir fraude e abuso.</li>
        <li><b>Pagamento:</b> quando houver assinatura, os dados do cartão ou Pix ficam com o processador de pagamentos; nós recebemos apenas o status da assinatura.</li>
      </ul>
      <h2>2. Para que usamos</h2>
      <ul>
        <li>Prestar o serviço: salvar seu progresso, corrigir provas, gerar estatísticas e recomendações (execução de contrato).</li>
        <li>Correção por IA: o texto da redação e das respostas é enviado ao provedor de IA apenas para gerar a correção, sem seu nome ou e-mail.</li>
        <li>“Sobre você”: só em estatísticas agregadas para entender o público e melhorar o app (por exemplo, quantos alunos vêm de escola pública). Com o seu consentimento, que pode ser retirado apagando as respostas. Nunca aparece para outros alunos e não é usado para anúncios.</li>
        <li>Segurança, prevenção a fraudes e cumprimento de obrigações legais (legítimo interesse e obrigação legal).</li>
        <li>Comunicações sobre a conta e, se você permitir, novidades do produto.</li>
      </ul>
      <h2>3. Crianças e adolescentes</h2>
      <p>Muitos estudantes têm menos de 18 anos. Tratamos esses dados no melhor interesse do adolescente, coletando apenas o necessário para os estudos, e o cadastro de menores exige a autorização do responsável. O responsável pode pedir acesso, correção ou exclusão a qualquer momento.</p>
      <h2>4. Com quem compartilhamos</h2>
      <p>Somente com operadores necessários ao serviço: hospedagem e banco de dados (Supabase/Vercel), provedor de IA (Google Gemini), proteção anti-robô (Cloudflare) e processador de pagamentos. Não vendemos seus dados.</p>
      <h2>5. Seus direitos</h2>
      <p>Você pode pedir confirmação de tratamento, acesso, correção, portabilidade, anonimização ou exclusão dos seus dados e revogar consentimentos, escrevendo para <b>[E-MAIL]</b>. Ao excluir a conta, apagamos seus dados de estudo, salvo o que a lei exigir guardar.</p>
      <h2>6. Retenção e segurança</h2>
      <p>Mantemos os dados enquanto a conta estiver ativa. Usamos conexão criptografada, controle de acesso por usuário no banco de dados e chaves de serviço apenas no servidor.</p>
      <h2>7. Cookies</h2>
      <p>Usamos apenas cookies essenciais para manter você logado e armazenamento local do navegador para salvar o progresso offline. Não usamos cookies de publicidade.</p>
    </LegalPage>
  );
}
