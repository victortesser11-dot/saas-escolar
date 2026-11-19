# Plano — Geração de questões com IA

| Campo | Valor |
|---|---|
| Versão | 0.1 (proposta, aguardando aprovação) |
| Data | 2026-11-18 |
| Relacionado | PRD seções 7.6 e 9 (fases futuras); ARQUITETURA seção 11 |

## 1. Objetivo

O professor descreve o que quer ("10 questões de frações para o 7º ano, nível médio") e recebe um **rascunho de questões** pronto para revisar, editar e incluir na prova. Nada entra na prova sem a aprovação dele.

Fora do escopo desta proposta: planejamento de aulas. O produto hoje é de provas; gerar aulas é outro produto, a decidir depois.

## 2. IA gratuita ou paga?

| Critério | IA gratuita (camadas grátis de APIs, modelos abertos) | IA paga por uso (API) |
|---|---|---|
| Qualidade em português e precisão do gabarito | Variável; erros de gabarito são mais frequentes em modelos menores | Alta nos modelos de ponta |
| Limites de uso | Baixos e sujeitos a mudança sem aviso | Definidos por contrato, com limite de gasto configurável |
| Uso dos dados | Camadas grátis costumam permitir uso dos dados para treinar modelos | API paga: dados não usados para treino, por padrão |
| Garantia para produto comercial | Nenhuma | Termos comerciais |
| Hospedar um modelo aberto por conta própria | Exige servidor com GPU, o que **custa mais** que a API no nosso volume | — |

**Conclusão:** para um produto comercial, a opção gratuita não serve. O risco principal é um **gabarito errado**, que destrói a confiança do professor. Outro risco são as camadas grátis que usam os dados para treino. Como o custo por prova gerada é de centavos (seção 3), a API paga é a escolha certa.

## 3. Custos estimados

Preços oficiais por milhão de tokens (Anthropic, novembro de 2026). Um token equivale a cerca de ¾ de palavra.

| Modelo | Entrada | Saída | Perfil |
|---|---|---|---|
| **Claude Opus 5.5** (recomendado) | US$ 4 | US$ 20 | Maior qualidade |
| Claude Sonnet 5.5 | US$ 2 | US$ 10 | Metade do preço |
| Claude Haiku 5.5 | US$ 0,10 | US$ 0,50 | Muito barato; qualidade menor |

**Uma geração de 10 questões** usa por volta de 5 mil tokens de entrada (instruções e pedido do professor) e 5 mil de saída (questões, alternativas, gabarito comentado e raciocínio do modelo):

| Modelo | Custo por prova de 10 questões | Professor com ~8 gerações/mês | 100 professores/mês |
|---|---|---|---|
| Opus 5.5 | ~US$ 0,12 (~R$ 0,70) | ~US$ 1 (~R$ 5,50) | ~US$ 100 (~R$ 550) |
| Sonnet 5.5 | ~US$ 0,06 (~R$ 0,35) | ~US$ 0,50 (~R$ 2,70) | ~US$ 50 (~R$ 270) |
| Haiku 5.5 | ~US$ 0,003 | ~US$ 0,03 | ~US$ 3 |

- Câmbio de referência: US$ 1 = R$ 5,50 (ajustar pelo do momento).
- **Piloto com 3 professores:** menos de US$ 5 por mês com o Opus.
- **Gerar a partir de um material** (PDF da apostila, foto da página do livro) acrescenta ~US$ 0,02 a 0,08 por geração, conforme o tamanho.
- **Como se paga:** créditos pré-pagos na plataforma da Anthropic, sem mensalidade. Dá para definir um **limite máximo de gasto por mês**, que trava o uso ao ser atingido.
- **Custo de infraestrutura:** zero adicional. Roda nas funções da Vercel e no Supabase que já usamos. Quando o sistema passar a cobrar, continua valendo a mudança já prevista para o plano Vercel Pro (ARQUITETURA 10.4).

**Recomendação de modelo:** começar com o **Opus 5.5**. A diferença para o Sonnet é de centavos por prova, e o gabarito correto é o que mais importa. Na fase 1 montamos um conjunto de testes (seção 6). Se o Sonnet 5.5 tiver a mesma precisão nele, a troca é uma linha de configuração e reduz o custo pela metade.

## 4. Como vai funcionar para o professor

1. No editor da prova, um botão **"Gerar questões com IA"**.
2. O professor preenche:
   - disciplina e ano/série
   - tema ou conteúdo
   - quantidade (até 10 por vez)
   - tipos de questão (múltipla escolha, resposta curta, dissertativa)
   - nível de dificuldade
   - texto-base opcional (colar um trecho da aula)
3. Em 20 a 60 segundos aparece uma tela de revisão: cada questão com enunciado, alternativas, gabarito e explicação. O professor escolhe **Aceitar**, **Editar**, **Descartar** ou **Gerar outra parecida**.
4. As questões aceitas entram na prova e no banco de questões, marcadas como "criada com IA".
5. Um contador mostra quantas gerações restam no mês (cota por professor, ligada ao plano — Q-10).

Atalhos para uma fase posterior: "sugerir alternativas erradas" para uma questão escrita à mão, "escrever explicação do gabarito" e "criar versão B da prova".

## 5. Arquitetura

- **Servidor apenas.** Uma Server Action chama a API da Anthropic pelo SDK oficial (`@anthropic-ai/sdk`). A chave `ANTHROPIC_API_KEY` fica como variável **sensível** na Vercel e nunca vai ao navegador nem ao Git.
- **Saída estruturada:** o modelo responde num formato JSON fixo (`output_config.format`), validado com Zod contra os mesmos esquemas que o editor de questões já usa. Questão inválida é descartada antes de chegar à tela.
- **Fluxo existente:** questões aceitas passam pelo mesmo `save_question` do editor, com `source = 'ai'`. A estrutura já foi preparada para isso (ARQUITETURA seção 11).
- **Provedor atrás de uma interface própria** (`src/lib/ai/`), para trocar de modelo ou de provedor sem mexer nas telas.
- **Configuração do modelo:**
  - esforço `medium`
  - resposta em streaming, para não estourar o tempo das funções
  - modelo alternativo automático caso a resposta seja recusada (`fallbacks: "default"`)
- **Controle de custo, em camadas:**
  1. Cota mensal por professor: tabela `ai_usage` com tokens e custo de cada geração, protegida por RLS e testada com pgTAP.
  2. Limite de pedidos por minuto por professor.
  3. Limite de gasto mensal configurado no painel da Anthropic.
- **Privacidade:**
  - **Nenhum dado de aluno é enviado à IA**, só o pedido do professor.
  - A Política de privacidade ganha a Anthropic na lista de fornecedores, com nova versão e data.
  - Os Termos de uso já dizem que o professor deve revisar o conteúdo (seção 6).

## 6. Qualidade

- **Conjunto de testes:** cerca de 30 pedidos reais, cobrindo várias disciplinas e séries (do fundamental ao médio). Cada resposta é conferida em três pontos: gabarito correto, alternativas erradas plausíveis e linguagem adequada à idade.
- O modelo escreve a **explicação de cada gabarito**, o que ajuda o professor a conferir e reduz erros.
- **Opcional:** uma segunda verificação automática do gabarito, por cerca de 50% a mais de custo. Só ativamos se o conjunto de testes mostrar necessidade.
- **Métricas:** taxa de questões aceitas sem edição, editadas e descartadas. O professor pode marcar "gabarito errado" para sinalizar o problema.

## 7. Fases e prazos

| Fase | Entrega | Esforço estimado |
|---|---|---|
| **1. Gerar questões por tema** | Formulário, tela de revisão, gravação no banco, cota, limite de gasto, conjunto de testes, atualização da Política de privacidade | 3 a 4 dias |
| 2. Gerar a partir de material | PDF ou foto da página do livro como base das questões | 2 dias |
| 3. Atalhos no editor | Alternativas erradas, explicação do gabarito, versão B da prova | 2 dias |

## 8. O que preciso de você para começar

1. **Aprovar o custo:** créditos pré-pagos, sugestão de **US$ 20 para o piloto**, com limite mensal de gasto de **US$ 20**.
2. **Criar a conta** em console.anthropic.com, gerar a chave de API e cadastrá-la na Vercel como variável sensível `ANTHROPIC_API_KEY`. Eu passo o passo a passo.
3. **Autorizar a instalação** do pacote `@anthropic-ai/sdk`.
4. **Definir a cota:** sugestão de **20 gerações por professor por mês** durante o piloto.
5. **Confirmar o modelo:** Opus 5.5 (recomendado) ou Sonnet 5.5.
