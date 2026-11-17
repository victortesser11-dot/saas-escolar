# Avaliações Escolares (nome provisório)

SaaS para professores criarem, aplicarem e corrigirem provas digitais no celular dos alunos.

- Requisitos: [`docs/PRD.md`](docs/PRD.md)
- Arquitetura e decisões técnicas: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · shadcn/ui · Supabase (PostgreSQL, Auth, RLS) · Vitest · Playwright

## Pré-requisitos

- Node.js 24 ou superior e npm
- Docker Desktop — apenas para rodar o Supabase localmente (`npm run db:start`)

## Primeiros passos

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev                  # http://localhost:3000
```

## Scripts

| Comando                           | O que faz                                                         |
| --------------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                     | Servidor de desenvolvimento                                       |
| `npm run build` / `npm start`     | Build e servidor de produção                                      |
| `npm run lint`                    | ESLint                                                            |
| `npm run typecheck`               | Verificação de tipos TypeScript                                   |
| `npm run format` / `format:check` | Prettier                                                          |
| `npm test`                        | Testes unitários (Vitest)                                         |
| `npm run test:e2e`                | Testes E2E (Playwright; requer `npx playwright install chromium`) |
| `npm run check`                   | Lint + tipos + formatação + testes unitários                      |
| `npm run db:start` / `db:stop`    | Sobe/derruba o Supabase local (Docker)                            |
| `npm run db:reset`                | Recria o banco local aplicando as migrations                      |
| `npm run db:test`                 | Testes do banco (pgTAP)                                           |
| `npm run db:types`                | Gera tipos TypeScript a partir do banco local                     |

## Estrutura

```
docs/                 PRD, arquitetura e decisões
e2e/                  Testes end-to-end (Playwright)
src/app/              Rotas (App Router)
src/components/ui/    Componentes shadcn/ui
src/lib/              Utilitários e clientes (ex.: Supabase)
supabase/             Configuração local, migrations e testes do banco
```

## Regras do projeto

- Nenhuma credencial secreta no repositório. Variáveis locais ficam em `.env.local` (ignorado pelo Git).
- Mudanças de banco somente por migrations versionadas em `supabase/migrations`.
- A lógica crítica das provas (tempo, tentativas, correção) roda no servidor/banco, nunca no navegador do aluno.
