import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, LEGAL_ROUTES, contactEmail, ownerLabel } from "@/lib/legal";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  const email = contactEmail();
  return (
    <>
      <h1>Termos de uso</h1>
      <p>
        Estes termos valem para o uso do {LEGAL.product}, oferecido por {ownerLabel()}. Ao criar uma
        conta, você declara que leu e concorda com eles e com a{" "}
        <Link href={LEGAL_ROUTES.privacy}>Política de privacidade</Link>.
      </p>

      <h2>1. O serviço</h2>
      <p>
        O {LEGAL.product} permite que professores criem provas, apliquem às turmas por um link e
        acompanhem respostas, correções e notas. Os alunos respondem pelo próprio celular, sem criar
        conta. O serviço está em fase inicial e pode ganhar, mudar ou perder funções.
      </p>

      <h2>2. Sua conta</h2>
      <ul>
        <li>A conta é pessoal, para professores e profissionais da educação maiores de 18 anos.</li>
        <li>Informe dados verdadeiros e mantenha sua senha em sigilo.</li>
        <li>
          Você responde pelo que for feito na sua conta. Avise-nos se suspeitar de uso indevido.
        </li>
      </ul>

      <h2>3. Dados dos alunos</h2>
      <p>
        Ao cadastrar alunos, você (ou a escola em que trabalha) é o responsável por esses dados
        perante a LGPD. Por isso, você se compromete a:
      </p>
      <ul>
        <li>
          cadastrar apenas alunos com quem tem relação educacional, com autorização da escola quando
          necessário;
        </li>
        <li>informar alunos e responsáveis sobre o uso da ferramenta nas avaliações;</li>
        <li>usar notas e respostas apenas para fins educacionais;</li>
        <li>não incluir dados além do necessário (nome e matrícula bastam).</li>
      </ul>

      <h2>4. Uso permitido</h2>
      <p>Não é permitido:</p>
      <ul>
        <li>usar o serviço para fins ilegais, discriminatórios ou que exponham alunos;</li>
        <li>tentar acessar dados de outros usuários ou burlar as regras de segurança;</li>
        <li>sobrecarregar o serviço de propósito ou copiá-lo com ferramentas automáticas;</li>
        <li>publicar conteúdo que viole direitos autorais ou de imagem de terceiros.</li>
      </ul>

      <h2>5. Seu conteúdo</h2>
      <p>
        As questões e provas que você escreve continuam sendo suas. Você nos autoriza apenas a
        armazená-las e exibi-las para operar o serviço (por exemplo, mostrar a prova aos seus
        alunos). Você garante que tem o direito de usar o material que coloca nas provas.
      </p>

      <h2>6. Correção automática e notas</h2>
      <p>
        A correção automática é uma ferramenta de apoio. Confira as notas antes de usá-las em
        registros oficiais. Questões dissertativas e casos de dúvida devem ser corrigidos por você,
        que pode revisar qualquer nota.
      </p>

      <h2>7. Disponibilidade</h2>
      <p>
        Trabalhamos para o serviço funcionar sempre, com salvamento automático das respostas, mas
        não garantimos funcionamento ininterrupto: falhas de internet, de aparelhos ou dos
        fornecedores podem acontecer. Em avaliações importantes, tenha um plano alternativo.
      </p>

      <h2>8. Preço</h2>
      <p>
        Neste momento o uso é gratuito. Se passarmos a cobrar, avisaremos com pelo menos 30 dias de
        antecedência, e nada será cobrado sem que você contrate expressamente um plano.
      </p>

      <h2>9. Responsabilidade</h2>
      <p>
        Na extensão permitida pela lei, não respondemos por prejuízos indiretos causados por
        indisponibilidade do serviço, por uso em desacordo com estes termos ou por conteúdo
        cadastrado pelos usuários. Nada nestes termos limita os direitos garantidos pelo Código de
        Defesa do Consumidor.
      </p>

      <h2>10. Encerramento</h2>
      <p>
        Você pode encerrar sua conta a qualquer momento escrevendo para{" "}
        <a href={`mailto:${email}`}>{email}</a>; antes disso, pode pedir uma cópia dos seus dados.
        Podemos suspender contas que violem estes termos, com aviso sempre que possível.
      </p>

      <h2>11. Mudanças nos termos</h2>
      <p>
        Podemos atualizar estes termos. Mudanças importantes serão avisadas por e-mail ou no painel
        antes de valerem. Se continuar usando o serviço depois disso, você concorda com a nova
        versão.
      </p>

      <h2>12. Lei aplicável</h2>
      <p>
        Estes termos seguem as leis do Brasil. Eventuais disputas serão resolvidas no foro do
        domicílio do usuário, quando consumidor.
      </p>
    </>
  );
}
