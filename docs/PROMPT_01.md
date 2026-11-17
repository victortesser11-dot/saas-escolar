# PROMPT 1 — Contexto inicial do projeto

> Registro literal do primeiro prompt do projeto, recebido em 2026-11-17.
> Fonte original das decisões e requisitos consolidados em [`PRD.md`](./PRD.md).

---

# CONTEXTO INICIAL — SAAS DE AVALIAÇÕES ESCOLARES DIGITAIS

Quero desenvolver um SaaS de avaliações escolares digitais, com foco em simplificar a aplicação e correção de provas para professores.

Você deverá atuar como meu arquiteto de software, engenheiro de produto e desenvolvedor full-stack sênior durante a construção deste projeto.

## 1. VISÃO DO PRODUTO

A proposta é criar uma plataforma na qual professores consigam criar, aplicar e corrigir provas digitais de maneira simples, rápida e intuitiva.

O principal diferencial é permitir que o professor aplique uma prova utilizando o celular dos próprios alunos, eliminando a necessidade de imprimir provas e corrigir manualmente cada avaliação.

O fluxo principal será:

1. O professor acessa a plataforma e cria uma prova.
2. Insere o conteúdo da avaliação, cadastra as questões e define a quantidade de questões que serão aplicadas.
3. A plataforma gera uma avaliação individual para cada aluno, selecionando questões aleatoriamente de um banco de questões.
4. O professor disponibiliza um link público para realização da prova.
5. O aluno acessa o link pelo próprio celular, informa seu nome e número de identificação ou matrícula, sem precisar criar uma conta.
6. Responde às questões e envia a avaliação.
7. A plataforma corrige automaticamente as questões objetivas e apresenta a nota imediatamente ao aluno, conforme as configurações definidas pelo professor.
8. O resultado fica armazenado na plataforma, vinculado ao aluno, à prova e à turma.

A experiência deve ser semelhante à realização de uma prova tradicional no papel, mas totalmente digital.

## 2. ESTRUTURA DO SISTEMA

Precisamos pensar em uma estrutura escalável e organizada.

Considere inicialmente esta hierarquia:

- Escola
  - Professores
  - Turmas
    - Alunos
    - Provas
      - Questões
      - Aplicações individuais
      - Resultados

Avalie se essa estrutura é a melhor ou se devemos começar com uma estrutura mais simples, permitindo que professores independentes utilizem a plataforma sem necessariamente estarem vinculados a uma escola.

A arquitetura deve permitir futuramente múltiplas escolas, professores e turmas, com isolamento adequado dos dados.

## 3. FUNCIONALIDADES DO MVP

Priorize as seguintes funcionalidades:

### Gestão de professores
- Cadastro e autenticação.
- Painel administrativo.
- Gerenciamento de turmas.

### Gestão de alunos
- Cadastro manual de alunos.
- Nome e número de identificação/matrícula.
- Importação de alunos por planilha, se viável.

### Gestão de provas
- Criar e editar provas.
- Definir título, descrição e instruções.
- Definir quantidade de questões.
- Cadastrar questões e alternativas.
- Definir resposta correta e pontuação.
- Randomizar questões e alternativas.
- Gerar versões individuais para cada aluno.
- Definir período de disponibilidade e prazo.
- Disponibilizar link público de acesso.

### Experiência do aluno
- Interface mobile-first.
- Acesso sem necessidade de cadastro.
- Identificação por nome e matrícula.
- Interface limpa e intuitiva.
- Apresentação das questões.
- Navegação entre questões.
- Confirmação antes do envio.
- Resultado e nota ao finalizar, respeitando as configurações da prova.

### Correção e resultados
- Correção automática de questões objetivas.
- Cálculo automático da nota.
- Armazenamento permanente dos resultados.
- Histórico de avaliações por aluno.
- Relatório de desempenho da turma.
- Visualização individual das respostas.

## 4. EXPERIÊNCIA E DESIGN

Quero um produto com aparência profissional, moderno e simples de utilizar.

Referências de qualidade:
- Interfaces SaaS modernas.
- Design minimalista.
- Boa hierarquia visual.
- Responsividade real.
- Excelente experiência mobile.
- Painel do professor intuitivo.
- Experiência do aluno sem distrações.

Não quero uma interface com aparência de sistema escolar antigo.

O aluno deve conseguir realizar uma prova sem precisar de explicações ou treinamento.

## 5. TECNOLOGIA E ARQUITETURA

Não quero definir prematuramente toda a stack.

Primeiro, analise as tecnologias disponíveis no computador e recomende uma arquitetura moderna, econômica e escalável.

Considere especialmente:
- TypeScript.
- React.
- Vite ou TanStack Start.
- Supabase para banco de dados, autenticação e backend, se fizer sentido.
- PostgreSQL.
- Hospedagem com baixo custo inicial.
- Arquitetura preparada para integração com inteligência artificial.

Priorize ferramentas com planos gratuitos ou custos iniciais reduzidos, sem comprometer a qualidade técnica.

A arquitetura deverá considerar segurança, isolamento de dados entre escolas e professores, controle de acesso e proteção das respostas corretas.

## 6. INTELIGÊNCIA ARTIFICIAL — FUTURO

A inteligência artificial não é prioridade para o MVP, mas deve ser considerada na arquitetura.

Em uma segunda etapa, quero implementar um recurso no qual:

1. O professor envia um PDF, DOCX ou outro material didático.
2. A IA analisa o conteúdo.
3. Gera questões automaticamente, com alternativas e respostas corretas.
4. O professor revisa e aprova as questões.
5. As questões aprovadas são adicionadas ao banco de questões.

A ideia é reduzir ainda mais o trabalho do professor.

Não implemente isso agora. Apenas prepare a arquitetura para essa evolução.

## 7. PRIMEIRA ETAPA — ANÁLISE DO AMBIENTE

Este computador é novo e pode não possuir todas as dependências necessárias.

Antes de iniciar o desenvolvimento:

- Analise o sistema operacional.
- Verifique se Node.js, Bun, Git e demais ferramentas necessárias estão instalados.
- Verifique versões e compatibilidade.
- Identifique dependências ausentes.
- Verifique se há ferramentas que precisam ser atualizadas.

Se alguma instalação for necessária, explique o que precisa ser instalado e solicite minha autorização antes de executar a instalação.

Não instale ferramentas desnecessárias.

Não altere configurações globais do sistema sem minha autorização.

## 8. METODOLOGIA DE TRABALHO

Quero desenvolver esse produto de forma estruturada.

Neste primeiro momento, NÃO comece a programar.

Primeiro:

1. Analise o contexto do produto.
2. Identifique possíveis problemas e riscos na proposta.
3. Sugira melhorias no modelo de negócio e na experiência do usuário.
4. Recomende a melhor estrutura de dados.
5. Proponha a arquitetura técnica.
6. Avalie os custos operacionais iniciais.
7. Apresente uma proposta de MVP, separando o essencial das funcionalidades futuras.
8. Apresente um roadmap de desenvolvimento por etapas.

Depois, aguarde minha aprovação para começar a implementação.

Durante o desenvolvimento:
- Trabalhe em pequenas etapas.
- Explique decisões arquiteturais importantes.
- Não invente funcionalidades que não foram aprovadas.
- Não sobrescreva arquivos sem necessidade.
- Priorize código limpo, modular e sustentável.
- Execute testes sempre que possível.
- Valide o funcionamento antes de considerar uma tarefa concluída.
- Documente decisões relevantes.
- Peça autorização antes de executar operações destrutivas ou instalações.

## 9. VISÃO DE NEGÓCIO

O produto deve nascer com potencial comercial.

Quero que seja possível oferecer:
- Plano gratuito para professores individuais.
- Planos pagos com limites maiores de turmas, alunos e provas.
- Planos institucionais para escolas.
- Futuramente, recursos premium com inteligência artificial e relatórios avançados.

Considere desde o início como evitar que o crescimento do número de usuários gere custos operacionais desproporcionais.

## 10. SUA PRIMEIRA ENTREGA

Quero que sua primeira resposta contenha:

1. Diagnóstico do ambiente de desenvolvimento.
2. Avaliação crítica da ideia.
3. Arquitetura recomendada.
4. Sugestão de stack tecnológica.
5. Modelo inicial de banco de dados.
6. Escopo detalhado do MVP.
7. Estimativa de custos de infraestrutura.
8. Roadmap de implementação.

Não escreva código ainda.

Vamos construir um produto real, comercializável, seguro e preparado para crescer. Priorize decisões que façam sentido tanto tecnicamente quanto como negócio.

## 11. INFRAESTRUTURA, INTEGRAÇÕES E CUSTO ZERO NA VERSÃO 1

Uma das principais premissas deste projeto é desenvolver e disponibilizar a primeira versão utilizando exclusivamente serviços gratuitos, sempre que tecnicamente possível.

Nossa meta é lançar a V1 com custo operacional de R$ 0, utilizando os planos free dos provedores.

### Supabase — Banco de dados e Backend

Pretendemos utilizar o Supabase como infraestrutura principal de backend.

Utilize a conexão com Supabase já disponível no ambiente, caso exista.

Responsabilidades:
- PostgreSQL como banco de dados.
- Autenticação dos professores.
- Gerenciamento de usuários.
- Row Level Security (RLS).
- Armazenamento de arquivos, quando necessário.
- Edge Functions, se forem úteis para operações específicas.

Antes de configurar uma nova conexão, verifique se já existe uma integração ou autenticação disponível.

Se não existir, solicite minha autorização e orientação para conectar o projeto ao Supabase.

Não crie um segundo projeto Supabase sem necessidade.

### Vercel — Hospedagem e Deploy

Pretendemos utilizar a Vercel para hospedar e publicar a aplicação.

Utilize a conexão com a Vercel já disponível, caso exista.

Responsabilidades:
- Hospedagem da aplicação.
- Deploy automatizado.
- Integração com o repositório Git.
- Gerenciamento de variáveis de ambiente.
- Ambientes de desenvolvimento e produção, quando disponíveis no plano gratuito.

Verifique se já existe uma conexão ativa com a Vercel.

Caso não exista, solicite minha autorização para realizar a integração.

### Outras integrações

Se identificar necessidade de algum serviço adicional, como armazenamento, envio de e-mails, autenticação externa ou processamento de arquivos:

1. Priorize alternativas gratuitas.
2. Avalie se o próprio Supabase ou a Vercel já oferecem os recursos necessários.
3. Não contrate planos pagos.
4. Não crie contas ou serviços sem minha autorização.
5. Apresente o motivo da necessidade e as alternativas disponíveis.

### Política de custos

A versão 1 deverá ser desenvolvida com a seguinte prioridade:

- Supabase Free.
- Vercel Hobby (observando suas condições de uso).
- Ferramentas open source.
- Bibliotecas gratuitas.
- Domínio gratuito ou subdomínio fornecido pelos provedores.
- Nenhuma API paga obrigatória.

Não implemente dependências de inteligência artificial paga na V1.

### Atenção aos limites gratuitos

Não considere que um serviço é gratuito apenas porque possui um plano free.

Verifique:
- Limites de armazenamento.
- Limites de banco de dados.
- Quantidade de usuários.
- Limites de requisições.
- Limites de execução.
- Políticas de suspensão por inatividade.
- Restrições comerciais dos planos.
- Limitações de hospedagem e tráfego.

Apresente os riscos de cada serviço e estime até onde conseguimos operar gratuitamente.

Se alguma funcionalidade exigir um serviço pago, proponha uma alternativa gratuita antes de implementá-la.

**Regra fundamental: não quero assumir custos recorrentes sem aprovação expressa. A arquitetura deve permitir migrar para planos pagos futuramente, sem precisar reconstruir o produto.**
