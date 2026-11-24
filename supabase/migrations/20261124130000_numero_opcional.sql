-- =============================================================================
-- Retorno do piloto (2026-11-24): muitos alunos não sabem o número da chamada.
--
-- O número na turma passa a ser OPCIONAL:
-- - com número: tudo como antes (número + primeiro nome);
-- - sem número: o aluno é reconhecido pelo NOME COMPLETO (nome e sobrenome),
--   sem diferenciar acentos, maiúsculas e espaços. Dois alunos com o mesmo nome
--   na turma → pede o número. Não achou → cadastra (se a turma aceita).
-- - o professor também pode cadastrar/importar alunos só com o nome.
-- =============================================================================

alter table public.students alter column registration_code drop not null;
alter table public.students drop constraint students_registration_code_check;
alter table public.students
  add constraint students_registration_code_check
  check (registration_code is null or registration_code ~ '^[A-Z0-9./_-]{1,40}$');

comment on column public.students.registration_code is
  'Número do aluno na turma (nº da chamada ou matrícula), normalizado, OPCIONAL. Único por turma (private.roll_key) quando informado.';

/** "  Ana  SOUZA " → "ana souza" (comparação de nomes completos). */
create function private.name_key(raw text)
returns text
language sql
stable
set search_path = ''
as $$
  select btrim(regexp_replace(regexp_replace(lower(extensions.unaccent(coalesce(raw, ''))), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g'))
$$;

grant execute on function private.name_key(text) to authenticated;

-- Sem número, não há o que comparar: a unicidade vale só para números informados.
create or replace function private.check_roll_unique(p_class_id uuid, p_student_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_code is null or btrim(p_code) = '' then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_class_id::text, 42));
  if exists (
    select 1
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = p_class_id
      and cs.student_id <> p_student_id
      and s.registration_code is not null
      and private.roll_key(s.registration_code) = private.roll_key(p_code)
  ) then
    raise exception 'Já existe um aluno com o número % nesta turma.', p_code
      using errcode = '23505';
  end if;
end;
$$;

-- Importação/cadastro pelo professor: número opcional. Sem número, o aluno já está
-- na turma se houver alguém com o mesmo nome completo (sem número).
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
    v_code := nullif(private.normalize_registration_code(v_item ->> 'registration_code'), '');

    if v_code is not null then
      select s.id into v_student_id
      from public.class_students cs
      join public.students s on s.id = cs.student_id
      where cs.class_id = p_class_id and s.registration_code is not null
        and private.roll_key(s.registration_code) = private.roll_key(v_code);
    else
      select s.id into v_student_id
      from public.class_students cs
      join public.students s on s.id = cs.student_id
      where cs.class_id = p_class_id and s.registration_code is null
        and private.name_key(s.full_name) = private.name_key(v_name)
      limit 1;
    end if;

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

  return jsonb_build_object(
    'created', v_created,
    'existing', 0,
    'linked', v_created,
    'already_in_class', v_already_in_class
  );
end;
$$;

-- Entrada na prova: número opcional.
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
  v_registration text := nullif(private.normalize_registration_code(p_registration), '');
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_key text;
  v_matches integer;
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

  if (v_registration is not null and v_registration !~ '^[A-Z0-9./_-]{1,40}$')
     or private.first_name_key(v_name) = '' or char_length(v_name) not between 2 and 120 then
    return jsonb_build_object('error', 'invalid_student');
  end if;
  -- Sem número, o nome completo identifica o aluno: exige nome e sobrenome.
  if v_registration is null and position(' ' in private.name_key(v_name)) = 0 then
    return jsonb_build_object('error', 'full_name_required');
  end if;

  -- Limite de tentativas erradas por número (ou por nome, sem número).
  v_key := coalesce(private.roll_key(v_registration), 'nome:' || private.name_key(v_name));
  select count(*) into v_failures from public.exam_events
  where assignment_id = v_assignment.id and type = 'entry_failed'
    and payload ->> 'registration' = v_key
    and created_at > now() - interval '10 minutes';
  if v_failures >= 5 then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;

  if v_assignment.access_code is not null and coalesce(btrim(p_access_code), '') <> v_assignment.access_code then
    perform private.log_event(v_assignment, null, null, 'student', 'entry_failed',
      jsonb_build_object('registration', v_key, 'reason', 'access_code'));
    return jsonb_build_object('error', case when coalesce(btrim(p_access_code), '') = '' then 'access_code_required' else 'access_code_invalid' end);
  end if;

  if v_registration is not null then
    select s.* into v_student
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = v_assignment.class_id and s.registration_code is not null
      and private.roll_key(s.registration_code) = private.roll_key(v_registration);

    -- Número já está na turma: o primeiro nome precisa conferir.
    if v_student.id is not null
       and private.first_name_key(v_name) <> private.first_name_key(v_student.full_name) then
      perform private.log_event(v_assignment, null, v_student.id, 'student', 'entry_failed',
        jsonb_build_object('registration', v_key, 'reason', 'name'));
      return jsonb_build_object('error', 'name_mismatch');
    end if;

    -- Número novo, mas o mesmo nome completo já está na turma SEM número (entrou antes
    -- sem informar): é o mesmo aluno — completa o cadastro em vez de duplicar.
    if v_student.id is null then
      perform pg_advisory_xact_lock(hashtextextended(v_assignment.class_id::text, 42));
      select count(*) into v_matches
      from public.class_students cs
      join public.students s on s.id = cs.student_id
      where cs.class_id = v_assignment.class_id and s.registration_code is null
        and private.name_key(s.full_name) = private.name_key(v_name);
      if v_matches = 1 then
        select s.* into v_student
        from public.class_students cs
        join public.students s on s.id = cs.student_id
        where cs.class_id = v_assignment.class_id and s.registration_code is null
          and private.name_key(s.full_name) = private.name_key(v_name);
        update public.students set registration_code = v_registration where id = v_student.id
        returning * into v_student;
      end if;
    end if;
  else
    -- Sem número: procura pelo nome completo (serializado com cadastros simultâneos).
    perform pg_advisory_xact_lock(hashtextextended(v_assignment.class_id::text, 42));
    select count(*) into v_matches
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = v_assignment.class_id
      and private.name_key(s.full_name) = private.name_key(v_name);
    if v_matches > 1 then
      return jsonb_build_object('error', 'ambiguous_name');
    end if;
    select s.* into v_student
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = v_assignment.class_id
      and private.name_key(s.full_name) = private.name_key(v_name);
  end if;

  if v_student.id is null then
    select c.* into v_class from public.classes c where c.id = v_assignment.class_id;
    if not v_class.self_enroll or v_class.archived_at is not null then
      perform private.log_event(v_assignment, null, null, 'student', 'entry_failed',
        jsonb_build_object('registration', v_key, 'reason', 'student'));
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
