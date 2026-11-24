-- Número na turma opcional: o aluno sem número é reconhecido pelo nome completo.
begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@teste.local', '{"full_name": "Prof A"}', 'authenticated', 'authenticated');

create temporary table ctx (name text primary key, id uuid, txt text) on commit drop;
grant select, insert, update on ctx to anon, authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';
insert into ctx (name, id) select 'ws', id from public.workspaces;

insert into public.classes (id, workspace_id, teacher_id, name)
values ('cccccccc-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '9º A');

-- Lista do professor: Bruno com número; dois "Caio Reis" com números diferentes.
select public.import_students('cccccccc-0000-0000-0000-000000000001', '[
  {"full_name": "Bruno Lima", "registration_code": "7"},
  {"full_name": "Caio Reis", "registration_code": "8"},
  {"full_name": "Caio Reis", "registration_code": "9"}]');

-- Professor também cadastra só com o nome; repetir o nome não duplica.
select is(
  public.import_students('cccccccc-0000-0000-0000-000000000001',
    '[{"full_name": "Eva Nunes", "registration_code": ""}, {"full_name": "Fábio Dias"}]') ->> 'created',
  '2', 'professor cadastra alunos sem número');
select is(
  public.import_students('cccccccc-0000-0000-0000-000000000001', '[{"full_name": "eva  NUNES"}]') ->> 'already_in_class',
  '1', 'mesmo nome completo sem número não duplica');

insert into public.exams (id, workspace_id, owner_id, title)
values ('eeeeeeee-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Prova');
select public.import_exam_questions('eeeeeeee-0000-0000-0000-000000000001',
  '[{"type": "essay", "stem": "Explique.", "points": 1, "tags": [], "options": []}]');
select public.publish_exam('eeeeeeee-0000-0000-0000-000000000001');
insert into public.exam_assignments (workspace_id, exam_id, class_id, opens_at, closes_at)
values ((select id from ctx where name = 'ws'), 'eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
        now() - interval '1 hour', now() + interval '1 hour');
insert into ctx (name, txt) select 'code', public_code from public.exam_assignments;

-- -----------------------------------------------------------------------------
-- Aluno (anônimo)
-- -----------------------------------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(public.start_attempt((select txt from ctx where name = 'code'), '', 'Ana', null, null) ->> 'error',
  'full_name_required', 'sem número, só o primeiro nome não basta');

insert into ctx (name, txt)
select 'ana', public.start_attempt((select txt from ctx where name = 'code'), '', '  Ana   Souza ', null, null) ->> 'token';
select isnt((select txt from ctx where name = 'ana'), null, 'sem número e fora da lista: entra pelo nome completo');

select is(
  public.start_attempt((select txt from ctx where name = 'code'), null, 'ANA SOUZA', null, (select txt from ctx where name = 'ana')) ->> 'token',
  (select txt from ctx where name = 'ana'),
  'volta pelo nome completo (sem acento/maiúsculas) e retoma a mesma prova');

insert into ctx (name, txt)
select 'bruno', public.start_attempt((select txt from ctx where name = 'code'), '', 'Bruno Lima', null, null) ->> 'token';
select isnt((select txt from ctx where name = 'bruno'), null, 'aluno da lista que não sabe o número entra pelo nome');

select is(public.start_attempt((select txt from ctx where name = 'code'), '', 'Caio Reis', null, null) ->> 'error',
  'ambiguous_name', 'dois alunos com o mesmo nome: pede o número');

insert into ctx (name, txt)
select 'davi', public.start_attempt((select txt from ctx where name = 'code'), '', 'Davi Melo', null, null) ->> 'token';
select is(
  public.start_attempt((select txt from ctx where name = 'code'), '12', 'Davi Melo', null, (select txt from ctx where name = 'davi')) ->> 'token',
  (select txt from ctx where name = 'davi'),
  'entrou sem número e depois informa o número: é o mesmo aluno');

select is(public.start_attempt((select txt from ctx where name = 'code'), '7', 'Ana Souza', null, null) ->> 'error',
  'name_mismatch', 'com número, o primeiro nome ainda precisa conferir');

reset role;
select results_eq(
  $$ select s.full_name, s.registration_code from public.class_students cs join public.students s on s.id = cs.student_id
     where cs.class_id = 'cccccccc-0000-0000-0000-000000000001' and cs.joined_via = 'exam' order by s.full_name $$,
  $$ values ('Ana Souza'::text, null::text), ('Davi Melo'::text, '12'::text) $$,
  'só Ana e Davi foram criados pela prova; Davi ganhou o número');

select is(
  (select count(*)::int from public.exam_attempts t join public.students s on s.id = t.student_id where s.full_name = 'Bruno Lima'),
  1, 'a prova de Bruno ficou no cadastro que o professor fez');

select is((select count(*)::int from public.class_students where class_id = 'cccccccc-0000-0000-0000-000000000001'),
  7, 'nenhum aluno duplicado');

update public.classes set self_enroll = false where id = 'cccccccc-0000-0000-0000-000000000001';
set local role anon;
select is(public.start_attempt((select txt from ctx where name = 'code'), '', 'Gil Prado', null, null) ->> 'error',
  'student_not_found', 'lista fechada: nome desconhecido sem número não entra');

select * from finish();
rollback;
