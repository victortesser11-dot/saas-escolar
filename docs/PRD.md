# PRD — SaaS de Avaliações Escolares Digitais

| Campo | Valor |
|---|---|
| Versão | 0.2 |
| Data | 2026-11-17 |
| Status | Aguardando aprovação da proposta técnica |
| Fontes | [`PROMPT_01.md`](./PROMPT_01.md) · Complemento "Regras de funcionamento das provas" (Etapa 2) |
| Documentos relacionados | [`ARQUITETURA.md`](./ARQUITETURA.md) (proposta técnica, pendente de aprovação) |

> Este documento consolida os requisitos de produto. Itens marcados como **[EM ABERTO]**
> dependem de decisão do responsável pelo produto (ver seção 14).
> Decisões técnicas estão em `ARQUITETURA.md` e só passam a valer após aprovação expressa.

---

## 1. Visão do produto

Plataforma SaaS para professores **criarem, aplicarem e corrigirem provas digitais** de forma simples, rápida e intuitiva.

**Diferencial principal:** a prova é aplicada no **celular dos próprios alunos**, sem impressão e sem correção manual. A experiência deve ser equivalente à de uma prova em papel, porém totalmente digital.

### 1.1 Problema
- Professores gastam tempo imprimindo, aplicando e corrigindo provas manualmente.
- Cola entre alunos é facilitada quando todos recebem a mesma prova.

### 1.2 Proposta de valor
- Criação rápida de provas a partir de um banco de questões.
- Prova individual por aluno (questões e alternativas sorteadas).
- Correção automática sempre que possível, nota imediata em provas objetivas.
- Controle total do professor sobre tentativas e liberações.
- Resultados armazenados e organizados por aluno, prova e turma.

## 2. Personas

| Persona | Descrição | Necessidade principal |
|---|---|---|
| **Professor** | Usuário cadastrado. Pode ser independente ou vinculado a uma escola. | Criar, aplicar e corrigir provas com o mínimo de esforço. |
| **Aluno** | Não cria conta. Acessa por link público no próprio celular. | Fazer a prova sem treinamento, sem distrações. |
| **Escola** (futuro) | Instituição com vários professores e turmas. | Gestão centralizada e isolamento de dados. |

## 3. Fluxo principal

1. Professor cria a prova e associa questões (banco da prova).
2. Define quantidade de questões aplicadas, valor de cada questão, tempo e regras de exibição de resultado.
3. Revisa a pontuação total e publica.
4. Disponibiliza o link público.
5. Aluno acessa pelo celular e informa nome e matrícula (sem conta).
6. O sistema gera a aplicação individual (sorteio de questões e de alternativas) e inicia o tempo.
7. Aluno responde; respostas são salvas no servidor à medida que são marcadas.
8. Aluno confirma o envio (ou o tempo expira e a prova é encerrada automaticamente).
9. Correção automática das questões objetivas; dissertativas ficam pendentes de correção manual.
10. Resultado exibido conforme configuração da prova e armazenado, vinculado a aluno, prova e turma.

## 4. Estrutura do sistema

Hierarquia inicial proposta:

```
Escola
├── Professores
└── Turmas
    ├── Alunos
    └── Provas
        ├── Questões
        ├── Aplicações individuais
        └── Resultados
```

**Requisitos estruturais:**
- Permitir **professores independentes**, sem vínculo obrigatório com escola.
- Suportar futuramente múltiplas escolas, professores e turmas.
- **Isolamento de dados** entre escolas e entre professores.

> Proposta técnica (pendente de aprovação): tratar professor independente e escola como o mesmo conceito
> de "espaço de trabalho" (tenant). Ver `ARQUITETURA.md`, seção 4.

## 5. Requisitos funcionais — MVP

### 5.1 Gestão de professores
- RF-01 Cadastro e autenticação.
- RF-02 Painel administrativo.
- RF-03 Gerenciamento de turmas.

### 5.2 Gestão de alunos
- RF-04 Cadastro manual de alunos (nome + número de identificação/matrícula).
- RF-05 Importação de alunos por planilha. **[Se viável — proposta: CSV no MVP]**

### 5.3 Gestão de provas
- RF-06 Criar e editar provas.
- RF-07 Definir título, descrição e instruções.
- RF-08 Definir quantidade de questões aplicadas.
- RF-09 Cadastrar questões e alternativas.
- RF-10 Definir resposta correta e pontuação.
- RF-11 Randomizar questões e alternativas.
- RF-12 Gerar versões individuais por aluno.
- RF-13 Definir período de disponibilidade e prazo.
- RF-14 Disponibilizar link público de acesso.
- RF-29 Definir o valor individual de cada questão, com valores diferentes entre questões.
- RF-30 Exibir a pontuação total da prova antes da publicação.
- RF-31 Revisar e aprovar a configuração antes de publicar (publicação exige pontuação definida).
- RF-32 Permitir alterar a pontuação livremente enquanto nenhuma aplicação tiver sido iniciada.
- RF-33 Após o início das aplicações, alterar pontuação somente por procedimento administrativo registrado, sem alterar avaliações já realizadas.
- RF-34 Definir tempo máximo de realização (opcional).
- RF-35 Configurar, por prova, a exibição pós-envio: **somente nota** ou **nota + respostas corretas**.

### 5.4 Tipos de questão
- RF-36 Múltipla escolha (uma alternativa correta) — correção automática.
- RF-37 Verdadeiro ou falso — correção automática.
- RF-38 Seleção múltipla (mais de uma alternativa correta) — correção automática.
- RF-39 Resposta curta — correção automática por comparação com respostas aceitas, com possibilidade de revisão pelo professor.
- RF-40 Dissertativa — correção manual pelo professor.
- RF-41 Indicar claramente, na criação e na correção, quais questões são de correção automática e quais exigem correção manual.

### 5.5 Experiência do aluno
- RF-15 Interface mobile-first.
- RF-16 Acesso sem cadastro.
- RF-17 Identificação por nome e matrícula.
- RF-18 Interface limpa e intuitiva.
- RF-19 Apresentação das questões.
- RF-20 Navegação entre questões.
- RF-21 Confirmação antes do envio.
- RF-22 Resultado e nota ao finalizar, conforme configuração da prova.
- RF-42 Cronômetro visível com tempo restante (quando a prova tiver tempo máximo).
- RF-43 Encerramento automático ao fim do tempo, com envio das respostas já registradas.
- RF-44 Salvamento das respostas no servidor durante a realização (não apenas no envio final).
- RF-45 Aviso de "avaliação pendente de correção" quando houver questões dissertativas.

### 5.6 Correção e resultados
- RF-23 Correção automática de questões objetivas.
- RF-24 Cálculo automático da nota.
- RF-25 Armazenamento permanente dos resultados.
- RF-26 Histórico de avaliações por aluno.
- RF-27 Relatório de desempenho da turma.
- RF-28 Visualização individual das respostas.
- RF-46 Correção manual de questões dissertativas (e revisão de respostas curtas), respeitando o valor definido.
- RF-47 Atualização da nota após a correção manual.

### 5.7 Acompanhamento e controle do professor
- RF-48 Painel por prova com a situação de cada aluno:
  não iniciou · em andamento · finalizou · interrompida · problema de envio ·
  aguardando liberação · pendente de correção.
- RF-49 Histórico de cada aluno na prova (aplicações, eventos, liberações).
- RF-50 Liberar **retomada** de uma aplicação interrompida.
- RF-51 Liberar **nova tentativa** (gera nova aplicação, conforme configurações da prova).
- RF-52 Notificação no painel sobre alunos com interrupção ou problema de envio.

## 6. Regras de negócio

### 6.1 Sorteio de questões
- RN-01 Cada aluno recebe uma aplicação individual.
- RN-02 As questões são sorteadas do conjunto de questões associado à prova, na quantidade definida pelo professor.
- RN-03 A ordem das questões é randomizada; não há repetição de questão na mesma aplicação.
- RN-04 O método de sorteio prioriza simplicidade, buscando combinações diferentes entre alunos sempre que possível.
- RN-05 As questões apresentadas a cada aluno, e sua ordem, ficam registradas na aplicação.

### 6.2 Alternativas
- RN-06 A ordem das alternativas é randomizada individualmente por aluno.
- RN-07 A randomização nunca altera a associação entre alternativa e resposta correta (a correção usa identificadores, não posições).
- RN-08 A ordem apresentada é armazenada em cada aplicação.

### 6.3 Pontuação
- RN-09 A pontuação de cada questão é definida antes da publicação; a prova não pode ser publicada sem ela.
- RN-10 O valor de cada questão é congelado na aplicação no momento do sorteio; alterações posteriores não modificam aplicações já iniciadas ou concluídas.
- RN-11 Alterações de pontuação após o início das aplicações exigem procedimento administrativo e ficam registradas.
- RN-12 **[EM ABERTO]** Quando o professor sorteia um subconjunto de questões com valores diferentes, alunos podem ter totais diferentes. Ver questão Q-01.

### 6.4 Tempo
- RN-13 O controle do tempo é feito pelo servidor; o cronômetro do aluno é apenas exibição.
- RN-14 O prazo de cada aplicação é o menor entre (início + tempo máximo) e o fim do período de disponibilidade da prova.
- RN-15 Após o prazo, o servidor recusa novas respostas e encerra a aplicação com as respostas já registradas.
- RN-16 São registrados horário de início, de envio e de encerramento.

### 6.5 Tentativas e retomada
- RN-17 Cada aluno tem **uma tentativa** por prova.
- RN-18 O aluno **não pode retomar por conta própria** uma aplicação interrompida.
- RN-19 Retomada e nova tentativa dependem **exclusivamente** de ação do professor, que fica registrada (quem, quando, motivo).
- RN-20 Nova tentativa gera nova aplicação (novo sorteio); a anterior é preservada no histórico.
- RN-21 Falhas de conexão nunca geram automaticamente uma nova tentativa.
- RN-22 Respostas já recebidas pelo servidor nunca são descartadas por falha técnica.
- RN-23 Envios repetidos da mesma aplicação são tratados como um único envio (idempotência).
- RN-24 **[EM ABERTO]** Definição exata de "interrupção" (recarregar a página no mesmo aparelho conta como interrupção?). Ver questão Q-02.

### 6.6 Resultado e gabarito
- RN-25 O que é exibido após o envio segue a configuração da prova (somente nota / nota + respostas corretas).
- RN-26 Provas exclusivamente objetivas: nota calculada e exibida imediatamente após o envio.
- RN-27 Provas com dissertativas: o aluno é informado de que a nota está pendente; a nota definitiva sai após a correção manual.
- RN-28 Respostas corretas nunca são enviadas ao navegador do aluno antes do encerramento da sua aplicação, e só depois se a prova estiver configurada para exibi-las.

### 6.7 Correção
- RN-29 Correção automática sempre que o tipo de questão permitir.
- RN-30 Questões que exigem interpretação textual ficam pendentes de correção do professor.
- RN-31 A correção (automática e manual) é executada no servidor e registrada.

## 7. Requisitos não funcionais

### 7.1 Design e UX
- Aparência profissional, moderna e minimalista (padrão SaaS atual).
- Boa hierarquia visual e responsividade real.
- Excelente experiência mobile.
- Painel do professor intuitivo.
- Experiência do aluno sem distrações; **utilizável sem explicação ou treinamento**.
- Não pode ter aparência de "sistema escolar antigo".

### 7.2 Segurança e integridade
- RNF-01 Isolamento de dados entre escolas e professores (RLS).
- RNF-02 Controle de acesso às informações administrativas.
- RNF-03 Proteção do gabarito: nunca disponível antecipadamente no navegador do aluno.
- RNF-04 Lógica crítica (início, tempo, tentativas, recebimento, correção, nota) executada no servidor.
- RNF-05 Tokens individuais, aleatórios e seguros por aplicação.
- RNF-06 Proteção contra envios duplicados e operações concorrentes (transações atômicas).
- RNF-07 Isolamento dos resultados de cada aluno.
- RNF-08 Integridade e rastreabilidade de notas e respostas (registro de eventos e de alterações).
- RNF-09 Nenhuma credencial secreta em código, documentação ou terminal.

### 7.3 Confiabilidade
- RNF-10 Respostas salvas de forma incremental no servidor; uma falha de conexão não pode apagar respostas já recebidas.
- RNF-11 Interface do aluno tolera instabilidade de rede (novas tentativas automáticas de salvamento enquanto a aplicação estiver aberta).
- RNF-12 Registro de ocorrências de conexão e envio sempre que tecnicamente possível.
- RNF-13 Backup periódico do banco fora do provedor.

### 7.4 Escalabilidade e custo
- RNF-14 Suportar várias turmas realizando provas simultaneamente (centenas a milhares de alunos no mesmo horário).
- RNF-15 Crescimento de usuários não pode gerar custo operacional desproporcional.
- RNF-16 Migração para planos pagos sem reconstruir o produto.

### 7.5 Privacidade (LGPD)
- RNF-17 Coletar o mínimo de dados de alunos (nome e matrícula), considerando que podem ser menores de idade.
- RNF-18 Dados hospedados preferencialmente no Brasil.

### 7.6 Preparação para IA
- Arquitetura preparada para evolução com IA (seção 10), sem implementar no MVP.

## 8. Tecnologia e infraestrutura

Preferências registradas (decisão final em `ARQUITETURA.md`, pendente de aprovação):

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, Lucide React.
- **Backend:** Next.js Route Handlers / Server Actions, Supabase, Zod.
- **Banco:** Supabase PostgreSQL, migrations versionadas, tipos gerados, RLS.
- **Testes:** Vitest e Playwright.
- **Gerenciamento:** Bun (se compatível), Git e GitHub.

**Supabase:** PostgreSQL, Auth dos professores, RLS, Storage quando necessário, Edge Functions somente com justificativa. Não criar projeto novo nem alterar projetos existentes sem autorização.

**Vercel:** hospedagem, deploy automatizado, integração com GitHub, variáveis de ambiente. Nada é publicado em produção sem aprovação.

**Outras integrações:** priorizar gratuitas e recursos já existentes no Supabase/Vercel; não criar contas ou contratar serviços sem autorização; justificar a necessidade.

## 9. Política de custos — V1 com custo R$ 0

- Supabase Free, Vercel Hobby (respeitando condições de uso), open source, subdomínios dos provedores.
- Nenhuma API paga obrigatória; nenhuma IA paga na V1.
- Verificar limites reais dos planos gratuitos (banco, armazenamento, usuários, requisições, execução, tráfego, suspensão por inatividade, restrições comerciais).
- Não comprometer o modelo de negócio para manter custo zero artificialmente.

> **Regra fundamental:** nenhum custo recorrente sem aprovação expressa.

## 10. Inteligência artificial — fase futura (fora do MVP)

1. Professor envia PDF, DOCX ou outro material.
2. IA analisa o conteúdo.
3. Gera questões com alternativas e respostas corretas.
4. Professor revisa e aprova.
5. Questões aprovadas entram no banco de questões.

**No MVP:** apenas preparar a arquitetura (questões com status de rascunho/aprovada e origem). Não implementar.

## 11. Modelo de negócio

- Plano gratuito para professores individuais.
- Planos pagos com limites maiores de turmas, alunos e provas.
- Planos institucionais para escolas.
- Futuro: recursos premium com IA e relatórios avançados.

Requisito: a arquitetura deve suportar limites por plano desde o início.

## 12. Fora do escopo do MVP
- Geração de questões por IA.
- Relatórios avançados (premium).
- Cobrança/planos pagos ativos. **[EM ABERTO: confirmar]**
- Gestão institucional completa de escolas (convites, papéis administrativos). **[EM ABERTO: confirmar]**
- Imagens e anexos em questões. **[EM ABERTO: ver Q-08]**
- Qualquer serviço pago.

## 13. Metodologia de trabalho

**Antes de programar:** análise de ambiente, produto, riscos, dados, arquitetura, custos, MVP e roadmap — e **aguardar aprovação**.

**Durante o desenvolvimento:**
- Pequenas etapas; explicar decisões arquiteturais.
- Não inventar funcionalidades não aprovadas.
- Não sobrescrever arquivos sem necessidade.
- Código limpo, modular e sustentável.
- Testes sempre que possível; validar antes de concluir.
- Documentar decisões relevantes.
- Autorização prévia para operações destrutivas, instalações, criação de projetos externos e publicação em produção.

## 14. Questões em aberto

| # | Questão | Proposta (ver `ARQUITETURA.md`) |
|---|---|---|
| Q-01 | Sorteio de subconjunto com questões de valores diferentes gera totais diferentes por aluno. Como tratar? | Se o banco da prova for maior que a quantidade aplicada, exigir valor igual entre as questões; valores livres quando todas as questões forem aplicadas. |
| Q-02 | Recarregar a página no mesmo aparelho/navegador conta como interrupção? | Mesmo navegador continua (registrando o evento); outro aparelho ou navegador bloqueia e aguarda o professor. |
| Q-03 | Ao liberar retomada, o tempo continua contando de onde estava ou o professor pode estender? | Prazo original mantido; professor pode adicionar minutos na liberação. |
| Q-04 | Quando há várias tentativas, qual nota vale? | A da última tentativa liberada; anteriores ficam no histórico. |
| Q-05 | Seleção múltipla: pontuação tudo-ou-nada ou parcial? | Tudo-ou-nada no MVP. |
| Q-06 | O aluno precisa estar cadastrado na turma para fazer a prova? | Sim: matrícula validada contra a lista da turma. |
| Q-07 | Exigir um código de acesso exibido em sala para evitar que alguém faça a prova de fora? | Opcional por prova (sugestão, não incluída no escopo sem aprovação). |
| Q-08 | Questões com imagem no MVP? | Fora do MVP (impacto em armazenamento e tráfego gratuitos). |
| Q-09 | Login do professor: e-mail/senha, Google ou ambos? | Ver ARQUITETURA, seção 6 (envio de e-mail exige SMTP próprio). |
| Q-10 | Limites concretos dos planos gratuito/pagos. | Definir antes do lançamento comercial. |
| Q-11 | Importação de alunos: CSV ou também XLSX? | CSV no MVP. |

## 15. Histórico de alterações

| Versão | Data | Descrição |
|---|---|---|
| 0.1 | 2026-11-17 | Criação a partir do Prompt 1. |
| 0.2 | 2026-11-17 | Incorporado o complemento "Regras de funcionamento das provas": sorteio, alternativas, pontuação, tipos de questão, tempo, retomada, tentativas, exibição de resultado, problemas de conexão, painel de controle e segurança. Adicionados RF-29 a RF-52, regras de negócio (RN-01 a RN-31), RNFs numerados, LGPD e novas questões em aberto. |
