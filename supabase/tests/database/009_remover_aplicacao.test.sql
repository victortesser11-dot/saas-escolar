-- Remover aplicação: permitido enquanto nenhum aluno começou (mesmo aberta ou encerrada).
begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@teste.local', '{"full_name": "Prof A"}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@teste.local', '{"full_name": "Prof B"}', 'authenticated', 'authenticated');

create temporary table ctx (name text primary key, id uuid, txt text) on commit drop;
grant select, insert on ctx to anon, authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';
insert into ctx (name, id) select 'ws', id from public.workspaces;

insert into public.classes (id, workspace_id, teacher_id, name)
values ('cccccccc-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11M');
insert into public.exams (id, workspace_id, owner_id, title)
values ('eeeeeeee-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Teste');
select public.import_exam_questions('eeeeeeee-0000-0000-0000-000000000001',
  '[{"type": "essay", "stem": "Explique.", "points": 1, "tags": [], "options": []}]');
select public.publish_exam('eeeeeeee-0000-0000-0000-000000000001');

-- Aplicação aberta e já encerrada manualmente, sem nenhum aluno (o caso do piloto).
insert into public.exam_assignments (id, workspace_id, exam_id, class_id, opens_at, closes_at, closed_at, access_code)
values ('aaaa0000-0000-0000-0000-000000000001', (select id from ctx where name = 'ws'), 'eeeeeeee-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001', now() - interval '1 hour', now() + interval '1 hour', now(), '1234');

-- Outro professor não remove.
set local request.jwt.claims to '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';
delete from public.exam_assignments where id = 'aaaa0000-0000-0000-0000-000000000001';
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';
select is((select count(*)::int from public.exam_assignments), 1, 'outro professor não remove a aplicação');

delete from public.exam_assignments where id = 'aaaa0000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.exam_assignments), 0, 'aplicação encerrada sem alunos pode ser removida');

-- Com aluno que começou a prova, fica protegida.
insert into public.exam_assignments (id, workspace_id, exam_id, class_id, opens_at, closes_at)
values ('aaaa0000-0000-0000-0000-000000000002', (select id from ctx where name = 'ws'), 'eeeeeeee-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001', now() - interval '1 hour', now() + interval '1 hour');
insert into ctx (name, txt) select 'code', public_code from public.exam_assignments where id = 'aaaa0000-0000-0000-0000-000000000002';

reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select isnt(public.start_attempt((select txt from ctx where name = 'code'), '1', 'Ana Souza', null, null) ->> 'token',
  null, 'aluno entra (autocadastro) e começa');

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';
delete from public.exam_assignments where id = 'aaaa0000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.exam_assignments), 1, 'aplicação com aluno não pode ser removida');

select * from finish();
rollback;
