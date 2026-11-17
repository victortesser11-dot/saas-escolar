-- Provas: montagem, publicação (cópia congelada), travas, aplicação em turmas e isolamento.
begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@teste.local', '{"full_name": "Prof A"}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@teste.local', '{"full_name": "Prof B"}', 'authenticated', 'authenticated');

create temporary table ws on commit drop as
select (select id from public.workspaces where created_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as a;
grant select on ws to authenticated;

create temporary table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Banco: três questões (valores 1, 1 e 2).
insert into ids select 'q1', public.save_question(null, a, 'single_choice', 'Q1', 'Resolução Q1', 1, '{}',
  '[{"body": "certa", "is_correct": true}, {"body": "errada", "is_correct": false}]') from ws;
insert into ids select 'q2', public.save_question(null, a, 'short_answer', 'Q2', null, 1, '{}',
  '[{"body": "Brasília", "is_correct": true}, {"body": "Brasília DF", "is_correct": true}]') from ws;
insert into ids select 'q3', public.save_question(null, a, 'essay', 'Q3', null, 2, '{}', '[]') from ws;

insert into public.exams (id, workspace_id, owner_id, title)
select 'eeeeeeee-0000-0000-0000-000000000001', a, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Prova de frações' from ws;

insert into public.classes (id, workspace_id, teacher_id, name)
select 'cccccccc-0000-0000-0000-000000000001', a, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7º A' from ws;

select throws_ok(
  $$ select public.publish_exam('eeeeeeee-0000-0000-0000-000000000001') $$,
  '22023', 'Adicione ao menos uma questão antes de publicar.', 'prova vazia não é publicada');

select is(
  public.add_questions_to_exam('eeeeeeee-0000-0000-0000-000000000001',
    array[(select id from ids where name = 'q1'), (select id from ids where name = 'q2'), (select id from ids where name = 'q3')]),
  3, 'três questões adicionadas');

select is(
  public.add_questions_to_exam('eeeeeeee-0000-0000-0000-000000000001', array[(select id from ids where name = 'q1')]),
  0, 'questão repetida não é adicionada de novo');

select is(
  (select array_agg(points order by position) from public.exam_questions where exam_id = 'eeeeeeee-0000-0000-0000-000000000001'),
  array[1, 1, 2]::numeric[], 'valor padrão copiado e ordem preservada');

select lives_ok(
  $$ select public.move_exam_question(
       (select id from public.exam_questions where question_id = (select id from ids where name = 'q3')), -1) $$,
  'mover questão para cima');
select is(
  (select array_agg(q.stem order by eq.position) from public.exam_questions eq join public.questions q on q.id = eq.question_id
    where eq.exam_id = 'eeeeeeee-0000-0000-0000-000000000001'),
  array['Q1', 'Q3', 'Q2'], 'nova ordem');

-- Q-01: sorteio de parte das questões exige valores iguais.
update public.exams set questions_per_attempt = 2 where id = 'eeeeeeee-0000-0000-0000-000000000001';
select throws_ok(
  $$ select public.publish_exam('eeeeeeee-0000-0000-0000-000000000001') $$,
  '22023', 'Quando cada aluno recebe só parte das questões, todas precisam ter o mesmo valor.',
  'sorteio parcial com valores diferentes é bloqueado');

update public.exams set questions_per_attempt = 5 where id = 'eeeeeeee-0000-0000-0000-000000000001';
select throws_ok(
  $$ select public.publish_exam('eeeeeeee-0000-0000-0000-000000000001') $$,
  '22023', null, 'sortear mais questões do que existem é bloqueado');

update public.exams set questions_per_attempt = null where id = 'eeeeeeee-0000-0000-0000-000000000001';

select throws_ok(
  $$ insert into public.exam_assignments (workspace_id, exam_id, class_id, opens_at, closes_at)
     select a, 'eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', now() + interval '1 day', now() + interval '2 days' from ws $$,
  '55000', 'Publique a prova antes de aplicá-la em uma turma.', 'rascunho não pode ser aplicado');

select lives_ok($$ select public.publish_exam('eeeeeeee-0000-0000-0000-000000000001') $$, 'publicação válida');
select is((select status::text from public.exams where id = 'eeeeeeee-0000-0000-0000-000000000001'), 'published', 'status publicado');

-- Cópia congelada e gabarito.
select is(
  (select content ->> 'stem' from public.exam_questions where question_id = (select id from ids where name = 'q1')),
  'Q1', 'enunciado congelado');
select is(
  (select jsonb_array_length(content -> 'options') from public.exam_questions where question_id = (select id from ids where name = 'q1')),
  2, 'alternativas congeladas com id');
select is(
  (select jsonb_array_length(content -> 'options') from public.exam_questions where question_id = (select id from ids where name = 'q2')),
  0, 'respostas aceitas NÃO entram no conteúdo visível');
select is(
  (select answer_key -> 'accepted' from public.exam_questions where question_id = (select id from ids where name = 'q2')),
  '["Brasília", "Brasília DF"]'::jsonb, 'respostas aceitas no gabarito');
select is(
  (select jsonb_array_length(answer_key -> 'correct') from public.exam_questions where question_id = (select id from ids where name = 'q1')),
  1, 'alternativa correta no gabarito');

-- Editar o banco depois não altera a prova.
select lives_ok(
  $$ select public.save_question((select id from ids where name = 'q1'), null, 'single_choice', 'Q1 editada', null, 1, '{}',
       '[{"body": "nova", "is_correct": true}, {"body": "outra", "is_correct": false}]') $$,
  'questão do banco editada após a publicação');
select is(
  (select content ->> 'stem' from public.exam_questions where question_id = (select id from ids where name = 'q1')),
  'Q1', 'prova mantém o enunciado congelado');

-- Travas.
select throws_ok(
  $$ update public.exam_questions set points = 5 where exam_id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  '55000', null, 'valores travados após publicar');
select throws_ok(
  $$ delete from public.exam_questions where exam_id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  '55000', null, 'questões travadas após publicar');
select throws_ok(
  $$ update public.exams set time_limit_minutes = 30 where id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  '55000', null, 'regras travadas após publicar');
select lives_ok(
  $$ update public.exams set title = 'Prova de frações (1º bimestre)' where id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  'título pode ser ajustado após publicar');
select throws_ok(
  $$ update public.exam_questions set content = '{}' $$,
  '42501', null, 'cópia congelada não é gravável pelo usuário');
select throws_ok(
  $$ delete from public.questions where id = (select id from ids where name = 'q3') $$,
  '23503', null, 'questão usada em prova não pode ser excluída do banco');

-- Aplicação na turma.
select lives_ok(
  $$ insert into public.exam_assignments (workspace_id, exam_id, class_id, opens_at, closes_at, access_code)
     select a, 'eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', now() - interval '1 hour', now() + interval '1 day', '4821' from ws $$,
  'prova aplicada na turma');
select matches(
  (select public_code from public.exam_assignments where exam_id = 'eeeeeeee-0000-0000-0000-000000000001'),
  '^[2-9A-Z]{8}$', 'código público gerado');
select throws_ok(
  $$ select public.unpublish_exam('eeeeeeee-0000-0000-0000-000000000001') $$,
  '55000', 'Remova as aplicações nas turmas antes de voltar a prova para rascunho.',
  'prova aplicada não volta a rascunho');
select is((select status::text from public.exams where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'published', 'prova continua publicada');
select throws_ok(
  $$ delete from public.classes where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '23503', null, 'turma com prova aplicada não pode ser excluída');

-- Professor B.
set local request.jwt.claims to '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';
select is((select count(*)::int from public.exams), 0, 'B não vê provas de A');
select throws_ok(
  $$ select public.publish_exam('eeeeeeee-0000-0000-0000-000000000001') $$,
  'P0002', null, 'B não publica prova de A');

select * from finish();
rollback;
