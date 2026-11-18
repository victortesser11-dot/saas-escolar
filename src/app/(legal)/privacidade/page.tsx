import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, LEGAL_ROUTES, contactEmail, ownerLabel } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  const email = contactEmail();
  return (
    <>
      <h1>Política de privacidade</h1>
      <p>
        Esta política explica quais dados pessoais o {LEGAL.product} trata, para quê, com quem
        compartilha e como você pode exercer seus direitos, conforme a Lei Geral de Proteção de
        Dados (Lei 13.709/2018, LGPD).
      </p>

      <h2>1. Quem somos e qual é o nosso papel</h2>
      <p>
        O {LEGAL.product} é oferecido por {ownerLabel()}. Contato para assuntos de privacidade,
        inclusive com o encarregado de dados: <a href={`mailto:${email}`}>{email}</a>.
      </p>
      <ul>
        <li>
          <strong>Dados dos professores</strong> (conta de acesso): nós somos o{" "}
          <strong>controlador</strong>, ou seja, decidimos como esses dados são usados.
        </li>
        <li>
          <strong>Dados dos alunos</strong> (cadastrados pelo professor ou informados na prova): a
          escola ou o professor é o <strong>controlador</strong> e nós somos o{" "}
          <strong>operador</strong>. Tratamos esses dados apenas para executar o serviço, seguindo
          as instruções de quem os cadastrou.
        </li>
      </ul>

      <h2>2. Dados que tratamos</h2>
      <h3>Professores</h3>
      <ul>
        <li>Nome, e-mail e senha (guardada de forma cifrada; ninguém consegue lê-la).</li>
        <li>Se você entrar com o Google: nome, e-mail e foto informados pelo Google.</li>
        <li>Conteúdo que você cria: turmas, questões, provas, correções e notas.</li>
      </ul>
      <h3>Alunos</h3>
      <ul>
        <li>
          Nome e matrícula, cadastrados pelo professor ou digitados pelo aluno ao entrar na prova.
        </li>
        <li>
          Respostas, notas, horários de início e de envio da prova e ocorrências (por exemplo, prova
          aberta em outro aparelho).
        </li>
        <li>
          Alunos <strong>não criam conta</strong> e não informam e-mail, telefone, endereço, foto ou
          documentos.
        </li>
      </ul>
      <h3>Dados técnicos</h3>
      <ul>
        <li>
          Registros de acesso (endereço IP, data e hora, navegador), gerados pelos serviços de
          hospedagem para segurança e para cumprir o Marco Civil da Internet.
        </li>
      </ul>

      <h2>3. Para que usamos os dados e com qual base legal</h2>
      <ul>
        <li>
          <strong>Criar e manter a conta do professor e prestar o serviço</strong>: execução do
          contrato (art. 7º, V, da LGPD).
        </li>
        <li>
          <strong>Aplicar, corrigir e organizar as provas dos alunos</strong>: em nome da escola ou
          do professor, que define a base legal adequada à atividade educacional.
        </li>
        <li>
          <strong>Segurança, prevenção de fraudes e guarda de registros de acesso</strong>:
          cumprimento de obrigação legal (art. 7º, II) e legítimo interesse (art. 7º, IX).
        </li>
        <li>
          <strong>Avisos sobre a conta e sobre o serviço</strong> (confirmação de cadastro, troca de
          senha, mudanças importantes): execução do contrato.
        </li>
      </ul>
      <p>
        Não vendemos dados, não fazemos publicidade e não criamos perfis de alunos para fins
        comerciais.
      </p>

      <h2>4. Crianças e adolescentes</h2>
      <p>
        Muitos alunos são menores de idade. Por isso, coletamos o mínimo necessário para a prova
        (nome e matrícula), e os dados são usados apenas no melhor interesse do aluno, para a
        avaliação escolar (art. 14 da LGPD). Cabe à escola ou ao professor informar os alunos e seus
        responsáveis sobre o uso da ferramenta.
      </p>

      <h2>5. Com quem compartilhamos</h2>
      <p>Usamos fornecedores que tratam dados em nosso nome, sob contrato:</p>
      <ul>
        <li>
          <strong>Supabase</strong>: banco de dados e autenticação. Os dados ficam em servidores em
          São Paulo (Brasil).
        </li>
        <li>
          <strong>Vercel</strong>: hospedagem do site (processamento no Brasil, empresa nos Estados
          Unidos).
        </li>
        <li>
          <strong>Resend</strong>: envio dos e-mails de cadastro e de troca de senha (só o e-mail e
          o nome do professor).
        </li>
        <li>
          <strong>Google</strong>: apenas se você escolher entrar com sua conta Google.
        </li>
      </ul>
      <p>
        Também podemos compartilhar dados quando a lei ou uma ordem judicial exigir. Os dados de um
        professor e de seus alunos não ficam visíveis para outros professores.
      </p>

      <h2>6. Transferência internacional</h2>
      <p>
        Alguns fornecedores são empresas sediadas no exterior e podem tratar dados fora do Brasil.
        Nesses casos, exigimos garantias contratuais de proteção compatíveis com a LGPD (art. 33).
      </p>

      <h2>7. Por quanto tempo guardamos</h2>
      <ul>
        <li>Enquanto a conta do professor estiver ativa.</li>
        <li>
          O professor pode excluir alunos, turmas e provas a qualquer momento; os dados excluídos
          deixam de ser usados imediatamente.
        </li>
        <li>
          Quando a conta é encerrada, apagamos os dados em até 30 dias, exceto o que a lei nos
          obriga a guardar (por exemplo, registros de acesso por 6 meses).
        </li>
      </ul>

      <h2>8. Segurança</h2>
      <ul>
        <li>Conexão sempre cifrada (HTTPS) e senhas guardadas com cifra irreversível.</li>
        <li>
          Cada conta só acessa os próprios dados; as regras de acesso ficam no banco de dados.
        </li>
        <li>
          Provas acessadas por link exclusivo e, se o professor quiser, com código de acesso
          mostrado em sala.
        </li>
      </ul>
      <p>
        Nenhum sistema é totalmente imune a falhas. Se acontecer um incidente que possa trazer risco
        aos titulares, avisaremos os afetados e a Autoridade Nacional de Proteção de Dados (ANPD),
        conforme a lei.
      </p>

      <h2>9. Cookies e armazenamento no aparelho</h2>
      <ul>
        <li>Usamos apenas cookies essenciais, para manter o professor conectado.</li>
        <li>
          No celular do aluno, guardamos um identificador da prova em andamento, para que ele possa
          continuar se a página recarregar.
        </li>
        <li>Não usamos cookies de publicidade nem ferramentas de rastreamento.</li>
      </ul>

      <h2>10. Seus direitos</h2>
      <p>
        Você pode pedir: confirmação de que tratamos seus dados, acesso, correção, anonimização,
        bloqueio ou eliminação de dados desnecessários, portabilidade, informação sobre
        compartilhamento e revisão de decisões automatizadas (art. 18 da LGPD).
      </p>
      <ul>
        <li>
          <strong>Professores</strong>: escreva para <a href={`mailto:${email}`}>{email}</a>.
        </li>
        <li>
          <strong>Alunos e responsáveis</strong>: procure primeiro a escola ou o professor, que
          controla esses dados. Se preferir, escreva para nós e encaminharemos o pedido.
        </li>
      </ul>
      <p>Respondemos em até 15 dias. Você também pode reclamar à ANPD (www.gov.br/anpd).</p>

      <h2>11. Mudanças nesta política</h2>
      <p>
        Podemos atualizar esta política. Mudanças importantes serão avisadas por e-mail ou no painel
        antes de entrarem em vigor. Veja também os{" "}
        <Link href={LEGAL_ROUTES.terms}>Termos de uso</Link>.
      </p>
    </>
  );
}
