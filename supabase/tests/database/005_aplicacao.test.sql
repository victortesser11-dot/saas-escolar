-- Motor de aplicação da prova: entrada do aluno, sorteio, salvamento, envio,
-- correção, interrupção, liberação, expiração e proteção do gabarito.
begin;

create extension if not exists pgtap with schema extensions;

select plan(46);

-- -----------------------------------------------------------------------------
-- Preparação (como professor A)
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@teste.local', '{"full_name": "Prof A"}', 'authenticated', 'authenticated');

create temporary table ctx (name text primary key, id uuid, txt text) on commit drop;
grant select, insert, update on ctx to anon, authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

insert into ctx (name, id) select 'ws', id from public.workspaces;

insert into ctx (name, id) select 'q_single', public.save_question(null, (select id from ctx where name = 'ws'), 'single_choice', 'Quanto é 1+1?', null, 1, '{}',
  '[{"body": "2", "is_correct": true}, {"body": "3", "is_correct": false}, {"body": "4", "is_correct": false}]');
insert into ctx (name, id) select 'q_multi', public.save_question(null, (select id from ctx where name = 'ws'), 'multiple_choice', 'Quais são pares?', null, 1, '{}',
  '[{"body": "2", "is_correct": true}, {"body": "3", "is_correct": false}, {"body": "4", "is_correct": true}]');
insert into ctx (name, id) select 'q_short', public.save_question(null, (select id from ctx where name = 'ws'), 'short_answer', 'Capital do Brasil?', null, 1, '{}',
  '[{"body": "Brasília", "is_correct": true}]');
insert into ctx (name, id) select 'q_essay', public.save_question(null, (select id from ctx where name = 'ws'), 'essay', 'Explique a fotossíntese.', null, 1, '{}', '[]');
insert into ctx (name, id) select 'q_tf', public.save_question(null, (select id from ctx where name = 'ws'), 'true_false', 'O Sol é uma estrela.', null, 1, '{}',
  '[{"body": "Verdadeiro", "is_correct": true}, {"body": "Falso", "is_correct": false}]');

insert into public.classes (id, workspace_id, teacher_id, name)
values ('cccccccc-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7º A');
select public.import_students('cccccccc-0000-0000-0000-000000000001',
  '[{"full_name": "Ana Souza", "registration_code": "101"}, {"full_name": "Bruno Lima", "registration_code": "102"}]');

-- Prova 1: 5 questões, sem sorteio, com código de acesso.
insert into public.exams (id, workspace_id, owner_id, title, result_visibility)
values ('eeeeeeee-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Prova geral', 'score_and_key');
select public.add_questions_to_exam('eeeeeeee-0000-0000-0000-000000000001',
  array(select id from ctx where name like 'q_%' order by name));
select public.publish_exam('eeeeeeee-0000-0000-0000-000000000001');
insert into public.exam_assignments (workspace_id, exam_id, class_id, opens_at, closes_at, access_code)
values ((select id from ctx where name = 'ws'), 'eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
        now() - interval '1 hour', now() + interval '1 hour', '1234');
insert into ctx (name, txt) select 'code1', public_code from public.exam_assignments where exam_id = 'eeeeeeee-0000-0000-0000-000000000001';

-- Prova 2: sorteia 2 de 3 questões de mesmo valor, sem código; outra turma? mesma turma.
insert into public.exams (id, workspace_id, owner_id, title, questions_per_attempt)
values ('eeeeeeee-0000-0000-0000-000000000002', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Prova sorteada', 2);
select public.add_questions_to_exam('eeeeeeee-0000-0000-0000-000000000002',
  array(select id from ctx where name in ('q_single', 'q_multi', 'q_tf')));
select public.publish_exam('eeeeeeee-0000-0000-0000-000000000002');
insert into public.exam_assignments (workspace_id, exam_id, class_id, opens_at, closes_at)
values ((select id from ctx where name = 'ws'), 'eeeeeeee-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001',
        now() - interval '1 hour', now() + interval '1 hour');
insert into ctx (name, txt) select 'code2', public_code from public.exam_assignments where exam_id = 'eeeeeeee-0000-0000-0000-000000000002';

-- Lista fechada: autocadastro desligado (o autocadastro é testado em 007).
update public.classes set self_enroll = false where id = 'cccccccc-0000-0000-0000-000000000001';

-- -----------------------------------------------------------------------------
-- Aluno (anônimo)
-- -----------------------------------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(public.get_exam_entry((select txt from ctx where name = 'code1')) ->> 'state', 'open', 'entrada: prova aberta');
select is((public.get_exam_entry((select txt from ctx where name = 'code1')) ->> 'requires_access_code')::boolean, true, 'entrada: exige código');
select is(public.get_exam_entry('ZZZZZZZZ') ->> 'error', 'not_found', 'link inexistente');

select is(public.start_attempt((select txt from ctx where name = 'code1'), '101', 'Ana', '', null) ->> 'error',
  'access_code_required', 'sem código de acesso');
select is(public.start_attempt((select txt from ctx where name = 'code1'), '101', 'Ana', '9999', null) ->> 'error',
  'access_code_invalid', 'código de acesso errado');
select is(public.start_attempt((select txt from ctx where name = 'code1'), '555', 'Ana', '1234', null) ->> 'error',
  'student_not_found', 'número fora da turma (lista fechada)');
select is(public.start_attempt((select txt from ctx where name = 'code1'), '101', 'Carla', '1234', null) ->> 'error',
  'name_mismatch', 'nome não confere com o número');

insert into ctx (name, txt)
select 'ana1', public.start_attempt((select txt from ctx where name = 'code1'), ' 101 ', 'ana souza', '1234', null) ->> 'token';
select ok((select length(txt) = 64 from ctx where name = 'ana1'), 'entrada válida devolve token (nome sem acento/maiúscula aceito)');

select is(public.get_attempt((select txt from ctx where name = 'ana1')) ->> 'status', 'in_progress', 'aplicação em andamento');
select is(jsonb_array_length(public.get_attempt((select txt from ctx where name = 'ana1')) -> 'questions'), 5, 'todas as 5 questões');
select is(public.get_attempt((select txt from ctx where name = 'ana1')) ->> 'student_name', 'Ana Souza', 'nome oficial da lista');
select ok(
  public.get_attempt((select txt from ctx where name = 'ana1'))::text not like '%Brasília%'
  and public.get_attempt((select txt from ctx where name = 'ana1'))::text not like '%is_correct%'
  and public.get_attempt((select txt from ctx where name = 'ana1'))::text not like '%accepted%',
  'GABARITO NÃO É ENVIADO AO ALUNO');

select is(public.start_attempt((select txt from ctx where name = 'code1'), '101', 'Ana', '1234', (select txt from ctx where name = 'ana1')) ->> 'token',
  (select txt from ctx where name = 'ana1'), 'recarregar na mesma aba retoma a aplicação');

-- Ids das questões sorteadas, por tipo.
create temporary table aq on commit drop as
select q ->> 'type' as qtype, (q ->> 'id')::uuid as id, q -> 'options' as options
from jsonb_array_elements(public.get_attempt((select txt from ctx where name = 'ana1')) -> 'questions') q;

select is(public.save_answer((select txt from ctx where name = 'ana1'), (select id from aq where qtype = 'single_choice'),
  array(select (o ->> 'id')::uuid from aq, jsonb_array_elements(options) o where qtype = 'single_choice' and o ->> 'body' = '2'), null) ->> 'ok',
  'true', 'salva múltipla escolha');
select is(public.save_answer((select txt from ctx where name = 'ana1'), (select id from aq where qtype = 'multiple_choice'),
  array(select (o ->> 'id')::uuid from aq, jsonb_array_elements(options) o where qtype = 'multiple_choice' and o ->> 'body' in ('2', '4')), null) ->> 'ok',
  'true', 'salva seleção múltipla');
select is(public.save_answer((select txt from ctx where name = 'ana1'), (select id from aq where qtype = 'short_answer'), null, '  BRASILIA. ') ->> 'ok',
  'true', 'salva resposta curta');
select is(public.save_answer((select txt from ctx where name = 'ana1'), (select id from aq where qtype = 'essay'), null, 'Plantas usam luz.') ->> 'ok',
  'true', 'salva dissertativa');
select is(public.save_answer((select txt from ctx where name = 'ana1'), (select id from aq where qtype = 'true_false'),
  array(select (o ->> 'id')::uuid from aq, jsonb_array_elements(options) o where qtype = 'true_false' and o ->> 'body' = 'Falso'), null) ->> 'ok',
  'true', 'salva V ou F (errada)');

select is(public.save_answer((select txt from ctx where name = 'ana1'), (select id from aq where qtype = 'single_choice'),
  array(select (o ->> 'id')::uuid from aq, jsonb_array_elements(options) o where qtype = 'single_choice'), null) ->> 'error',
  'invalid_option', 'múltipla escolha não aceita duas marcadas');
select is(public.save_answer((select txt from ctx where name = 'ana1'), (select id from aq where qtype = 'single_choice'),
  array[gen_random_uuid()], null) ->> 'error', 'invalid_option', 'alternativa de outra questão é recusada');
select is(public.save_answer('token-falso', (select id from aq where qtype = 'essay'), null, 'x') ->> 'error',
  'invalid_token', 'token inválido é recusado');

select throws_ok($$ select * from public.exam_attempts $$, '42501', null, 'anônimo não lê aplicações');
select throws_ok($$ select * from public.exam_questions $$, '42501', null, 'anônimo não lê o gabarito congelado');

-- Envio e correção.
select is(public.submit_attempt((select txt from ctx where name = 'ana1')) -> 'result' ->> 'score', '3.00', 'nota parcial: 3 objetivas certas');
select is(public.submit_attempt((select txt from ctx where name = 'ana1')) -> 'result' ->> 'max_score', '5.00', 'nota máxima 5');
select is((public.submit_attempt((select txt from ctx where name = 'ana1')) -> 'result' ->> 'pending_review')::boolean, true,
  'dissertativa pendente de correção');
select is(jsonb_array_length(public.submit_attempt((select txt from ctx where name = 'ana1')) -> 'result' -> 'items'), 5,
  'gabarito exibido (prova configurada com nota e gabarito)');
select is(public.get_attempt((select txt from ctx where name = 'ana1')) ->> 'status', 'submitted', 'reenvio é idempotente');
select is(public.save_answer((select txt from ctx where name = 'ana1'), (select id from aq where qtype = 'essay'), null, 'mudei') ->> 'error',
  'not_in_progress', 'não salva depois de enviar');
select is(public.start_attempt((select txt from ctx where name = 'code1'), '101', 'Ana', '1234', null) ->> 'error',
  'already_submitted', 'tentativa única');

-- Interrupção: Bruno entra, depois tenta entrar de outro aparelho.
insert into ctx (name, txt) select 'bruno1', public.start_attempt((select txt from ctx where name = 'code1'), '102', 'Bruno', '1234', null) ->> 'token';
select is(public.start_attempt((select txt from ctx where name = 'code1'), '102', 'Bruno', '1234', null) ->> 'error',
  'interrupted', 'outro aparelho interrompe a aplicação');
select is(public.get_attempt((select txt from ctx where name = 'bruno1')) ->> 'status', 'interrupted', 'aparelho original vê a interrupção');
select is(public.start_attempt((select txt from ctx where name = 'code1'), '102', 'Bruno', '1234', (select txt from ctx where name = 'bruno1')) ->> 'error',
  'interrupted', 'nem o token antigo retoma sem o professor');

-- Professor libera retomada.
reset role;
insert into public.attempt_releases (workspace_id, assignment_id, student_id, kind, extra_minutes)
select a.workspace_id, a.id, s.id, 'resume', 5
from public.exam_assignments a, public.students s
where a.exam_id = 'eeeeeeee-0000-0000-0000-000000000001' and s.registration_code = '102' and s.workspace_id = a.workspace_id;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

insert into ctx (name, txt) select 'bruno2', public.start_attempt((select txt from ctx where name = 'code1'), '102', 'Bruno', '1234', null) ->> 'token';
select is(public.get_attempt((select txt from ctx where name = 'bruno2')) ->> 'status', 'in_progress', 'retomada liberada pelo professor');
select is(public.get_attempt((select txt from ctx where name = 'bruno1')) ->> 'error', 'invalid_token', 'token anterior deixa de valer');

-- Expiração pelo tempo (simulada) e encerramento automático.
reset role;
update public.exam_attempts set expires_at = now() - interval '5 minutes'
where token_hash = private.hash_token((select txt from ctx where name = 'bruno2'));
select is(private.finalize_expired_attempts(), 1, 'job encerra a aplicação vencida');
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is(public.get_attempt((select txt from ctx where name = 'bruno2')) ->> 'status', 'expired', 'aluno vê a prova encerrada por tempo');
select is(public.get_attempt((select txt from ctx where name = 'bruno2')) -> 'result' ->> 'score', '0.00', 'questões sem resposta valem zero');

-- Nova tentativa liberada para Ana.
reset role;
insert into public.attempt_releases (workspace_id, assignment_id, student_id, kind)
select a.workspace_id, a.id, s.id, 'new_attempt'
from public.exam_assignments a, public.students s
where a.exam_id = 'eeeeeeee-0000-0000-0000-000000000001' and s.registration_code = '101' and s.workspace_id = a.workspace_id;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
insert into ctx (name, txt) select 'ana2', public.start_attempt((select txt from ctx where name = 'code1'), '101', 'Ana', '1234', null) ->> 'token';
select is(public.get_attempt((select txt from ctx where name = 'ana2')) ->> 'status', 'in_progress', 'nova tentativa criada');
select is(public.get_attempt((select txt from ctx where name = 'ana1')) ->> 'error', 'invalid_token', 'tentativa anterior fica só no histórico');

-- Sorteio de parte das questões.
insert into ctx (name, txt) select 'ana_sorteio', public.start_attempt((select txt from ctx where name = 'code2'), '101', 'Ana', null, null) ->> 'token';
select is(jsonb_array_length(public.get_attempt((select txt from ctx where name = 'ana_sorteio')) -> 'questions'), 2, 'sorteia 2 de 3 questões');

-- Limite de tentativas erradas por matrícula.
select public.start_attempt((select txt from ctx where name = 'code1'), '999', 'Xavier', '0000', null) from generate_series(1, 5);
select is(public.start_attempt((select txt from ctx where name = 'code1'), '999', 'Xavier', '1234', null) ->> 'error',
  'too_many_attempts', 'bloqueio após 5 tentativas erradas');

-- Período.
reset role;
update public.exam_assignments set closes_at = now() - interval '1 minute', opens_at = now() - interval '2 hours'
where exam_id = 'eeeeeeee-0000-0000-0000-000000000002';
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is(public.start_attempt((select txt from ctx where name = 'code2'), '102', 'Bruno', null, null) ->> 'error', 'closed', 'prova encerrada não aceita entrada');
select is(public.get_exam_entry((select txt from ctx where name = 'code2')) ->> 'state', 'closed', 'entrada mostra prova encerrada');

-- Normalização da resposta curta (mesma regra do app).
reset role;
select is(private.normalize_short_answer('  São Paulo. '), 'sao paulo', 'normalização: acento, maiúscula, pontuação');
select is(private.normalize_short_answer('0,5'), '0.5', 'normalização: vírgula decimal');

select * from finish();
rollback;
