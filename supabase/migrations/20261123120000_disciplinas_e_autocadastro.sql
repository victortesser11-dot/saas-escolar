-- =============================================================================
-- Retorno do piloto (2026-11-23):
--
-- 1. Disciplinas dentro da turma. Um professor dá várias disciplinas na mesma turma
--    ("7º B": Matemática e Ciências), sem duplicar a turma nem a lista de alunos.
--    - subjects: disciplinas do professor (espaço de trabalho), reaproveitadas entre turmas;
--    - class_subjects: disciplinas de cada turma;
--    - exams.subject_id: a disciplina da prova. Aplicar a prova numa turma inclui a
--      disciplina na turma automaticamente.
--
-- 2. Autocadastro do aluno. A lista da turma deixa de ser obrigatória: ao entrar na
--    prova, o aluno informa nome e número na turma e, se ainda não estiver na lista,
--    é cadastrado nela (classes.self_enroll, ligado por padrão).
--    - O identificador passa a ser o NÚMERO NA TURMA (nº da chamada ou matrícula),
--      único por turma, e não mais por espaço de trabalho. Números só com dígitos
--      ignoram zeros à esquerda ("07" = "7").
--    - class_students.joined_via mostra ao professor quem entrou pela prova.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2a. Número único por turma
-- -----------------------------------------------------------------------------
alter table public.students drop constraint students_workspace_id_registration_code_key;

comment on column public.students.registration_code is
  'Número do aluno na turma (nº da chamada ou matrícula), normalizado. Único por turma (private.roll_key).';

create index students_registration_code_idx on public.students (workspace_id, registration_code);

/** Chave de comparação do número: normalizado e, se só tiver dígitos, sem zeros à esquerda. */
create function private.roll_key(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when n ~ '^[0-9]+$' then coalesce(nullif(ltrim(n, '0'), ''), '0') else n end
  from (select private.normalize_registration_code(raw) as n) x;
$$;

grant execute on function private.roll_key(text) to authenticated;

/** Garante um número por aluno em cada turma (vale para vínculos novos e edições). */
create function private.check_roll_unique(p_class_id uuid, p_student_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serializa cadastros simultâneos na mesma turma (ex.: dois alunos entrando ao mesmo tempo).
  perform pg_advisory_xact_lock(hashtextextended(p_class_id::text, 42));
  if exists (
    select 1
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = p_class_id
      and cs.student_id <> p_student_id
      and private.roll_key(s.registration_code) = private.roll_key(p_code)
  ) then
    raise exception 'Já existe um aluno com o número % nesta turma.', p_code
      using errcode = '23505';
  end if;
end;
$$;

create function private.class_students_check_roll()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_roll_unique(
    new.class_id, new.student_id,
    (select s.registration_code from public.students s where s.id = new.student_id));
  return new;
end;
$$;

create trigger class_students_check_roll
  before insert on public.class_students
  for each row execute function private.class_students_check_roll();

create function private.students_check_roll()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class uuid;
begin
  if private.roll_key(new.registration_code) is distinct from private.roll_key(old.registration_code) then
    for v_class in select cs.class_id from public.class_students cs where cs.student_id = new.id loop
      perform private.check_roll_unique(v_class, new.id, new.registration_code);
    end loop;
  end if;
  return new;
end;
$$;

create trigger students_check_roll
  before update of registration_code on public.students
  for each row execute function private.students_check_roll();

-- -----------------------------------------------------------------------------
-- 2b. Autocadastro
-- -----------------------------------------------------------------------------
alter table public.classes
  add column self_enroll boolean not null default true;

comment on column public.classes.self_enroll is
  'Se verdadeiro, o aluno que não está na lista é cadastrado na turma ao entrar na prova.';

alter table public.class_students
  add column joined_via text not null default 'teacher' check (joined_via in ('teacher', 'exam'));

comment on column public.class_students.joined_via is
  'teacher = cadastrado pelo professor (manual ou planilha); exam = o próprio aluno, ao entrar na prova.';

grant update (self_enroll) on public.classes to authenticated;

-- Importação/cadastro manual: o número é por turma. Se o número já está na turma,
-- o aluno é mantido; senão, cria-se um aluno novo nesta turma.
create or replace function public.import_students(p_class_id uuid, p_students jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_item jsonb;
  v_name text;
  v_code text;
  v_student_id uuid;
  v_created int := 0;
  v_already_in_class int := 0;
begin
  if jsonb_typeof(p_students) is distinct from 'array' then
    raise exception 'A lista de alunos é inválida.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_students) > 500 then
    raise exception 'Importe no máximo 500 alunos por vez.' using errcode = '22023';
  end if;

  select c.workspace_id into v_workspace_id
  from public.classes c
  where c.id = p_class_id and c.archived_at is null;
  if v_workspace_id is null then
    raise exception 'Turma não encontrada.' using errcode = 'P0002';
  end if;

  for v_item in select * from jsonb_array_elements(p_students)
  loop
    v_name := btrim(regexp_replace(coalesce(v_item ->> 'full_name', ''), '\s+', ' ', 'g'));
    v_code := private.normalize_registration_code(v_item ->> 'registration_code');

    select s.id into v_student_id
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = p_class_id and private.roll_key(s.registration_code) = private.roll_key(v_code);

    if v_student_id is not null then
      v_already_in_class := v_already_in_class + 1;
    else
      insert into public.students (workspace_id, full_name, registration_code)
      values (v_workspace_id, v_name, v_code)
      returning id into v_student_id;
      insert into public.class_students (workspace_id, class_id, student_id)
      values (v_workspace_id, p_class_id, v_student_id);
      v_created := v_created + 1;
    end if;
    v_student_id := null;
  end loop;

  -- Chaves antigas mantidas para compatibilidade com quem chama.
  return jsonb_build_object(
    'created', v_created,
    'existing', 0,
    'linked', v_created,
    'already_in_class', v_already_in_class
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Disciplinas
-- -----------------------------------------------------------------------------
create table public.subjects (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  created_at    timestamptz not null default now(),
  unique (workspace_id, id)
);

comment on table public.subjects is 'Disciplinas do espaço de trabalho (ex.: Matemática), usadas nas turmas e provas.';

create unique index subjects_workspace_name_key on public.subjects (workspace_id, lower(name));

create table public.class_subjects (
  workspace_id  uuid not null,
  class_id      uuid not null,
  subject_id    uuid not null,
  created_at    timestamptz not null default now(),
  primary key (class_id, subject_id),
  foreign key (workspace_id, class_id) references public.classes (workspace_id, id) on delete cascade,
  foreign key (workspace_id, subject_id) references public.subjects (workspace_id, id) on delete cascade
);

comment on table public.class_subjects is 'Disciplinas de cada turma.';

create index class_subjects_subject_idx on public.class_subjects (workspace_id, subject_id);

alter table public.exams add column subject_id uuid;
alter table public.exams
  add constraint exams_subject_fk foreign key (workspace_id, subject_id)
  references public.subjects (workspace_id, id) on delete set null (subject_id);

create index exams_subject_idx on public.exams (workspace_id, subject_id);

comment on column public.exams.subject_id is 'Disciplina da prova (opcional).';

-- Aplicar a prova (ou trocar a disciplina de uma prova aplicada) inclui a disciplina na turma.
create function private.link_exam_subject_to_class()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'exam_assignments' then
    insert into public.class_subjects (workspace_id, class_id, subject_id)
    select new.workspace_id, new.class_id, e.subject_id
    from public.exams e
    where e.id = new.exam_id and e.subject_id is not null
    on conflict do nothing;
  elsif new.subject_id is not null then
    insert into public.class_subjects (workspace_id, class_id, subject_id)
    select a.workspace_id, a.class_id, new.subject_id
    from public.exam_assignments a
    where a.exam_id = new.id
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger exam_assignments_link_subject
  after insert on public.exam_assignments
  for each row execute function private.link_exam_subject_to_class();

create trigger exams_link_subject
  after update of subject_id on public.exams
  for each row execute function private.link_exam_subject_to_class();

revoke all on public.subjects, public.class_subjects from anon, authenticated;
grant select, insert, delete on public.subjects to authenticated;
grant update (name) on public.subjects to authenticated;
grant select, insert, delete on public.class_subjects to authenticated;
grant update (subject_id) on public.exams to authenticated;

alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;

create policy "subjects: membros leem"
  on public.subjects for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "subjects: membros criam"
  on public.subjects for insert to authenticated
  with check ((select private.is_workspace_member(workspace_id)));
create policy "subjects: membros editam"
  on public.subjects for update to authenticated
  using ((select private.is_workspace_member(workspace_id)))
  with check ((select private.is_workspace_member(workspace_id)));
create policy "subjects: membros excluem"
  on public.subjects for delete to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "class_subjects: membros leem"
  on public.class_subjects for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "class_subjects: membros vinculam"
  on public.class_subjects for insert to authenticated
  with check ((select private.is_workspace_member(workspace_id)));
create policy "class_subjects: membros desvinculam"
  on public.class_subjects for delete to authenticated
  using ((select private.is_workspace_member(workspace_id)));

-- -----------------------------------------------------------------------------
-- 2c. Entrada na prova com autocadastro
-- -----------------------------------------------------------------------------
create or replace function public.start_attempt(
  p_code text,
  p_registration text,
  p_name text,
  p_access_code text,
  p_resume_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.exam_assignments;
  v_exam public.exams;
  v_class public.classes;
  v_registration text := private.normalize_registration_code(p_registration);
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_student public.students;
  v_attempt public.exam_attempts;
  v_release public.attempt_releases;
  v_new_token text;
  v_failures integer;
begin
  select a.* into v_assignment from public.exam_assignments a
  where a.public_code = upper(btrim(p_code)) for update;
  if v_assignment.id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  select e.* into v_exam from public.exams e where e.id = v_assignment.exam_id;
  if v_exam.status <> 'published' then
    return jsonb_build_object('error', 'not_found');
  end if;
  if now() < v_assignment.opens_at then
    return jsonb_build_object('error', 'not_open');
  end if;
  if now() >= least(v_assignment.closes_at, coalesce(v_assignment.closed_at, 'infinity')) then
    return jsonb_build_object('error', 'closed');
  end if;

  if v_registration !~ '^[A-Z0-9./_-]{1,40}$' or private.first_name_key(v_name) = ''
     or char_length(v_name) not between 2 and 120 then
    return jsonb_build_object('error', 'invalid_student');
  end if;

  -- Limite de tentativas erradas por número (protege o código de 4 dígitos).
  select count(*) into v_failures from public.exam_events
  where assignment_id = v_assignment.id and type = 'entry_failed'
    and payload ->> 'registration' = private.roll_key(v_registration)
    and created_at > now() - interval '10 minutes';
  if v_failures >= 5 then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;

  if v_assignment.access_code is not null and coalesce(btrim(p_access_code), '') <> v_assignment.access_code then
    perform private.log_event(v_assignment, null, null, 'student', 'entry_failed',
      jsonb_build_object('registration', private.roll_key(v_registration), 'reason', 'access_code'));
    return jsonb_build_object('error', case when coalesce(btrim(p_access_code), '') = '' then 'access_code_required' else 'access_code_invalid' end);
  end if;

  select s.* into v_student
  from public.class_students cs
  join public.students s on s.id = cs.student_id
  where cs.class_id = v_assignment.class_id
    and private.roll_key(s.registration_code) = private.roll_key(v_registration);

  if v_student.id is not null then
    -- Número já está na turma: o primeiro nome precisa conferir.
    if private.first_name_key(v_name) <> private.first_name_key(v_student.full_name) then
      perform private.log_event(v_assignment, null, v_student.id, 'student', 'entry_failed',
        jsonb_build_object('registration', private.roll_key(v_registration), 'reason', 'name'));
      return jsonb_build_object('error', 'name_mismatch');
    end if;
  else
    select c.* into v_class from public.classes c where c.id = v_assignment.class_id;
    if not v_class.self_enroll or v_class.archived_at is not null then
      perform private.log_event(v_assignment, null, null, 'student', 'entry_failed',
        jsonb_build_object('registration', private.roll_key(v_registration), 'reason', 'student'));
      return jsonb_build_object('error', 'student_not_found');
    end if;
    if (select count(*) from public.class_students cs where cs.class_id = v_class.id) >= 300 then
      return jsonb_build_object('error', 'class_full');
    end if;
    begin
      insert into public.students (workspace_id, full_name, registration_code)
      values (v_class.workspace_id, v_name, v_registration)
      returning * into v_student;
      insert into public.class_students (workspace_id, class_id, student_id, joined_via)
      values (v_class.workspace_id, v_class.id, v_student.id, 'exam');
    exception when unique_violation then
      -- Outro aluno acabou de entrar com o mesmo número.
      return jsonb_build_object('error', 'name_mismatch');
    end;
    perform private.log_event(v_assignment, null, v_student.id, 'student', 'self_enrolled',
      jsonb_build_object('registration', v_registration));
  end if;

  select t.* into v_attempt from public.exam_attempts t
  where t.assignment_id = v_assignment.id and t.student_id = v_student.id
  order by t.attempt_number desc limit 1
  for update;

  select r.* into v_release from public.attempt_releases r
  where r.assignment_id = v_assignment.id and r.student_id = v_student.id and r.consumed_at is null
  order by r.granted_at limit 1
  for update;

  if v_attempt.id is null then
    return private.create_attempt(v_assignment, v_exam, v_student.id, 1);
  end if;

  -- Prazo vencido sem envio: finaliza com o que foi recebido.
  if v_attempt.status = 'in_progress' and v_attempt.expires_at + private.answer_grace() < now() then
    perform private.finalize_attempt(v_attempt.id, 'expired');
    select * into v_attempt from public.exam_attempts where id = v_attempt.id;
  end if;

  if v_attempt.status = 'in_progress' then
    if p_resume_token is not null and v_attempt.token_hash = private.hash_token(p_resume_token) then
      return jsonb_build_object('token', p_resume_token, 'attempt_id', v_attempt.id);
    end if;
    -- Acesso por outro aparelho/navegador: interrompe e aguarda o professor (RN-18).
    update public.exam_attempts set status = 'interrupted' where id = v_attempt.id;
    perform private.log_event(v_assignment, v_attempt.id, v_student.id, 'student', 'interrupted',
      jsonb_build_object('reason', 'new_session'));
    return jsonb_build_object('error', 'interrupted');
  end if;

  if v_attempt.status = 'interrupted' then
    if v_release.id is not null and v_release.kind = 'resume' then
      v_new_token := encode(extensions.gen_random_bytes(32), 'hex');
      update public.exam_attempts
      set status = 'in_progress',
          token_hash = private.hash_token(v_new_token),
          expires_at = least(
            greatest(expires_at, now()) + make_interval(mins => v_release.extra_minutes),
            least(v_assignment.closes_at, coalesce(v_assignment.closed_at, 'infinity')))
      where id = v_attempt.id;
      update public.attempt_releases set consumed_at = now() where id = v_release.id;
      perform private.log_event(v_assignment, v_attempt.id, v_student.id, 'student', 'resumed',
        jsonb_build_object('release_id', v_release.id));
      return jsonb_build_object('token', v_new_token, 'attempt_id', v_attempt.id);
    end if;
    if v_release.id is null then
      perform private.log_event(v_assignment, v_attempt.id, v_student.id, 'student', 'blocked_access', '{}');
      return jsonb_build_object('error', 'interrupted');
    end if;
  end if;

  -- Nova tentativa liberada pelo professor (a anterior fica no histórico).
  if v_release.id is not null and v_release.kind = 'new_attempt' then
    if v_attempt.status in ('in_progress', 'interrupted') then
      perform private.finalize_attempt(v_attempt.id, 'teacher');
    end if;
    update public.exam_attempts set status = 'superseded' where id = v_attempt.id;
    update public.attempt_releases set consumed_at = now() where id = v_release.id;
    return private.create_attempt(v_assignment, v_exam, v_student.id, v_attempt.attempt_number + 1);
  end if;

  perform private.log_event(v_assignment, v_attempt.id, v_student.id, 'student', 'blocked_access', '{}');
  return jsonb_build_object('error', 'already_submitted');
end;
$$;
