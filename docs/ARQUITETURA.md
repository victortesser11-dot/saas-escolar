# Proposta Técnica — SaaS de Avaliações Escolares Digitais

| Campo | Valor |
|---|---|
| Versão | 0.1 |
| Data | 2026-11-17 |
| Status | **Aprovada em 2026-11-17** ("pode iniciar o desenvolvimento"). Itens que envolvem serviços externos seguem pendentes de autorização específica (seção 14). |
| Requisitos | [`PRD.md`](./PRD.md) v0.2 |

> Nada neste documento foi implementado. Nenhum projeto externo foi criado ou alterado.
> Itens marcados com **[DECISÃO]** precisam da sua escolha antes de começarmos.

---

## 1. Diagnóstico do ambiente (verificado em 2026-11-17)

| Item | Situação | Avaliação |
|---|---|---|
| Sistema | Windows 11 Home, x64 (build 26200) | OK |
| Git | 2.56.1 | OK |
| Node.js | 26.13.1 | OK — linha 26 é LTS; compatível com Next.js atual (confirmar `engines` na instalação) |
| npm / npx | 11.20.0 | OK |
| Bun | **não instalado** | Opcional (ver 1.1) |
| GitHub CLI (`gh`) | não instalado | Opcional — não é necessário |
| Supabase CLI | não instalado | Usar via `npx supabase` como dependência de desenvolvimento do projeto (sem instalação global) |
| Vercel CLI | não instalado | Opcional — o deploy será pela integração com o GitHub |
| Docker | **não instalado** | Necessário apenas para rodar o Supabase local (ver 1.2) |
| Identidade Git | `user.name`/`user.email` **não configurados** | Necessário para o primeiro commit (ver 1.3) |
| Repositório | `saas-escolar`, branch `main`, sem commits, remoto `origin` → `github.com/victortesser11-dot/saas-escolar` | OK. Apenas `docs/` existe (não versionado ainda) |
| Arquivos `.env` / variáveis Supabase/Vercel | nenhum encontrado | OK — nada exposto |

### 1.1 Bun ou npm? **[DECISÃO]**
Bun funciona como gerenciador de pacotes com Next.js e a Vercel o suporta. Porém:
- npm já está instalado (nenhuma instalação necessária);
- o ganho do Bun é velocidade de instalação, pouco relevante neste projeto;
- no Windows, Bun ainda apresenta mais casos de incompatibilidade pontual com ferramentas (Playwright, Supabase CLI via npx) do que npm.

**Recomendação: npm.** Se preferir Bun, a instalação é por script oficial no escopo do usuário (sem alterar configurações do sistema) e requer sua autorização.

### 1.2 Docker (Supabase local) **[DECISÃO]**
O Supabase local (`supabase start`) roda Postgres, Auth e Mailpit em containers. Benefícios: testar migrations e RLS sem tocar no banco remoto, testes de banco automatizados (pgTAP), e-mails de teste sem limite.
- **Opção A (recomendada):** instalar Docker Desktop (gratuito para uso pessoal e pequenas empresas; requer WSL2, ~2–4 GB). Requer autorização.
- **Opção B:** desenvolver direto contra o projeto Supabase remoto. Funciona, mas cada migration vai direto para o único banco, e o plano Free não permite um segundo projeto para homologação (ver 2.1).

### 1.3 Identidade Git
Proposta: configurar `user.name` e `user.email` **apenas neste repositório** (`git config --local`), sem alterar a configuração global. Requer sua autorização e o nome/e-mail desejados para os commits.

---

## 2. Diagnóstico das conexões

### 2.1 Supabase — conexão ativa ✅
Organização `vtesser` (plano Free), com 2 projetos:

| Projeto | Região | Status |
|---|---|---|
| `controle-de-obras` | sa-east-1 (São Paulo) | Ativo |
| `victortesser11-dot's Project` | us-west-2 (Oregon) | Pausado |

Pontos importantes:
- O plano Free permite **2 projetos ativos**; projetos pausados não contam. Hoje há 1 ativo → **cabe exatamente mais um**.
- Reaproveitar o projeto pausado **não é recomendado**: está nos EUA (latência maior para alunos no Brasil e pior para a LGPD), e a região não pode ser alterada.
- **Recomendação:** criar um projeto novo `saas-escolar` em **sa-east-1**. Consequência: a organização ficará no limite de 2 projetos ativos (o pausado não poderá ser reativado sem pausar outro). **Requer sua autorização.**
- Nenhum projeto existente será tocado.

### 2.2 Vercel — conexão ativa ✅
- Conta `victortesser11-dot`, plano **Hobby**, time `VTESSER`.
- Integração com GitHub já configurada na conta (fluxo de importação via GitHub).
- Projetos existentes: `controle-de-obras`, `project-one` — não serão alterados.
- Para o primeiro deploy: criar projeto Vercel ligado ao repositório `saas-escolar`, configurar variáveis de ambiente (URL e chave publicável do Supabase; chave secreta apenas em ambiente de servidor) e região das funções próxima ao banco. **Requer sua autorização.** Nada será publicado em produção sem aprovação.

### 2.3 Restrição comercial da Vercel Hobby ⚠️ (ponto crítico)
A documentação oficial da Vercel restringe o plano Hobby a **uso pessoal e não comercial**; uso comercial exige Pro ou Enterprise ([fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines), [Hobby plan](https://vercel.com/docs/plans/hobby)). Respostas da comunidade Vercel indicam que prototipar no Hobby é aceitável, mas que, a partir do momento em que se cobra (ou se pretende cobrar) dos usuários, é preciso migrar.

Consequência para nós:
- **Desenvolvimento, testes e piloto fechado sem cobrança:** Vercel Hobby é aceitável.
- **Antes de cobrar ou abrir comercialmente:** escolher entre
  - **Vercel Pro** (~US$ 20/mês por membro) — zero mudança de código; ou
  - **Cloudflare Workers (plano Free, uso comercial permitido)** com Next.js via adaptador OpenNext — custo zero, mas exige validar compatibilidade e há limite diário de requisições.
- Para manter as duas portas abertas, **não usaremos recursos exclusivos da Vercel** (KV, Edge Config, Blob, ISR específico). A arquitetura da seção 5 já direciona o tráfego pesado dos alunos para o Supabase, não para a Vercel.

---

## 3. Next.js vs. TanStack Start

| Critério | Next.js (App Router) | TanStack Start |
|---|---|---|
| Maturidade | Muito alta; anos em produção, grande base instalada | Estável há pouco tempo; ecossistema ainda crescendo |
| Produtividade | Alta; convenções claras, Server Components, Server Actions | Alta; roteamento totalmente tipado, menos "mágica" |
| Integração Supabase | Guias oficiais e pacote `@supabase/ssr` com exemplos para Next.js | Funciona, mas com menos exemplos oficiais |
| shadcn/ui | Suporte de primeira classe | Suportado (via Vite) |
| Hospedagem | Ideal na Vercel; outras plataformas via OpenNext | Agnóstico (Vite/Nitro): Vercel, Cloudflare, Netlify, Node |
| Complexidade | Maior: cache, RSC, fronteiras servidor/cliente exigem disciplina | Menor e mais explícita |
| Contratação/suporte futuro | Muito fácil achar profissionais e material | Mais difícil |
| Risco de lock-in | Médio (melhor experiência na Vercel) | Baixo |

**Conclusão:** TanStack Start é tecnicamente atraente e mais portátil, mas **Next.js é a escolha mais segura para um produto comercial agora**: mais maduro, integração com Supabase documentada, mais fácil de manter e de encontrar ajuda. O risco de lock-in fica mitigado pela decisão de não usar recursos exclusivos da Vercel.

---

## 4. Stack recomendada

| Camada | Escolha | Observação |
|---|---|---|
| Framework | **Next.js (App Router) + React + TypeScript (strict)** | Conforme sua preferência |
| UI | **Tailwind CSS + shadcn/ui + Lucide React** | Conforme sua preferência |
| Formulários | React Hook Form + Zod | Mesmo schema Zod valida cliente e servidor |
| Backend do professor | Server Components + Server Actions; Route Handlers só quando necessário (ex.: download de CSV) | |
| Backend do aluno | **Funções PostgreSQL (RPC) no Supabase** | Decisão central — ver seção 5 |
| Supabase client | `@supabase/supabase-js` + `@supabase/ssr` | |
| Banco | Supabase PostgreSQL, migrations SQL em `supabase/migrations`, tipos gerados | |
| Tarefas agendadas | `pg_cron` (extensão do próprio Postgres, disponível no Free) | Encerrar aplicações expiradas |
| Testes | Vitest (unidade), Playwright (E2E), pgTAP (RLS e funções do banco) | pgTAP requer Supabase local (Docker) |
| Qualidade | ESLint, Prettier, TypeScript strict | |
| CI | GitHub Actions (gratuito): lint, tipos, testes | |
| Pacotes | **npm** (recomendado) | Ver 1.1 |
| Edge Functions | **Não usar no MVP** | Sem justificativa técnica por ora; candidatas futuras: processamento de PDF/DOCX para IA |

---

## 5. Arquitetura

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ Navegador do PROFESSOR       │        │ Celular do ALUNO             │
│ Next.js (painel)             │        │ Next.js (página da prova)    │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │ sessão (cookie)                       │ token da aplicação
               ▼                                       │ (sem conta)
┌──────────────────────────────┐                       │
│ Next.js no servidor (Vercel) │                       │
│ Server Components / Actions  │                       │
│ Zod · checagem de limites    │                       │
└──────────────┬───────────────┘                       │
               │ JWT do professor                      │ chamadas diretas a
               ▼                                       ▼ funções RPC
┌──────────────────────────────────────────────────────────────────────┐
│ SUPABASE                                                             │
│  Auth (professores)                                                  │
│  PostgREST ─► Tabelas com RLS (acesso por espaço de trabalho)        │
│            └► Funções RPC do aluno (SECURITY DEFINER):               │
│               start_attempt · save_answer · submit_attempt ·         │
│               get_attempt · get_result                               │
│  pg_cron ─► finaliza aplicações expiradas a cada minuto              │
│  Postgres: transações atômicas, constraints, log de eventos          │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.1 Decisão central: lógica da prova dentro do PostgreSQL
Toda a lógica crítica da aplicação da prova (início, sorteio, tempo, tentativas, salvamento, envio, correção, nota) fica em **funções PostgreSQL** chamadas pelo navegador do aluno através da API do Supabase.

Por quê:
1. **Atomicidade real:** cada operação é uma transação. Duas requisições simultâneas de envio, ou um envio concorrendo com a expiração, são resolvidas por bloqueio de linha (`SELECT … FOR UPDATE`) e constraints únicas — sem condições de corrida.
2. **Custo:** o tráfego mais pesado (dezenas de salvamentos por aluno) vai direto ao Supabase, cujo plano Free **não limita requisições à API**. A Vercel só entrega a página do aluno, que é estática e cacheável. Isso evita estourar limites de funções da Vercel e mantém o custo proporcional ao uso.
3. **Portabilidade:** as regras ficam no banco, independentes de hospedagem (Vercel, Cloudflare ou outra).
4. **Segurança:** o papel anônimo **não tem acesso a nenhuma tabela**; só pode executar essas funções, que validam o token e devolvem apenas o que o aluno pode ver.

Custo da decisão: lógica em PL/pgSQL é menos familiar que TypeScript. Mitigação: funções pequenas, testadas com pgTAP, versionadas em migrations.

### 5.2 Camadas
- **Aplicação:** painel do professor (turmas, alunos, questões, provas, acompanhamento, correção, resultados) e página pública do aluno.
- **Backend:** Server Actions do Next.js para o professor (sempre sob RLS, com o JWT do próprio professor); funções RPC para o aluno; `pg_cron` para expiração.
- **Banco:** PostgreSQL com RLS, constraints, índices e log de eventos.

A chave secreta (`service_role`) **não será usada no fluxo normal**. Fica restrita a tarefas administrativas pontuais no servidor, nunca no navegador.

---

## 6. Autenticação e segurança

### 6.1 Professores
- Supabase Auth, sessão em cookie via `@supabase/ssr`.
- **[DECISÃO] Método de login:**
  - **E-mail e senha:** exige **SMTP próprio** em produção. O SMTP padrão do Supabase só entrega para membros da equipe do projeto e tem limite baixo por hora — serve apenas para desenvolvimento. Opções gratuitas: Brevo (Free) ou Resend (Free; requer domínio próprio). Exige criar conta → sua autorização.
  - **Login com Google:** gratuito, sem envio de e-mail, e muitos professores e escolas já usam contas Google. Exige criar credenciais OAuth no Google Cloud (gratuito) → sua autorização.
  - **Recomendação:** Google + e-mail/senha; no desenvolvimento, e-mail/senha com o SMTP padrão; SMTP próprio configurado antes do piloto.

### 6.2 Alunos (sem conta)
1. O aluno abre `/p/{slug}` e informa nome e matrícula.
2. `start_attempt(slug, matrícula, nome)` verifica: prova publicada e dentro do período, matrícula presente na turma (Q-06), nenhuma aplicação ativa ou concluída sem liberação.
3. Cria a aplicação, sorteia questões e alternativas, congela valores e prazo, e devolve um **token aleatório de 256 bits**. No banco fica apenas o **hash** do token.
4. O token fica na memória da página e no `sessionStorage` (sobrevive a recarregar a página, não a fechar a aba). Todas as chamadas seguintes exigem o token.

O aluno **não usa** o login anônimo do Supabase: isso consumiria a cota de usuários ativos mensais e não traz benefício aqui.

### 6.3 Proteção do gabarito
- `question_options.is_correct` e as chaves congeladas das questões só são legíveis pelo professor dono (RLS); o papel anônimo não tem nenhum `GRANT` em tabelas.
- `get_attempt` devolve apenas enunciado e alternativas, com identificadores opacos.
- `get_result` devolve as respostas corretas **somente** se a aplicação estiver encerrada **e** a prova estiver configurada como "nota + gabarito".

### 6.4 Isolamento entre professores e escolas
- Toda tabela de negócio tem `workspace_id`. As políticas RLS checam participação em `workspace_members`, usando uma função auxiliar `is_member(workspace_id)` e índices em todas as colunas usadas pelas políticas.
- Testes pgTAP verificam que o professor A não lê nem altera dados do professor B.

### 6.5 Outras medidas
- Política de Content-Security-Policy restritiva na página do aluno (reduz o risco de roubo do token por XSS).
- Validação Zod na borda e constraints no banco (dupla proteção).
- Prevenção de abuso: `start_attempt` só cria aplicação para matrícula da turma, com prova aberta e no máximo uma aplicação ativa por aluno. Código de acesso em sala é opcional (Q-07).

### 6.6 LGPD
Os alunos podem ser menores de idade. Medidas: coletar o mínimo (nome e matrícula), manter os dados no Brasil (sa-east-1), ter termos de uso e política de privacidade antes do piloto, e tratar o professor ou a escola como controlador dos dados e a plataforma como operadora. Recomendo uma revisão jurídica antes do lançamento comercial.

---

## 7. Regras da aplicação da prova — conflitos e solução (PRD §6)

### 7.1 Estados da aplicação

```
                    start_attempt
  (sem aplicação) ───────────────► IN_PROGRESS ──submit_attempt──► SUBMITTED ─┐
                                    │      ▲                                  │
     acesso por outro aparelho      │      │ professor libera retomada        ├─► GRADED
     ou navegador                   ▼      │                                  │   (ou PENDING_REVIEW,
                                  INTERRUPTED                                 │    se houver dissertativa)
                                    │                                         │
     prazo atingido (pg_cron ou     ▼                                         │
     próxima chamada)            EXPIRED ─────────────────────────────────────┘

  Nova tentativa liberada pelo professor → aplicação anterior vira SUPERSEDED e uma nova é criada.
```

### 7.2 Conflitos e propostas

| Cenário | Proposta |
|---|---|
| **Tempo expira enquanto o aluno está sem conexão** | O prazo é do servidor. As respostas já salvas permanecem. O `pg_cron` encerra a aplicação como `EXPIRED` e a corrige com o que foi recebido. O que estava só no celular é enviado quando a conexão voltar, mas é recusado se chegar depois do prazo + tolerância curta (sugestão: 30 s), e a tentativa recusada é registrada como evento. O professor vê o alerta "problema de envio". |
| **Perda de conexão com a página aberta** | Não é interrupção. A página guarda as respostas pendentes em fila local e as reenvia automaticamente. Indicador visual "salvando / salvo / sem conexão". |
| **Aluno fecha o navegador e volta** | Ao informar a matrícula novamente, `start_attempt` encontra a aplicação ativa, sem token válido → muda para `INTERRUPTED`, registra o evento e mostra: "Sua prova foi interrompida. Chame o professor." Nada é apagado. |
| **Recarregar a página na mesma aba** | Proposta (Q-02): permitido, porque o token está no `sessionStorage`; o evento é registrado e fica visível ao professor. Se você preferir regra estrita, qualquer recarga vira interrupção — basta guardar o token só em memória. |
| **Tentativa única × liberação** | Índice único parcial garante uma única aplicação ativa por aluno e prova. O professor escolhe entre **Retomar** (mesma aplicação, mesmas questões e respostas, novo token; pode adicionar minutos — Q-03) ou **Nova tentativa** (novo sorteio; a anterior vira `SUPERSEDED`). Cada liberação gera registro com autor, data e motivo, e só pode ser usada uma vez. |
| **Envio duplicado (dois toques, nova tentativa de rede)** | `submit_attempt` é idempotente: se a aplicação já foi enviada, devolve o mesmo resultado sem recalcular. |
| **Envio e expiração simultâneos** | Ambos bloqueiam a linha da aplicação; o primeiro vence e o segundo vê o estado final. Sem dupla correção. |
| **Salvamento × correção automática** | Cada resposta é salva com upsert (uma linha por questão da aplicação). A correção roda uma única vez, na finalização, dentro da mesma transação que muda o estado. |
| **Correção manual × nota imediata** | Prova só objetiva: nota calculada e exibida no envio. Com dissertativas: exibe a nota parcial como "pendente"; quando o professor corrige a última questão, a aplicação passa a `GRADED` e a nota final fica disponível. |
| **Pontuação alterada após início** | O valor é copiado para cada questão da aplicação no sorteio. Alteração posterior vale só para novas aplicações, exige confirmação explícita e gera evento. |
| **Subconjunto sorteado com valores diferentes (Q-01)** | Proposta: se o banco da prova tiver mais questões que a quantidade aplicada, todas devem ter o mesmo valor (validado antes de publicar). Evolução futura: "grupos de sorteio" (ex.: 5 questões de 1 ponto + 2 de 2,5 pontos). |
| **Resposta curta** | Comparação normalizada (sem acentos, maiúsculas ou espaços extras) com a lista de respostas aceitas; o professor pode ajustar. |
| **Seleção múltipla** | Tudo-ou-nada no MVP (Q-05). |

### 7.3 Sorteio (simples e auditável)
Dentro de `start_attempt`: `ORDER BY random() LIMIT N` sobre as questões da prova, embaralhamento das alternativas por questão, e gravação da ordem em `attempt_questions`. Não tentamos garantir combinações únicas entre alunos — a aleatoriedade já torna coincidências raras, como pede o PRD.

---

## 8. Modelagem do banco de dados

### 8.1 Ajustes em relação à lista proposta

| Proposta original | Decisão | Motivo |
|---|---|---|
| `schools` + `school_members` | **`workspaces` + `workspace_members`** | Professor independente = espaço pessoal; escola = espaço do tipo escola. Uma única regra de RLS serve aos dois casos e a migração "professor → escola" vira mudança de vínculo, sem reestruturar dados. |
| `exam_results` | **Incorporada a `exam_attempts`** | O resultado tem relação 1:1 com a aplicação; tabela separada só duplicaria estado. |
| `exam_releases` | **`attempt_releases`** | Representa a autorização (retomada ou nova tentativa) concedida pelo professor. |
| `exam_questions` | **Mantida, com cópia congelada** | Ao publicar, o conteúdo e o gabarito são copiados (`content_snapshot`, `answer_key`). Editar a questão no banco depois não altera a prova publicada. |
| `profiles`, `classes`, `students`, `class_students`, `questions`, `question_options`, `exam_attempts`, `attempt_questions`, `student_answers`, `exam_events` | Mantidas | |
| Planos e limites | `workspaces.plan` + limites definidos no código | Sem tabela de cobrança no MVP. |
| IA | **Nenhuma tabela agora** | Apenas colunas `questions.status` (rascunho/aprovada) e `questions.source` (manual/importada/ia). Tabelas de documentos e jobs entram na fase de IA. |

### 8.2 Entidades (resumo)

```
profiles            id (= auth.users.id) · full_name · created_at
workspaces          id · type (personal|school) · name · plan · created_at
workspace_members   workspace_id · user_id · role (owner|admin|teacher)          PK(workspace_id, user_id)

classes             id · workspace_id · teacher_id · name · school_year · archived_at
students            id · workspace_id · full_name · registration_code             UNIQUE(workspace_id, registration_code)
class_students      class_id · student_id                                         PK(class_id, student_id)

questions           id · workspace_id · author_id · type (single|true_false|multiple|short|essay)
                    · stem · explanation · default_points · status (draft|approved)
                    · source (manual|import|ai) · tags[] · created_at · updated_at
question_options    id · question_id · body · is_correct · position
                    (para "resposta curta", as respostas aceitas ficam aqui com is_correct = true)

exams               id · workspace_id · class_id · owner_id · title · description · instructions
                    · status (draft|published|closed|archived) · public_slug (UNIQUE)
                    · questions_per_attempt · shuffle_questions · shuffle_options
                    · time_limit_minutes · opens_at · closes_at
                    · result_visibility (score_only|score_and_key) · published_at
exam_questions      id · exam_id · question_id · points · content_snapshot jsonb · answer_key jsonb
                    · requires_manual_grading                                     UNIQUE(exam_id, question_id)

exam_attempts       id · exam_id · student_id · attempt_number · status
                    · token_hash · started_at · expires_at · submitted_at · finalized_at
                    · finalize_reason (submitted|expired|teacher) · max_score · auto_score
                    · manual_score · final_score · grading_status (auto|pending_review|graded)
                    · release_id                                                   UNIQUE(exam_id, student_id, attempt_number)
                    índice único parcial: (exam_id, student_id) WHERE status IN ('in_progress','interrupted')
attempt_questions   id · attempt_id · exam_question_id · position · option_order uuid[] · points
student_answers     id · attempt_question_id (UNIQUE) · selected_option_ids uuid[] · text_answer
                    · is_correct · points_awarded · graded_by · graded_at · saved_at
attempt_releases    id · exam_id · student_id · kind (resume|new_attempt) · extra_minutes
                    · reason · granted_by · granted_at · consumed_at
exam_events         id (bigint) · exam_id · attempt_id · actor (student|teacher|system)
                    · type · payload jsonb · created_at                           (somente inserção)
```

### 8.3 Integridade, índices e histórico
- Chaves estrangeiras em todas as relações. `ON DELETE RESTRICT` em tudo que tem resultado (aplicações não somem); arquivamento lógico (`archived_at`) em vez de exclusão para turmas, provas e alunos.
- `workspace_id` repetido nas tabelas principais (desnormalização intencional) para RLS simples e rápida.
- Índices: todas as FKs; `(workspace_id)` nas tabelas de negócio; `exams(public_slug)`; `exam_attempts(exam_id, status)`; `exam_attempts(expires_at) WHERE status = 'in_progress'` (para o `pg_cron`); `exam_events(attempt_id, created_at)`.
- Histórico: `exam_events` registra início, salvamentos relevantes, interrupções, envio, expiração, liberações, correções manuais e alterações de nota (com valores antes e depois). O enunciado da questão fica imutável na prova pela cópia congelada.

### 8.4 Volume estimado
Uma aplicação com 20 questões gera cerca de 1 + 20 + 20 linhas, mais ~5–10 eventos ≈ **30–40 KB com índices**.

---

## 9. Hospedagem e deploy

- **GitHub** (`saas-escolar`) → **Vercel** com deploy automático.
  - Branch `main` → produção (somente após sua aprovação para publicar).
  - Pull requests → deploys de preview (disponíveis no Hobby).
- **Banco:** migrations versionadas aplicadas com `supabase db push` (via npx). Nenhuma alteração manual de schema pelo painel.
- **Variáveis:** `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (públicas por natureza, protegidas pela RLS); a chave secreta, se usada, apenas como variável de servidor na Vercel, nunca no repositório. `.env.local` no `.gitignore`.
- **Região:** funções da Vercel na região de São Paulo (`gru1`), próxima ao banco em sa-east-1.
- **Ambientes:** no Free não há projeto Supabase de homologação disponível (limite de 2 projetos). Desenvolvimento usa o Supabase local (Docker); previews usam o banco de produção apenas para leitura do professor em teste — ou, preferencialmente, previews sem banco até haver homologação paga. **[DECISÃO junto com 1.2]**
- **Backup:** o plano Free **não tem backups automáticos acessíveis**; a própria documentação do Supabase recomenda `db dump` periódico. Proposta: GitHub Action agendada diariamente, gerando um dump criptografado e guardado como artefato privado com retenção curta (gratuito). Requer cadastrar a senha do banco como secret no GitHub → sua autorização.
- **Pausa por inatividade:** projetos Free são pausados após ~7 dias com pouca atividade (por exemplo, nas férias escolares). Recuperação manual em até 90 dias. Mitigação: o próprio backup diário gera atividade; alerta de pausa por e-mail.

---

## 10. Limites gratuitos e capacidade estimada

### 10.1 Supabase Free (cota por organização; a organização também é usada por `controle-de-obras`)

| Recurso | Limite | Impacto para nós |
|---|---|---|
| Tamanho do banco | 500 MB por projeto (passa a somente leitura ao exceder) | ~440 MB úteis → **~12–15 mil aplicações de prova**. Principal gargalo. |
| Egress | 5 GB/mês (dividido com `controle-de-obras`) | Uma aplicação trafega ~50–100 KB → dezenas de milhares por mês. Folgado sem imagens. |
| Usuários ativos (MAU) | 50.000 | Só professores contam (alunos não usam Auth). Folgado. |
| Storage | 1 GB | Não usado no MVP (sem imagens). |
| Realtime | 200 conexões simultâneas | **Não usar Realtime para alunos**; painel do professor atualiza por consulta periódica. |
| Requisições de API | Sem limite explícito, mas restritas pela capacidade da instância compartilhada (Nano) | Ver 10.3. |
| Backups | Nenhum acessível | Ver seção 9. |
| Pausa | ~7 dias de baixa atividade | Ver seção 9. |
| Projetos | 2 ativos | Ficaremos no limite. |
| SMTP padrão | Só para e-mails da equipe; poucas mensagens por hora | Exige SMTP próprio no piloto. |

### 10.2 Vercel Hobby
- Cotas de tráfego e execução de funções são suficientes para o MVP, porque o tráfego dos alunos vai direto ao Supabase. Valores exatos variam; confirmar no painel de uso.
- **Restrição principal: uso não comercial** (seção 2.3).

### 10.3 Cenário de carga
10 turmas × 40 alunos = 400 alunos; imaginemos 1.000 simultâneos:
- Início: 1.000 transações `start_attempt` em ~2 minutos (~8/s), cada uma inserindo ~40 linhas → tranquilo.
- Salvamentos: 1.000 alunos × 1 resposta a cada ~30 s ≈ **35 escritas/s**, cada uma pequena e indexada → dentro do que uma instância Nano suporta, mas é a faixa onde vale fazer um **teste de carga antes do piloto** (k6, gratuito).
- Envio em massa ao fim do tempo: o `pg_cron` finaliza em lotes; envios dos alunos são idempotentes.

**Estimativa de operação gratuita:** algo como **30–50 professores ativos aplicando ~1 prova/mês por turma durante cerca de 1 ano**, até o limite de 500 MB. Com retenção/arquivamento de eventos antigos, o prazo se estende.

### 10.4 Caminho de migração (sem reconstrução)
| Gatilho | Ação | Custo aproximado* |
|---|---|---|
| Início da cobrança | Vercel Pro **ou** migrar para Cloudflare Workers Free | US$ 20/mês ou R$ 0 |
| Banco > ~400 MB, necessidade de backup diário ou fim da pausa | Supabase Pro | ~US$ 25/mês |
| Picos acima de ~1.000 alunos simultâneos | Upgrade de compute do Supabase | variável |
| E-mail transacional acima da cota gratuita | Plano pago do provedor SMTP | variável |
| Marca/entregabilidade de e-mail | Domínio próprio (.com.br) | ~R$ 40/ano |

\* Valores em dólar; converter pelo câmbio do momento. **Nenhum será contratado sem sua aprovação.**

---

## 11. Preparação para IA (sem implementar)
- `questions.status` e `questions.source` permitem que questões geradas por IA entrem como **rascunho** e só sejam usadas após aprovação do professor — mesmo fluxo de revisão do RF-31.
- Fase futura: upload no Supabase Storage → processamento assíncrono (Edge Function ou rota de servidor) → tabela `ai_generation_jobs` → questões em rascunho. O provedor de IA ficará atrás de uma interface própria, para poder ser trocado.
- Nenhuma dependência de IA na V1.

---

## 12. Riscos

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | Vercel Hobby não permite uso comercial | Certa | Alto | Decidir Vercel Pro ou Cloudflare antes de cobrar; evitar recursos exclusivos da Vercel |
| R2 | Banco atinge 500 MB e fica somente leitura | Média | Alto | Monitorar tamanho; alerta a 70%; política de retenção de eventos; upgrade planejado |
| R3 | Projeto pausado nas férias | Média | Médio | Atividade diária do backup; alertas por e-mail |
| R4 | Sem backup no Free | Certa | Alto | Dump diário via GitHub Actions |
| R5 | Conexão ruim nas escolas | Alta | Alto | Salvamento incremental, fila local, idempotência, prazo do servidor, tolerância curta |
| R6 | Aluno se passar por outro (só nome e matrícula) | Média | Médio | Validar contra a lista da turma; uma aplicação ativa; código de acesso em sala opcional (Q-07); registro de eventos |
| R7 | Cola via outro aparelho/aba | Média | Baixo–Médio | Interrupção bloqueia o acesso paralelo; sorteio individual. Não há antifraude total no navegador — limitação inerente |
| R8 | Lógica em PL/pgSQL mais difícil de manter | Média | Médio | Funções pequenas, pgTAP, migrations revisadas |
| R9 | Instância Nano saturar em picos | Baixa (MVP) | Alto | Teste de carga; compute maior se necessário |
| R10 | LGPD (dados de menores) | Média | Alto | Minimização, dados no Brasil, termos e política, revisão jurídica |
| R11 | Organização Supabase compartilhada com `controle-de-obras` (mesmas cotas de egress) | Média | Médio | Monitorar; considerar organização separada no futuro |
| R12 | SMTP padrão inviável fora da equipe | Certa | Alto (cadastro) | Google OAuth e/ou SMTP gratuito antes do piloto |

---

## 13. Plano de implementação

Cada etapa termina com testes passando e uma demonstração para validação.

| Etapa | Entrega | Precisa da sua autorização para |
|---|---|---|
| **0. Fundação** | Next.js + TS + Tailwind + shadcn/ui, ESLint/Prettier, Vitest, Playwright, CI no GitHub Actions, estrutura de pastas, `.gitignore`/`.env.example`, Supabase CLI local | Identidade Git local; Docker; criar projeto Supabase; criar projeto Vercel; primeiro push |
| **1. Base de segurança** | Migrations: profiles, workspaces, membros, RLS + testes pgTAP de isolamento; cadastro/login do professor; criação automática do espaço pessoal; layout do painel | Método de login (6.1) |
| **2. Turmas e alunos** | CRUD de turmas e alunos; importação CSV com pré-visualização e validação | — |
| **3. Banco de questões** | 5 tipos de questão, editor, marcação de gabarito, indicação automática/manual | — |
| **4. Provas** | Configuração, seleção de questões, pontuação, validações (Q-01), revisão e publicação com cópia congelada, link público | — |
| **5. Motor de aplicação** | Funções `start/get/save/submit/finalize`, estados, liberações, `pg_cron`, eventos; testes pgTAP de concorrência e idempotência | — |
| **6. Experiência do aluno** | Página mobile: identificação, questões, navegação, cronômetro, salvamento com fila offline, confirmação, resultado | — |
| **7. Acompanhamento e correção** | Painel de situação por aluno, alertas, retomada/nova tentativa, correção manual, histórico, relatório da turma, respostas individuais | — |
| **8. Pré-piloto** | E2E completos, teste de carga, backup automatizado, monitoramento de cotas, termos/política, SMTP | Secrets no GitHub; conta SMTP; publicação em produção |

**Depois do MVP (não incluído):** planos e cobrança, gestão institucional de escolas, questões com imagem, grupos de sorteio, relatórios avançados, IA.

---

## 14. Decisões pendentes (resumo)

1. Aprovar a stack (seção 4) e a arquitetura com lógica da prova no Postgres (seção 5.1).
2. npm (recomendado) ou Bun (1.1).
3. Instalar Docker Desktop para o Supabase local (1.2).
4. Configurar identidade Git só neste repositório (1.3) — nome e e-mail a usar.
5. Criar projeto Supabase `saas-escolar` em sa-east-1 (2.1).
6. Criar projeto Vercel ligado ao repositório (2.2) — sem publicar em produção.
7. Método de login do professor (6.1).
8. Questões em aberto Q-01 a Q-11 do PRD (as propostas estão na seção 7).

---

## 15. Registro de decisões de implementação

| Data | Decisão | Motivo |
|---|---|---|
| 2026-11-17 | **npm** como gerenciador de pacotes | Já instalado; recomendação da seção 1.1 aceita na aprovação geral |
| 2026-11-17 | Next.js **16.4.6**, React 19.3, Tailwind CSS 4.3 | Versões estáveis atuais. O Next 16 vem com `cacheComponents` ligado; consultar `node_modules/next/dist/docs/` antes de usar APIs de cache e dados |
| 2026-11-17 | shadcn/ui com o preset padrão **base-nova** (componentes sobre **Base UI**, não Radix) | Padrão atual do shadcn; mesma API de uso dos componentes |
| 2026-11-17 | `@types/node` 26 | Alinhado ao Node 26 da máquina; a versão 20 gerada pelo scaffold conflitava com o Vitest 5 |
| 2026-11-17 | Supabase CLI como dependência de desenvolvimento (`npx supabase`) | Evita instalação global |
| 2026-11-17 | CI no GitHub Actions com Node 24 (LTS) | `engines.node >= 24`; roda lint, tipos, formatação, testes unitários e E2E |
| 2026-11-17 | 4 alertas `npm audit` moderados aceitos temporariamente | Vêm da CLI do shadcn (`minimatch` via `ts-morph`), ferramenta de desenvolvimento; não entram no bundle. Reavaliar a cada atualização do shadcn |
| 2026-11-17 | `vercel.json`: `git.deploymentEnabled.main = false` | Nenhum push na `main` publica em produção sem aprovação. O MCP da Vercel chegou a criar um deploy de produção ao vincular o projeto (cancelado antes de concluir) |
| 2026-11-17 | Docker Desktop + WSL2 para o Supabase local | Testes de RLS (pgTAP), e-mails no Mailpit e migrations sem tocar no banco remoto |
| 2026-11-17 | **Etapa 1:** tenant = `workspaces`; funções de autorização no schema `private` (não exposto pela API) com `SECURITY DEFINER` | Evita recursão de RLS e exposição das funções; `plan`/`type` sem permissão de UPDATE para usuários |
| 2026-11-17 | Papel `anon` sem nenhum privilégio em tabelas | Alunos usarão apenas funções RPC (Etapa 5) |
| 2026-11-17 | Login por e-mail/senha com confirmação obrigatória; Google preparado e oculto por `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` até haver credenciais | Decisão Q-09 |
| 2026-11-17 | Links de e-mail com `token_hash` (`/auth/confirm`) e templates em português | Funcionam mesmo se o e-mail for aberto em outro aparelho; o fluxo PKCE padrão falharia nesse caso |
| 2026-11-17 | Senha mínima de 8 caracteres | Alinhado entre `config.toml` e a validação Zod. **Aplicar também no projeto remoto** |
| 2026-11-17 | `proxy.ts` (antigo middleware) faz só verificação otimista; autorização real em `getCurrentUser` (camada de dados) + RLS | Padrão recomendado por Next.js e Supabase (`getClaims`, nunca `getSession` no servidor) |
| 2026-11-17 | `getCurrentUser` chama `connection()` | O Next 16 (Cache Components/Partial Prefetching) não permite leitura do relógio na pré-renderização; o cliente Supabase consulta a validade do token |
| 2026-11-17 | Respostas de cadastro e recuperação de senha idênticas para e-mails existentes e inexistentes | Evita enumeração de contas |
| 2026-11-17 | CI sobe o Supabase local (Docker) e roda lint do banco, pgTAP e Playwright | Mesma validação do ambiente local em cada push |
| 2026-11-17 | **Identidade visual "Caderno quadriculado"** (direção B): papel quadriculado, grafite, marca-texto amarelo, caneta vermelha; Schibsted Grotesk + IBM Plex Mono; tema único claro | Escolha do responsável pelo produto, para fugir do visual genérico de IA. Tokens em `src/app/globals.css` (`--paper`, `--grid`, `--mark`, `--pen`, `--ok`) e componentes shadcn/ui ajustados |
| 2026-11-17 | **Etapa 2:** alunos pertencem ao espaço (não à turma); vínculo `class_students` com FK composta por `workspace_id` | Um aluno pode estar em várias turmas sem duplicação; impossível vincular aluno de outro espaço |
| 2026-11-17 | Matrícula normalizada (maiúsculas, sem espaços) no banco e no app, mesma regra | Evita duplicatas como "2024a 013" × "2024A013"; será a mesma regra na identificação do aluno na prova |
| 2026-11-17 | Importação CSV: leitura no navegador (Papa Parse; UTF-8 ou Windows-1252), revalidação no servidor e gravação atômica pela função `import_students` | Excel em português gera CSV com `;` e Windows-1252. Nada é gravado pela metade; reimportar não duplica |
| 2026-11-17 | XLSX não é aceito no MVP; o app orienta a salvar como CSV | Decisão Q-11 |
| 2026-11-17 | Turmas são arquivadas (não somem) ao fim do ano; exclusão remove só a turma e a lista de chamada | Preserva histórico; alunos continuam no espaço |
| 2026-11-17 | Ids de campos gerados com `useId` | O Next 16 mantém páginas anteriores ocultas no DOM (voltar instantâneo); ids derivados do `name` se repetiam e ligavam o rótulo ao campo errado |
| 2026-11-17 | Mutações: `refresh()` ao permanecer na página; `revalidatePath` + `redirect` ao navegar | API recomendada no Next 16 |
