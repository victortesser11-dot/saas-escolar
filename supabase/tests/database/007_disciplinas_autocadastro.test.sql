-- Disciplinas da turma e autocadastro do aluno ao entrar na prova (retorno do piloto).
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@teste.local', '{"full_name": "Prof A"}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@teste.local', '{"full_name": "Prof B"}', 'authenticated', 'authenticated');

create temporary table ctx (name text primary key, id uuid, txt text) on commit drop;
grant select, insert, update on ctx to anon, authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

insert into ctx (name, id) select 'ws', id from public.workspaces;

insert into public.classes (id, workspace_id, teacher_id, name) values
  ('cccccccc-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7º B'),
  ('cccccccc-0000-0000-0000-000000000002', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '8º A');
select public.import_students('cccccccc-0000-0000-0000-000000000001', '[{"full_name": "Ana Souza", "registration_code": "01"}]');

-- -----------------------------------------------------------------------------
-- Número único por turma
-- -----------------------------------------------------------------------------
select is(
  public.import_students('cccccccc-0000-0000-0000-000000000001', '[{"full_name": "Outra Ana", "registration_code": "1"}]') ->> 'already_in_class',
  '1', 'número "1" é o mesmo que "01" na turma');

select lives_ok(
  $$ select public.import_students('cccccccc-0000-0000-0000-000000000002', '[{"full_name": "Bia Melo", "registration_code": "1"}]') $$,
  'o mesmo número pode existir em outra turma');

insert into public.students (id, workspace_id, full_name, registration_code)
values ('dddddddd-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'Caio Nunes', '2');
insert into public.class_students (workspace_id, class_id, student_id)
values ((select id from ctx where name = 'ws'), 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001');

select throws_ok(
  $$ update public.students set registration_code = '001' where id = 'dddddddd-0000-0000-0000-000000000001' $$,
  '23505', null, 'editar para um número já usado na turma é bloqueado');

select throws_ok(
  $$ insert into public.class_students (workspace_id, class_id, student_id)
     select workspace_id, 'cccccccc-0000-0000-0000-000000000001', id from public.students where full_name = 'Bia Melo' $$,
  '23505', null, 'vincular aluno com número repetido na turma é bloqueado');

-- -----------------------------------------------------------------------------
-- Disciplinas
-- -----------------------------------------------------------------------------
insert into public.subjects (id, workspace_id, name)
values ('55555555-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'Matemática'),
       ('55555555-0000-0000-0000-000000000002', (select id from ctx where name = 'ws'), 'Ciências');

select throws_ok(
  $$ insert into public.subjects (workspace_id, name) select id, 'matemática' from public.workspaces $$,
  '23505', null, 'disciplina com o mesmo nome (sem diferenciar maiúsculas) é bloqueada');

insert into ctx (name, id) select 'q1', public.save_question(null, (select id from ctx where name = 'ws'), 'single_choice', 'Quanto é 1+1?', null, 1, '{}',
  '[{"body": "2", "is_correct": true}, {"body": "3", "is_correct": false}]');
insert into public.exams (id, workspace_id, owner_id, title, subject_id)
values ('eeeeeeee-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Frações',
        '55555555-0000-0000-0000-000000000001');
select public.add_questions_to_exam('eeeeeeee-0000-0000-0000-000000000001', array[(select id from ctx where name = 'q1')]);
select public.publish_exam('eeeeeeee-0000-0000-0000-000000000001');
insert into public.exam_assignments (workspace_id, exam_id, class_id, opens_at, closes_at)
values ((select id from ctx where name = 'ws'), 'eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
        now() - interval '1 hour', now() + interval '1 hour');
insert into ctx (name, txt) select 'code', public_code from public.exam_assignments where exam_id = 'eeeeeeee-0000-0000-0000-000000000001';

select results_eq(
  $$ select subject_id from public.class_subjects where class_id = 'cccccccc-0000-0000-0000-000000000001' $$,
  $$ values ('55555555-0000-0000-0000-000000000001'::uuid) $$,
  'aplicar a prova inclui a disciplina dela na turma');

update public.exams set subject_id = '55555555-0000-0000-0000-000000000002' where id = 'eeeeeeee-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.class_subjects where class_id = 'cccccccc-0000-0000-0000-000000000001'),
  2, 'trocar a disciplina da prova aplicada inclui a nova disciplina na turma');

select lives_ok(
  $$ delete from public.class_subjects where class_id = 'cccccccc-0000-0000-0000-000000000001'
       and subject_id = '55555555-0000-0000-0000-000000000001' $$,
  'professor tira disciplina da turma');

delete from public.subjects where id = '55555555-0000-0000-0000-000000000002';
select is(
  (select subject_id from public.exams where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  null, 'excluir a disciplina deixa a prova sem disciplina (sem apagar a prova)');

-- Outro professor não vê as disciplinas.
set local request.jwt.claims to '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';
select is((select count(*)::int from public.subjects), 0, 'RLS: disciplinas de outro professor são invisíveis');
select is((select count(*)::int from public.class_subjects), 0, 'RLS: disciplinas das turmas de outro professor são invisíveis');

-- -----------------------------------------------------------------------------
-- Autocadastro (aluno anônimo)
-- -----------------------------------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

insert into ctx (name, txt)
select 'davi', public.start_attempt((select txt from ctx where name = 'code'), ' 07 ', '  Davi   Rocha ', null, null) ->> 'token';
select isnt((select txt from ctx where name = 'davi'), null, 'aluno fora da lista entra e começa a prova');

select is(
  public.start_attempt((select txt from ctx where name = 'code'), '7', 'davi', null, (select txt from ctx where name = 'davi')) ->> 'token',
  (select txt from ctx where name = 'davi'),
  'volta com "7" (= "07") e o primeiro nome: retoma a mesma prova');

select is(public.start_attempt((select txt from ctx where name = 'code'), '07', 'Eduardo', null, null) ->> 'error',
  'name_mismatch', 'número já cadastrado com outro nome: bloqueado');

select is(public.start_attempt((select txt from ctx where name = 'code'), '9', 'E', null, null) ->> 'error',
  'invalid_student', 'nome curto demais é recusado');

reset role;
select results_eq(
  $$ select s.full_name, s.registration_code, cs.joined_via
     from public.class_students cs join public.students s on s.id = cs.student_id
     where cs.class_id = 'cccccccc-0000-0000-0000-000000000001' and cs.joined_via = 'exam' $$,
  $$ values ('Davi Rocha'::text, '07'::text, 'exam'::text) $$,
  'aluno criado na turma com nome limpo, número e origem "prova"');

update public.classes set self_enroll = false where id = 'cccccccc-0000-0000-0000-000000000001';
set local role anon;
select is(public.start_attempt((select txt from ctx where name = 'code'), '30', 'Fábio', null, null) ->> 'error',
  'student_not_found', 'com o autocadastro desligado, só entra quem está na lista');

select * from finish();
rollback;
