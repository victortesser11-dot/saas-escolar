-- Banco de questões: regras por tipo, gravação atômica, isolamento e proteção do gabarito.
begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@teste.local', '{"full_name": "Prof A"}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@teste.local', '{"full_name": "Prof B"}', 'authenticated', 'authenticated');

create temporary table ws on commit drop as
select
  (select id from public.workspaces where created_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as a,
  (select id from public.workspaces where created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') as b;
grant select on ws to authenticated;

create temporary table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to authenticated;

select is(
  private.normalize_tags(array[' Frações ', 'frações', '', '7º  ano', 'Geometria']),
  array['frações', '7º ano', 'geometria'],
  'tags são normalizadas e deduplicadas'
);

-- -----------------------------------------------------------------------------
-- Professora A
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

insert into ids
select 'single', public.save_question(null, ws.a, 'single_choice', '  Quanto é 3/4 de 1/2?  ', null, 1.5,
  array['Frações'],
  '[{"body": "3/8", "is_correct": true}, {"body": "1/2", "is_correct": false}, {"body": "3/2", "is_correct": false}]')
from ws;

select is((select stem from public.questions where id = (select id from ids where name = 'single')),
  'Quanto é 3/4 de 1/2?', 'enunciado é gravado sem espaços nas pontas');
select is((select count(*)::int from public.question_options where question_id = (select id from ids where name = 'single')),
  3, 'alternativas gravadas');
select is(
  (select array_agg(body order by position) from public.question_options
    where question_id = (select id from ids where name = 'single')),
  array['3/8', '1/2', '3/2'],
  'ordem das alternativas preservada'
);
select is((select author_id from public.questions where id = (select id from ids where name = 'single')),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'autor é quem salvou');

select throws_ok(
  $$ select public.save_question(null, (select a from ws), 'single_choice', 'Sem gabarito', null, 1, '{}',
       '[{"body": "A", "is_correct": false}, {"body": "B", "is_correct": false}]') $$,
  '22023', null, 'múltipla escolha sem correta é rejeitada');

select throws_ok(
  $$ select public.save_question(null, (select a from ws), 'single_choice', 'Duas corretas', null, 1, '{}',
       '[{"body": "A", "is_correct": true}, {"body": "B", "is_correct": true}]') $$,
  '22023', null, 'múltipla escolha com duas corretas é rejeitada');

select throws_ok(
  $$ select public.save_question(null, (select a from ws), 'single_choice', 'Uma alternativa', null, 1, '{}',
       '[{"body": "A", "is_correct": true}]') $$,
  '22023', null, 'múltipla escolha com uma alternativa só é rejeitada');

select lives_ok(
  $$ select public.save_question(null, (select a from ws), 'true_false', 'A Terra é redonda.', null, 1, '{}',
       '[{"body": "Verdadeiro", "is_correct": true}, {"body": "Falso", "is_correct": false}]') $$,
  'verdadeiro ou falso válido');

select lives_ok(
  $$ select public.save_question(null, (select a from ws), 'multiple_choice', 'Quais são primos?', null, 2, '{}',
       '[{"body": "2", "is_correct": true}, {"body": "3", "is_correct": true}, {"body": "4", "is_correct": false}]') $$,
  'seleção múltipla com duas corretas é válida');

select throws_ok(
  $$ select public.save_question(null, (select a from ws), 'short_answer', 'Capital do Brasil?', null, 1, '{}',
       '[{"body": "Brasília", "is_correct": true}, {"body": "Rio", "is_correct": false}]') $$,
  '22023', null, 'resposta curta não aceita alternativa marcada como errada');

select lives_ok(
  $$ select public.save_question(null, (select a from ws), 'essay', 'Explique a fotossíntese.', 'Citar luz, água e CO2.', 3, '{}', '[]') $$,
  'dissertativa sem alternativas é válida');

select throws_ok(
  $$ select public.save_question(null, (select a from ws), 'essay', 'Com alternativa', null, 1, '{}',
       '[{"body": "A", "is_correct": true}]') $$,
  '22023', null, 'dissertativa com alternativa é rejeitada');

select throws_ok(
  $$ select public.save_question(null, (select a from ws), 'essay', 'Pontos zero', null, 0, '{}', '[]') $$,
  '23514', null, 'pontuação zero é rejeitada');

-- Edição: troca as alternativas de forma atômica.
select lives_ok(
  $$ select public.save_question((select id from ids where name = 'single'), null, 'single_choice', 'Quanto é 3/4 de 1/2?', 'Multiplique numeradores e denominadores.', 2, array['frações', 'multiplicação'],
       '[{"body": "3/8", "is_correct": true}, {"body": "6/8", "is_correct": false}]') $$,
  'edição válida');
select is((select count(*)::int from public.question_options where question_id = (select id from ids where name = 'single')),
  2, 'alternativas antigas substituídas');

-- Edição inválida não altera nada (transação desfeita).
select throws_ok(
  $$ select public.save_question((select id from ids where name = 'single'), null, 'single_choice', 'Alterado', null, 2, '{}',
       '[{"body": "X", "is_correct": false}, {"body": "Y", "is_correct": false}]') $$,
  '22023', null, 'edição inválida é rejeitada');
select is((select stem from public.questions where id = (select id from ids where name = 'single')),
  'Quanto é 3/4 de 1/2?', 'questão permanece como estava após edição inválida');

select throws_ok(
  $$ insert into public.question_options (workspace_id, question_id, body, is_correct, position)
     values ((select a from ws), (select id from ids where name = 'single'), 'Injetada', true, 5) $$,
  '42501', null, 'não é possível gravar alternativas diretamente');

select throws_ok(
  $$ update public.questions set stem = 'direto' $$,
  '42501', null, 'não é possível editar questões diretamente');

-- -----------------------------------------------------------------------------
-- Professor B
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select is((select count(*)::int from public.question_options), 0, 'B não vê o gabarito de A');

select throws_ok(
  $$ select public.save_question((select id from ids where name = 'single'), null, 'essay', 'Sequestrada', null, 1, '{}', '[]') $$,
  'P0002', 'Questão não encontrada.', 'B não edita questão de A');

select throws_ok(
  $$ select public.save_question(null, (select a from ws), 'essay', 'No espaço de A', null, 1, '{}', '[]') $$,
  '42501', null, 'B não cria questão no espaço de A');

-- -----------------------------------------------------------------------------
-- Anônimo
-- -----------------------------------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok($$ select count(*) from public.question_options $$, '42501', null, 'anônimo não acessa o gabarito');

select * from finish();
rollback;
