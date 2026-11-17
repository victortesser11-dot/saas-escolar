-- Testes de turmas e alunos: isolamento, integridade e importação em lote.
begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@teste.local', '{"full_name": "Prof A"}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@teste.local', '{"full_name": "Prof B"}', 'authenticated', 'authenticated');

-- Atalhos para os espaços pessoais (criados pelo trigger de cadastro).
create temporary table ws on commit drop as
select
  (select id from public.workspaces where created_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as a,
  (select id from public.workspaces where created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') as b;
grant select on ws to authenticated;

-- -----------------------------------------------------------------------------
-- Normalização da matrícula
-- -----------------------------------------------------------------------------
select is(private.normalize_registration_code('  2024a 013 '), '2024A013', 'matrícula é normalizada');

-- -----------------------------------------------------------------------------
-- Professora A
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.classes (id, workspace_id, teacher_id, name, school_year)
     select '11111111-0000-0000-0000-000000000001', a, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7º ano B', 2026 from ws $$,
  'A cria uma turma no próprio espaço'
);

select throws_ok(
  $$ insert into public.classes (workspace_id, teacher_id, name)
     select a, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Turma em nome de outro' from ws $$,
  '42501', null,
  'A não cria turma em nome de outro professor'
);

select throws_ok(
  $$ insert into public.classes (workspace_id, teacher_id, name)
     select b, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Turma invasora' from ws $$,
  '42501', null,
  'A não cria turma no espaço de B'
);

select throws_ok(
  $$ insert into public.classes (workspace_id, teacher_id, name)
     select a, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '   ' from ws $$,
  '23514', null,
  'nome de turma em branco é rejeitado'
);

select throws_ok(
  $$ insert into public.students (workspace_id, full_name, registration_code)
     select a, 'Ana Souza', '2024a013' from ws $$,
  '23514', null,
  'matrícula não normalizada é rejeitada pelo banco'
);

select is(
  public.import_students(
    '11111111-0000-0000-0000-000000000001',
    '[{"full_name": "Ana  Souza", "registration_code": "2024a013"},
      {"full_name": "Bruno Lima", "registration_code": "2024A014"},
      {"full_name": "Carla Dias", "registration_code": "2024 a015"}]'::jsonb
  ),
  '{"created": 3, "existing": 0, "linked": 3, "already_in_class": 0}'::jsonb,
  'importação cria e vincula 3 alunos'
);

select is(
  (select full_name from public.students where registration_code = '2024A013'),
  'Ana Souza',
  'importação normaliza espaços do nome'
);

select is(
  public.import_students(
    '11111111-0000-0000-0000-000000000001',
    '[{"full_name": "Ana S.", "registration_code": "2024A013"},
      {"full_name": "Davi Rocha", "registration_code": "2024A016"}]'::jsonb
  ),
  '{"created": 1, "existing": 1, "linked": 1, "already_in_class": 1}'::jsonb,
  'reimportar não duplica alunos nem vínculos'
);

select is(
  (select full_name from public.students where registration_code = '2024A013'),
  'Ana Souza',
  'reimportação mantém o nome já cadastrado'
);

select throws_ok(
  $$ select public.import_students('11111111-0000-0000-0000-000000000001',
       '[{"full_name": "X", "registration_code": "2024A099"}]'::jsonb) $$,
  '23514', null,
  'importação com dado inválido é rejeitada por inteiro'
);

select is(
  (select count(*)::int from public.students where registration_code = '2024A099'),
  0,
  'nenhum aluno parcial fica gravado após falha'
);

select is((select count(*)::int from public.class_students), 4, 'turma de A tem 4 alunos');

-- -----------------------------------------------------------------------------
-- Professor B
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select is((select count(*)::int from public.classes), 0, 'B não vê turmas de A');
select is((select count(*)::int from public.students), 0, 'B não vê alunos de A');
select is((select count(*)::int from public.class_students), 0, 'B não vê vínculos de A');

select throws_ok(
  $$ select public.import_students('11111111-0000-0000-0000-000000000001',
       '[{"full_name": "Intruso", "registration_code": "X1"}]'::jsonb) $$,
  'P0002', 'Turma não encontrada.',
  'B não importa alunos na turma de A'
);

insert into public.classes (id, workspace_id, teacher_id, name)
select '22222222-0000-0000-0000-000000000002', b, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Turma de B' from ws;

-- B tenta vincular um aluno de A à própria turma: a FK composta impede.
reset role;
create temporary table aluno_a on commit drop as
  select id from public.students where registration_code = '2024A014';
grant select on aluno_a to authenticated;
set local role authenticated;
set local request.jwt.claims to '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.class_students (workspace_id, class_id, student_id)
     select ws.b, '22222222-0000-0000-0000-000000000002', aluno_a.id from ws, aluno_a $$,
  '23503', null,
  'aluno de outro espaço não pode entrar na turma de B'
);

delete from public.students;
update public.classes set name = 'invadida';

-- B pode ter um aluno com a mesma matrícula de um aluno de A (espaços diferentes).
select lives_ok(
  $$ insert into public.students (workspace_id, full_name, registration_code)
     select b, 'Outro Bruno', '2024A014' from ws $$,
  'matrícula é única por espaço, não global'
);

-- -----------------------------------------------------------------------------
-- Anônimo
-- -----------------------------------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok($$ select count(*) from public.students $$, '42501', null, 'anônimo não lê alunos');
select throws_ok(
  $$ select public.import_students('11111111-0000-0000-0000-000000000001', '[]'::jsonb) $$,
  '42501', null,
  'anônimo não executa a importação'
);

-- -----------------------------------------------------------------------------
-- Conferência final
-- -----------------------------------------------------------------------------
reset role;
select is(
  (select count(*)::int from public.students s join ws on s.workspace_id = ws.a),
  4,
  'as tentativas de B não apagaram alunos de A'
);

select * from finish();
rollback;
