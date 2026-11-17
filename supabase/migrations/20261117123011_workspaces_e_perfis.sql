-- =============================================================================
-- Etapa 1 — Base de segurança: perfis, espaços de trabalho (tenants) e membros.
--
-- Modelo: todo professor tem um espaço de trabalho pessoal, criado no cadastro.
-- Escolas serão espaços do tipo 'school' com vários membros (fase futura).
-- Toda tabela de negócio futura terá workspace_id, e a RLS verifica a
-- participação do usuário em workspace_members.
-- Ver docs/ARQUITETURA.md, seções 6.4 e 8.
-- =============================================================================

-- Funções auxiliares ficam num schema que NÃO é exposto pela API (PostgREST).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.workspace_type as enum ('personal', 'school');
create type public.workspace_role as enum ('owner', 'admin', 'teacher');

-- -----------------------------------------------------------------------------
-- Função genérica de updated_at
-- -----------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles: dados públicos do usuário autenticado (professor)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Perfil do professor (1:1 com auth.users).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- workspaces: unidade de isolamento de dados (tenant)
-- -----------------------------------------------------------------------------
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  type        public.workspace_type not null default 'personal',
  name        text not null check (char_length(name) between 1 and 120),
  -- Plano comercial. Alterado somente pelo backend (sem permissão de UPDATE para usuários).
  plan        text not null default 'free' check (plan in ('free', 'pro', 'school')),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.workspaces is
  'Espaço de trabalho: pessoal (professor independente) ou escola. Unidade de isolamento de dados.';

-- No máximo um espaço pessoal por usuário.
create unique index workspaces_one_personal_per_user
  on public.workspaces (created_by)
  where type = 'personal';

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- workspace_members: quem participa de qual espaço, com qual papel
-- -----------------------------------------------------------------------------
create table public.workspace_members (
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          public.workspace_role not null default 'teacher',
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

comment on table public.workspace_members is 'Participação de usuários em espaços de trabalho.';

-- A PK cobre buscas por workspace; este índice cobre "meus espaços" e a RLS.
create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- -----------------------------------------------------------------------------
-- Funções de autorização usadas pelas políticas RLS.
-- SECURITY DEFINER evita recursão de RLS ao consultar workspace_members.
-- -----------------------------------------------------------------------------
create function private.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
  );
$$;

create function private.has_workspace_role(
  target_workspace uuid,
  allowed_roles public.workspace_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.role = any (allowed_roles)
  );
$$;

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.has_workspace_role(uuid, public.workspace_role[]) from public;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, public.workspace_role[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Cadastro: ao criar um usuário, cria perfil + espaço pessoal + participação (owner).
-- -----------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
  new_workspace_id uuid;
begin
  -- Cadastro por e-mail envia 'full_name'; o Google envia 'full_name' e/ou 'name'.
  display_name := left(
    trim(coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      ''
    )),
    120
  );

  insert into public.profiles (id, full_name)
  values (new.id, display_name);

  insert into public.workspaces (type, name, created_by)
  values ('personal', 'Meu espaço', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Privilégios (defesa em profundidade, além da RLS)
--   anon: nenhum acesso direto a tabelas. Alunos usarão apenas funções RPC (Etapa 5).
--   authenticated: somente o necessário; colunas sensíveis (plan, type) não editáveis.
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.workspaces, public.workspace_members from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

grant select on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;

grant select on public.workspace_members to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- profiles: cada usuário vê e edita apenas o próprio perfil.
create policy "profiles: ler o próprio"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: editar o próprio"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- workspaces: membros leem; owner/admin renomeiam.
create policy "workspaces: membros leem"
  on public.workspaces for select to authenticated
  using ((select private.is_workspace_member(id)));

create policy "workspaces: owner/admin editam"
  on public.workspaces for update to authenticated
  using ((select private.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[])))
  with check ((select private.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[])));

-- workspace_members: membros veem os participantes do mesmo espaço.
-- Inclusão/remoção de membros fica para a gestão de escolas (fase futura).
create policy "workspace_members: membros leem"
  on public.workspace_members for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
