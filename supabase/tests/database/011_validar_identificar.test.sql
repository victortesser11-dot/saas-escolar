-- Validação manual de prova interrompida e identificação da prova para o aluno.
begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@teste.local', '{"full_name": "Prof Ana Lima"}', 'authenticated', 'authenticated');

create temporary table ctx (name text primary key, id uuid, txt text) on commit drop;
grant select, insert, update on ctx to anon, authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';
insert into ctx (name, id) select 'ws', id from public.workspaces;

insert into public.classes (id, workspace_id, teacher_id, name)
values ('cccccccc-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '21N');
insert into public.subjects (id, workspace_id, name)
values ('55555555-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'Literatura');
insert into public.exams (id, workspace_id, owner_id, title, subject_id, period, shuffle_questions)
values ('eeeeeeee-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Recuperação', '55555555-0000-0000-0000-000000000001', '1º trimestre', false);
select public.import_exam_questions('eeeeeeee-0000-0000-0000-000000000001', '[
  {"type": "single_choice", "stem": "Q1", "points": 1, "tags": [], "options": [{"body": "certa", "is_correct": true}, {"body": "errada", "is_correct": false}]},
  {"type": "single_choice", "stem": "Q2", "points": 1, "tags": [], "options": [{"body": "certa", "is_correct": true}, {"body": "errada", "is_correct": false}]},
  {"type": "single_choice", "stem": "Q3", "points": 1, "tags": [], "options": [{"body": "certa", "is_correct": true}, {"body": "errada", "is_correct": false}]}]');
select public.publish_exam('eeeeeeee-0000-0000-0000-000000000001');
insert into public.exam_assignments (id, workspace_id, exam_id, class_id, opens_at, closes_at)
values ('aaaa0000-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'eeeeeeee-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001', now() - interval '1 hour', now() + interval '1 hour');
insert into ctx (name, txt) select 'code', public_code from public.exam_assignments;

-- -----------------------------------------------------------------------------
-- Aluno: vê a identificação, responde 2 de 3 e é interrompido.
-- -----------------------------------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(
  (select jsonb_build_object('t', e ->> 'title', 's', e ->> 'subject_name', 'p', e ->> 'period', 'c', e ->> 'class_name', 'prof', e ->> 'teacher_name')
   from (select public.get_exam_entry((select txt from ctx where name = 'code')) as e) x),
  '{"t": "Recuperação", "s": "Literatura", "p": "1º trimestre", "c": "21N", "prof": "Prof Ana Lima"}'::jsonb,
  'entrada mostra prova, disciplina, período, turma e professor(a)');

insert into ctx (name, txt)
select 'tok', public.start_attempt((select txt from ctx where name = 'code'), '', 'Sabrina Ramos', null, null) ->> 'token';

-- Responde corretamente as questões 1 e 2 (a 3 fica em branco).
select public.save_answer((select txt from ctx where name = 'tok'), (q ->> 'id')::uuid,
  array[(select (o ->> 'id')::uuid from jsonb_array_elements(q -> 'options') o where o ->> 'body' = 'certa')], null::text)
from jsonb_array_elements(public.get_attempt((select txt from ctx where name = 'tok')) -> 'questions') with ordinality as x(q, n)
where n <= 2;

-- Abre em outro aparelho: interrompe. O professor libera a retomada, mas ela não volta.
select is(public.start_attempt((select txt from ctx where name = 'code'), '', 'Sabrina Ramos', null, null) ->> 'error',
  'interrupted', 'acesso de outro aparelho interrompe');

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';
insert into ctx (name, id) select 'attempt', id from public.exam_attempts;
insert into ctx (name, id) select 'student', student_id from public.exam_attempts;
select public.grant_release('aaaa0000-0000-0000-0000-000000000001', (select id from ctx where name = 'student'), 'resume', 10, null);

-- -----------------------------------------------------------------------------
-- Professor valida a prova interrompida.
-- -----------------------------------------------------------------------------
create temporary table antes on commit drop as
  select attempt_question_id, selected_option_ids, text_answer from public.student_answers
  where attempt_id = (select id from ctx where name = 'attempt');

select is(public.teacher_finalize_attempt((select id from ctx where name = 'attempt')) - 'ok',
  '{"answers_saved": 2, "questions": 3}'::jsonb, 'valida informando as respostas salvas');

select is((select status::text from public.exam_attempts where id = (select id from ctx where name = 'attempt')),
  'submitted', 'tentativa passa a concluída');
select is((select finalize_reason from public.exam_attempts where id = (select id from ctx where name = 'attempt')),
  'teacher', 'motivo: finalizada pelo professor');
select is((select auto_score from public.exam_attempts where id = (select id from ctx where name = 'attempt')),
  2.00::numeric, 'nota calculada só com as respostas salvas (2 de 3)');

select is(
  (select count(*)::int from public.student_answers sa join antes a using (attempt_question_id)
   where sa.attempt_id = (select id from ctx where name = 'attempt')
     and (sa.selected_option_ids is distinct from a.selected_option_ids or sa.text_answer is distinct from a.text_answer)),
  0, 'nenhuma resposta salva foi alterada');
select is(
  (select count(*)::int from public.student_answers
   where attempt_id = (select id from ctx where name = 'attempt') and cardinality(selected_option_ids) > 0),
  2, 'nenhuma resposta foi inventada (a questão em branco continua em branco)');

select is(
  (select payload ->> 'by_name' from public.exam_events where type = 'validated'),
  'Prof Ana Lima', 'histórico registra quem validou');
select is(
  (select count(*)::int from public.attempt_releases where consumed_at is null),
  0, 'a retomada pendente é cancelada');

select is(public.teacher_finalize_attempt((select id from ctx where name = 'attempt')) ->> 'error',
  'already_finalized', 'não valida duas vezes');

select * from finish();
rollback;
