-- Professor: correção manual, liberações, encerramento e isolamento.
begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@teste.local', '{"full_name": "Prof A"}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@teste.local', '{"full_name": "Prof B"}', 'authenticated', 'authenticated');

create temporary table ctx (name text primary key, id uuid, txt text) on commit drop;
grant select, insert, update on ctx to anon, authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

insert into ctx (name, id) select 'ws', id from public.workspaces where created_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
insert into ctx (name, id) select 'q_single', public.save_question(null, (select id from ctx where name = 'ws'), 'single_choice', '1+1?', null, 1, '{}',
  '[{"body": "2", "is_correct": true}, {"body": "3", "is_correct": false}]');
insert into ctx (name, id) select 'q_essay', public.save_question(null, (select id from ctx where name = 'ws'), 'essay', 'Explique.', null, 2, '{}', '[]');

insert into public.classes (id, workspace_id, teacher_id, name)
values ('cccccccc-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7º A');
select public.import_students('cccccccc-0000-0000-0000-000000000001',
  '[{"full_name": "Ana Souza", "registration_code": "101"}, {"full_name": "Bruno Lima", "registration_code": "102"}]');
insert into ctx (name, id) select 'ana', id from public.students where registration_code = '101' and workspace_id = (select id from ctx where name = 'ws');
insert into ctx (name, id) select 'bruno', id from public.students where registration_code = '102' and workspace_id = (select id from ctx where name = 'ws');

insert into public.exams (id, workspace_id, owner_id, title)
values ('eeeeeeee-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Prova');
select public.add_questions_to_exam('eeeeeeee-0000-0000-0000-000000000001',
  array[(select id from ctx where name = 'q_single'), (select id from ctx where name = 'q_essay')]);
select public.publish_exam('eeeeeeee-0000-0000-0000-000000000001');
insert into public.exam_assignments (id, workspace_id, exam_id, class_id, opens_at, closes_at)
values ('aaaa0000-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'eeeeeeee-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001', now() - interval '1 hour', now() + interval '1 hour');
insert into ctx (name, txt) select 'code', public_code from public.exam_assignments where id = 'aaaa0000-0000-0000-0000-000000000001';

-- Alunos (anônimos): Ana responde e envia; Bruno começa e é interrompido.
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
insert into ctx (name, txt) select 'ana_token', public.start_attempt((select txt from ctx where name = 'code'), '101', 'Ana', null, null) ->> 'token';
create temporary table aq on commit drop as
select q ->> 'type' as qtype, (q ->> 'id')::uuid as id, q -> 'options' as options
from jsonb_array_elements(public.get_attempt((select txt from ctx where name = 'ana_token')) -> 'questions') q;
select public.save_answer((select txt from ctx where name = 'ana_token'), (select id from aq where qtype = 'single_choice'),
  array(select (o ->> 'id')::uuid from aq, jsonb_array_elements(options) o where qtype = 'single_choice' and o ->> 'body' = '2'), null);
select public.save_answer((select txt from ctx where name = 'ana_token'), (select id from aq where qtype = 'essay'), null, 'Minha explicação.');
select public.submit_attempt((select txt from ctx where name = 'ana_token'));

insert into ctx (name, txt) select 'bruno_token', public.start_attempt((select txt from ctx where name = 'code'), '102', 'Bruno', null, null) ->> 'token';
select public.start_attempt((select txt from ctx where name = 'code'), '102', 'Bruno', null, null);

-- Professor A.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

select is((select grading_status::text from public.exam_attempts where student_id = (select id from ctx where name = 'ana')),
  'pending_review', 'Ana aguarda correção');
select is((select final_score from public.exam_attempts where student_id = (select id from ctx where name = 'ana')),
  null, 'nota final indefinida enquanto há dissertativa pendente');

insert into ctx (name, id)
select 'essay_answer', sa.id from public.student_answers sa
join public.attempt_questions aq2 on aq2.id = sa.attempt_question_id
join public.exam_questions eq on eq.id = aq2.exam_question_id
where eq.question_id = (select id from ctx where name = 'q_essay');

select is(public.grade_answer((select id from ctx where name = 'essay_answer'), 3) ->> 'error', 'invalid_points', 'pontos acima do valor são recusados');
select is(public.grade_answer((select id from ctx where name = 'essay_answer'), 1.5) ->> 'ok', 'true', 'correção manual');
select is((select final_score from public.exam_attempts where student_id = (select id from ctx where name = 'ana')),
  2.5::numeric, 'nota final = 1 (objetiva) + 1,5 (dissertativa)');
select is((select grading_status::text from public.exam_attempts where student_id = (select id from ctx where name = 'ana')),
  'graded', 'aplicação corrigida');
select is((select count(*)::int from public.exam_events where type = 'graded'), 1, 'correção registrada no histórico');

-- Revisão de questão automática (ex.: resposta curta aceita pelo professor).
select is(public.grade_answer((select sa.id from public.student_answers sa
  join public.attempt_questions aq2 on aq2.id = sa.attempt_question_id
  join public.exam_questions eq on eq.id = aq2.exam_question_id
  where eq.question_id = (select id from ctx where name = 'q_single')), 0) ->> 'ok', 'true', 'professor pode revisar questão automática');
select is((select final_score from public.exam_attempts where student_id = (select id from ctx where name = 'ana')),
  1.5::numeric, 'nota recalculada após revisão');

-- Liberações.
select is(public.grant_release('aaaa0000-0000-0000-0000-000000000001', (select id from ctx where name = 'ana'), 'resume', 0, null) ->> 'error',
  'not_interrupted', 'retomada só para aplicação interrompida');
select is(public.grant_release('aaaa0000-0000-0000-0000-000000000001', (select id from ctx where name = 'bruno'), 'resume', 10, 'Celular descarregou') ->> 'ok',
  'true', 'retomada liberada para Bruno');
select is(public.grant_release('aaaa0000-0000-0000-0000-000000000001', (select id from ctx where name = 'ana'), 'new_attempt', 0, null) ->> 'ok',
  'true', 'nova tentativa liberada para Ana');
select is((select count(*)::int from public.attempt_releases where consumed_at is null), 2, 'duas liberações pendentes');

-- Bruno retoma.
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select ok(public.start_attempt((select txt from ctx where name = 'code'), '102', 'Bruno', null, null) ? 'token', 'Bruno retoma com a liberação');

-- Encerrar a turma agora limita o prazo de quem está fazendo.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';
update public.exam_assignments set closed_at = now() where id = 'aaaa0000-0000-0000-0000-000000000001';
select ok((select expires_at <= now() from public.exam_attempts
  where student_id = (select id from ctx where name = 'bruno') and status = 'in_progress'), 'encerrar agora antecipa o prazo de quem está fazendo');

select is(public.teacher_finalize_attempt((select id from public.exam_attempts
  where student_id = (select id from ctx where name = 'bruno') and status = 'in_progress')) ->> 'ok', 'true', 'professor encerra a aplicação');
select is(public.grant_release('aaaa0000-0000-0000-0000-000000000001', (select id from ctx where name = 'bruno'), 'new_attempt', 0, null) ->> 'error',
  'assignment_closed', 'não libera depois de encerrada a turma');

-- Professor B não interfere.
set local request.jwt.claims to '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';
select is(public.grade_answer((select id from ctx where name = 'essay_answer'), 0) ->> 'error', 'not_found', 'B não corrige provas de A');
select is((select count(*)::int from public.exam_attempts), 0, 'B não vê aplicações de A');

select * from finish();
rollback;
