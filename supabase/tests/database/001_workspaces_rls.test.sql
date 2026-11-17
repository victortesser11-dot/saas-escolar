-- Testes de isolamento: perfis, espaços de trabalho e membros.
-- Executar com: npm run db:test
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- -----------------------------------------------------------------------------
-- Preparação: dois professores (A e B)
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'prof.a@teste.local',
   '{"full_name": "Professora A"}', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'prof.b@teste.local',
   '{"name": "Professor B (Google)"}', 'authenticated', 'authenticated');

-- -----------------------------------------------------------------------------
-- Cadastro automático (trigger)
-- -----------------------------------------------------------------------------
select is(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Professora A',
  'cadastro por e-mail cria perfil com full_name'
);

select is(
  (select full_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'Professor B (Google)',
  'cadastro pelo Google usa o campo name'
);

select is(
  (select count(*)::int from public.workspaces
    where created_by = '11111111-1111-1111-1111-111111111111' and type = 'personal'),
  1,
  'cadastro cria exatamente um espaço pessoal'
);

select is(
  (select m.role::text
     from public.workspace_members m
     join public.workspaces w on w.id = m.workspace_id
    where w.created_by = '11111111-1111-1111-1111-111111111111'
      and m.user_id = '11111111-1111-1111-1111-111111111111'),
  'owner',
  'criador é owner do espaço pessoal'
);

select throws_ok(
  $$ insert into public.workspaces (type, name, created_by)
     values ('personal', 'Outro', '11111111-1111-1111-1111-111111111111') $$,
  '23505',
  null,
  'não é possível ter dois espaços pessoais'
);

-- -----------------------------------------------------------------------------
-- Visão da professora A
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'A vê apenas o próprio perfil');
select is((select count(*)::int from public.workspaces), 1, 'A vê apenas o próprio espaço');
select is((select count(*)::int from public.workspace_members), 1, 'A vê apenas membros do próprio espaço');

select is(
  (select count(*)::int from public.workspaces
    where created_by = '22222222-2222-2222-2222-222222222222'),
  0,
  'A não enxerga o espaço de B'
);

-- Tentativa de alterar o espaço de B: a RLS filtra, nenhuma linha é afetada.
update public.workspaces set name = 'invadido'
 where created_by = '22222222-2222-2222-2222-222222222222';

select lives_ok(
  $$ update public.workspaces set name = 'Espaço da A'
      where created_by = '11111111-1111-1111-1111-111111111111' $$,
  'A pode renomear o próprio espaço'
);

select throws_ok(
  $$ update public.workspaces set plan = 'pro' $$,
  '42501',
  null,
  'A não pode alterar o próprio plano'
);

select throws_ok(
  $$ insert into public.workspaces (type, name) values ('school', 'Escola falsa') $$,
  '42501',
  null,
  'A não pode criar espaços diretamente'
);

select throws_ok(
  $$ insert into public.workspace_members (workspace_id, user_id, role)
     select id, '11111111-1111-1111-1111-111111111111', 'owner' from public.workspaces limit 1 $$,
  '42501',
  null,
  'A não pode inserir membros diretamente'
);

update public.profiles set full_name = 'invadido'
 where id = '22222222-2222-2222-2222-222222222222';

-- -----------------------------------------------------------------------------
-- Visão anônima (aluno / visitante)
-- -----------------------------------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
  $$ select count(*) from public.workspaces $$,
  '42501',
  null,
  'anônimo não acessa workspaces'
);

select throws_ok(
  $$ select count(*) from public.profiles $$,
  '42501',
  null,
  'anônimo não acessa profiles'
);

-- -----------------------------------------------------------------------------
-- Conferência final (como superusuário): as tentativas de invasão não surtiram efeito
-- -----------------------------------------------------------------------------
reset role;

select is(
  (select name from public.workspaces where created_by = '22222222-2222-2222-2222-222222222222'),
  'Meu espaço',
  'o espaço de B permaneceu intacto'
);

select is(
  (select full_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'Professor B (Google)',
  'o perfil de B permaneceu intacto'
);

select * from finish();
rollback;
