-- Importação de questões por planilha: tudo ou nada, travas de prova publicada e RLS.
begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@teste.local', '{"full_name": "Prof A"}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@teste.local', '{"full_name": "Prof B"}', 'authenticated', 'authenticated');

set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

insert into public.exams (id, workspace_id, owner_id, title)
select 'eeeeeeee-0000-0000-0000-000000000001', id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Importada'
from public.workspaces;

select is(
  public.import_exam_questions('eeeeeeee-0000-0000-0000-000000000001', $$[
    {"type": "single_choice", "stem": "1+1?", "explanation": null, "points": 1, "tags": ["soma"],
     "options": [{"body": "2", "is_correct": true}, {"body": "3", "is_correct": false}]},
    {"type": "essay", "stem": "Explique.", "explanation": "Resposta esperada", "points": 2.5, "tags": [], "options": []}
  ]$$::jsonb),
  2, 'importa as questões e devolve quantas entraram');

select results_eq(
  $$ select q.stem, eq.points, eq.position from public.exam_questions eq
     join public.questions q on q.id = eq.question_id
     where eq.exam_id = 'eeeeeeee-0000-0000-0000-000000000001' order by eq.position $$,
  $$ values ('1+1?'::text, 1::numeric, 1), ('Explique.'::text, 2.5::numeric, 2) $$,
  'questões entram na ordem da planilha, com o valor informado');

select throws_ok(
  $$ select public.import_exam_questions('eeeeeeee-0000-0000-0000-000000000001', '[
    {"type": "true_false", "stem": "Ok", "points": 1, "tags": [],
     "options": [{"body": "Verdadeiro", "is_correct": true}, {"body": "Falso", "is_correct": false}]},
    {"type": "single_choice", "stem": "Sem correta", "points": 1, "tags": [],
     "options": [{"body": "a", "is_correct": false}, {"body": "b", "is_correct": false}]}
  ]'::jsonb) $$,
  '22023', null, 'uma questão inválida recusa a planilha inteira');

select is(
  (select count(*)::int from public.exam_questions where exam_id = 'eeeeeeee-0000-0000-0000-000000000001'),
  2, 'nada da planilha recusada foi gravado (tudo ou nada)');

select throws_ok(
  $$ select public.import_exam_questions('eeeeeeee-0000-0000-0000-000000000001', '[]'::jsonb) $$,
  '22023', null, 'lista vazia é recusada');

select public.publish_exam('eeeeeeee-0000-0000-0000-000000000001');
select throws_ok(
  $$ select public.import_exam_questions('eeeeeeee-0000-0000-0000-000000000001', '[
    {"type": "essay", "stem": "Nova", "points": 1, "tags": [], "options": []}]'::jsonb) $$,
  '55000', null, 'prova publicada não recebe questões importadas');

set local request.jwt.claims to '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';
select throws_ok(
  $$ select public.import_exam_questions('eeeeeeee-0000-0000-0000-000000000001', '[
    {"type": "essay", "stem": "Invasão", "points": 1, "tags": [], "options": []}]'::jsonb) $$,
  'P0002', null, 'outro professor não importa na prova de quem não é dele');

select * from finish();
rollback;
