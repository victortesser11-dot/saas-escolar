-- =============================================================================
-- Etapa 5 — Motor de aplicação da prova (lado do aluno).
--
-- O aluno não tem conta. Ele entra pelo link da turma (public_code) com nome e
-- matrícula (e código de acesso, se exigido) e recebe um TOKEN aleatório da sua
-- aplicação. Só o hash do token fica no banco. Todas as operações do aluno são
-- funções SECURITY DEFINER que validam o token; o papel anon não lê nenhuma tabela.
--
-- Regras (PRD seção 6): uma tentativa por aluno; tempo controlado pelo servidor;
-- salvamento incremental; envio idempotente; retomada só na mesma aba (token) —
-- acesso por outro aparelho interrompe a aplicação e aguarda o professor;
-- correção automática no servidor; dissertativas ficam pendentes.
-- =============================================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create type public.attempt_status as enum ('in_progress', 'interrupted', 'submitted', 'expired', 'superseded');
create type public.grading_status as enum ('pending_review', 'graded');
create type public.release_kind as enum ('resume', 'new_attempt');

-- Tolerância para respostas que chegam logo após o prazo (atraso de rede).
create function private.answer_grace() returns interval
language sql immutable set search_path = '' as $$ select interval '30 seconds' $$;

-- -----------------------------------------------------------------------------
-- exam_attempts: aplicação individual (uma "prova" de um aluno)
-- -----------------------------------------------------------------------------
create table public.exam_attempts (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  assignment_id   uuid not null references public.exam_assignments (id) on delete restrict,
  exam_id         uuid not null,
  class_id        uuid not null,
  student_id      uuid not null,
  attempt_number  smallint not null default 1 check (attempt_number between 1 and 20),
  status          public.attempt_status not null default 'in_progress',
  token_hash      bytea not null,
  started_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  submitted_at    timestamptz,
  finalized_at    timestamptz,
  finalize_reason text check (finalize_reason in ('submitted', 'expired', 'teacher')),
  max_score       numeric(7, 2),
  auto_score      numeric(7, 2),
  final_score     numeric(7, 2),
  grading_status  public.grading_status,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (workspace_id, student_id) references public.students (workspace_id, id) on delete restrict,
  unique (assignment_id, student_id, attempt_number),
  unique (workspace_id, id)
);

comment on table public.exam_attempts is 'Aplicação individual da prova para um aluno (tentativa).';

-- No máximo uma aplicação ativa por aluno e turma.
create unique index exam_attempts_one_active
  on public.exam_attempts (assignment_id, student_id)
  where status in ('in_progress', 'interrupted');
create index exam_attempts_token_idx on public.exam_attempts (token_hash);
create index exam_attempts_expiring_idx on public.exam_attempts (expires_at) where status = 'in_progress';
create index exam_attempts_student_idx on public.exam_attempts (workspace_id, student_id);

create trigger exam_attempts_set_updated_at
  before update on public.exam_attempts
  for each row execute function private.set_updated_at();

-- Uma aplicação com tentativas não pode mais ser removida pelo professor.
alter policy "exam_assignments: membros removem antes de abrir" on public.exam_assignments
  using (
    (select private.is_workspace_member(workspace_id)) and opens_at > now()
    and not exists (select 1 from public.exam_attempts t where t.assignment_id = exam_assignments.id)
  );

-- -----------------------------------------------------------------------------
-- attempt_questions: questões sorteadas, ordem e ordem das alternativas
-- -----------------------------------------------------------------------------
create table public.attempt_questions (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null,
  attempt_id        uuid not null,
  exam_question_id  uuid not null references public.exam_questions (id) on delete restrict,
  position          smallint not null,
  option_order      uuid[] not null default '{}',
  points            numeric(5, 2) not null,
  foreign key (workspace_id, attempt_id) references public.exam_attempts (workspace_id, id) on delete cascade,
  unique (attempt_id, position),
  unique (attempt_id, exam_question_id)
);

-- -----------------------------------------------------------------------------
-- student_answers: uma resposta por questão sorteada (upsert a cada alteração)
-- -----------------------------------------------------------------------------
create table public.student_answers (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null,
  attempt_id           uuid not null,
  attempt_question_id  uuid not null unique references public.attempt_questions (id) on delete cascade,
  selected_option_ids  uuid[] not null default '{}',
  text_answer          text check (text_answer is null or char_length(text_answer) <= 10000),
  is_correct           boolean,
  points_awarded       numeric(5, 2),
  needs_review         boolean not null default false,
  graded_by            uuid references auth.users (id) on delete set null,
  graded_at            timestamptz,
  saved_at             timestamptz not null default now(),
  foreign key (workspace_id, attempt_id) references public.exam_attempts (workspace_id, id) on delete cascade
);

create index student_answers_attempt_idx on public.student_answers (attempt_id);

-- -----------------------------------------------------------------------------
-- attempt_releases: liberações do professor (retomada ou nova tentativa)
-- Concedidas pelo painel (Etapa 7); consumidas em start_attempt.
-- -----------------------------------------------------------------------------
create table public.attempt_releases (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null,
  assignment_id  uuid not null references public.exam_assignments (id) on delete cascade,
  student_id     uuid not null,
  kind           public.release_kind not null,
  extra_minutes  smallint not null default 0 check (extra_minutes between 0 and 240),
  reason         text check (reason is null or char_length(reason) <= 500),
  granted_by     uuid references auth.users (id) on delete set null,
  granted_at     timestamptz not null default now(),
  consumed_at    timestamptz,
  foreign key (workspace_id, student_id) references public.students (workspace_id, id) on delete cascade
);

create index attempt_releases_pending_idx
  on public.attempt_releases (assignment_id, student_id) where consumed_at is null;

-- -----------------------------------------------------------------------------
-- exam_events: registro de ocorrências (somente inserção)
-- -----------------------------------------------------------------------------
create table public.exam_events (
  id             bigint generated always as identity primary key,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  assignment_id  uuid not null references public.exam_assignments (id) on delete cascade,
  attempt_id     uuid references public.exam_attempts (id) on delete cascade,
  student_id     uuid,
  actor          text not null check (actor in ('student', 'teacher', 'system')),
  type           text not null check (char_length(type) <= 40),
  payload        jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

create index exam_events_assignment_idx on public.exam_events (assignment_id, created_at desc);
create index exam_events_attempt_idx on public.exam_events (attempt_id, created_at);

create function private.log_event(
  p_assignment public.exam_assignments,
  p_attempt_id uuid,
  p_student_id uuid,
  p_actor text,
  p_type text,
  p_payload jsonb default '{}'
) returns void
language sql
set search_path = ''
as $$
  insert into public.exam_events (workspace_id, assignment_id, attempt_id, student_id, actor, type, payload)
  values (p_assignment.workspace_id, p_assignment.id, p_attempt_id, p_student_id, p_actor, p_type, coalesce(p_payload, '{}'));
$$;

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create function private.hash_token(p_token text) returns bytea
language sql immutable set search_path = '' as $$
  select extensions.digest(coalesce(p_token, ''), 'sha256')
$$;

-- Mesma regra de src/lib/questions/short-answer.ts.
create function private.normalize_short_answer(raw text) returns text
language sql stable set search_path = '' as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(lower(extensions.unaccent(coalesce(raw, ''))), '(\d),(\d)', '\1.\2', 'g'),
             '\s+', ' ', 'g'),
           '^[\s.,;:!?"''()]+|[\s.,;:!?"''()]+$', '', 'g')
$$;

-- Primeiro nome normalizado (comparação tolerante do nome digitado pelo aluno).
create function private.first_name_key(raw text) returns text
language sql stable set search_path = '' as $$
  select split_part(btrim(regexp_replace(lower(extensions.unaccent(coalesce(raw, ''))), '[^a-z ]', ' ', 'g')), ' ', 1)
$$;

-- -----------------------------------------------------------------------------
-- Correção e finalização (interno)
-- -----------------------------------------------------------------------------
create function private.finalize_attempt(p_attempt_id uuid, p_reason text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_correct boolean;
  v_points numeric;
  v_review boolean;
  v_max numeric := 0;
  v_auto numeric := 0;
  v_pending boolean := false;
  v_attempt public.exam_attempts;
  v_assignment public.exam_assignments;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id for update;
  if v_attempt.status not in ('in_progress', 'interrupted') then
    return;  -- já finalizada: idempotente
  end if;

  for r in
    select aq.id as aq_id, aq.points, eq.content ->> 'type' as qtype, eq.answer_key as ak,
           sa.selected_option_ids as sel, sa.text_answer as txt
    from public.attempt_questions aq
    join public.exam_questions eq on eq.id = aq.exam_question_id
    left join public.student_answers sa on sa.attempt_question_id = aq.id
    where aq.attempt_id = p_attempt_id
  loop
    v_max := v_max + r.points;
    v_review := false;

    if r.qtype = 'essay' then
      if coalesce(btrim(r.txt), '') = '' then
        v_correct := false; v_points := 0;
      else
        v_correct := null; v_points := null; v_review := true; v_pending := true;
      end if;
    elsif r.qtype = 'short_answer' then
      v_correct := private.normalize_short_answer(r.txt) <> '' and exists (
        select 1 from jsonb_array_elements_text(r.ak -> 'accepted') a
        where private.normalize_short_answer(a) = private.normalize_short_answer(r.txt)
      );
      v_points := case when v_correct then r.points else 0 end;
    else
      -- Escolha: acerto exige o conjunto marcado igual ao gabarito (tudo ou nada).
      v_correct := coalesce(cardinality(r.sel), 0) > 0 and (
        select array_agg(distinct x order by x) from unnest(r.sel) x
      ) = (
        select array_agg(distinct (x)::uuid order by (x)::uuid) from jsonb_array_elements_text(r.ak -> 'correct') x
      );
      v_points := case when v_correct then r.points else 0 end;
    end if;

    if v_points is not null then
      v_auto := v_auto + v_points;
    end if;

    insert into public.student_answers (workspace_id, attempt_id, attempt_question_id, is_correct, points_awarded, needs_review)
    values (v_attempt.workspace_id, p_attempt_id, r.aq_id, v_correct, v_points, v_review)
    on conflict (attempt_question_id) do update
      set is_correct = excluded.is_correct,
          points_awarded = excluded.points_awarded,
          needs_review = excluded.needs_review;
  end loop;

  update public.exam_attempts
  set status = case when p_reason = 'expired' then 'expired' else 'submitted' end::public.attempt_status,
      submitted_at = case when p_reason = 'submitted' then now() else submitted_at end,
      finalized_at = now(),
      finalize_reason = p_reason,
      max_score = v_max,
      auto_score = v_auto,
      final_score = case when v_pending then null else v_auto end,
      grading_status = case when v_pending then 'pending_review' else 'graded' end::public.grading_status
  where id = p_attempt_id;

  select * into v_assignment from public.exam_assignments where id = v_attempt.assignment_id;
  perform private.log_event(v_assignment, p_attempt_id, v_attempt.student_id,
    case when p_reason = 'submitted' then 'student' else 'system' end,
    case when p_reason = 'expired' then 'expired' else 'submitted' end,
    jsonb_build_object('auto_score', v_auto, 'max_score', v_max, 'pending_review', v_pending));
end;
$$;

-- Executado pelo pg_cron a cada minuto: encerra aplicações cujo prazo passou.
create function private.finalize_expired_attempts()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from public.exam_attempts
    where status = 'in_progress' and expires_at + private.answer_grace() < now()
    order by expires_at
    limit 1000
  loop
    perform private.finalize_attempt(v_id, 'expired');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Criação da aplicação individual (interno): sorteio de questões e alternativas
-- -----------------------------------------------------------------------------
create function private.create_attempt(
  p_assignment public.exam_assignments,
  p_exam public.exams,
  p_student_id uuid,
  p_attempt_number integer
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_attempt_id uuid;
  v_count integer;
  v_per integer;
  v_deadline timestamptz;
begin
  select count(*) into v_count from public.exam_questions where exam_id = p_exam.id;
  v_per := least(coalesce(p_exam.questions_per_attempt, v_count), v_count);

  v_deadline := least(
    coalesce(p_assignment.closed_at, p_assignment.closes_at),
    p_assignment.closes_at,
    case when p_exam.time_limit_minutes is null then 'infinity'::timestamptz
         else now() + make_interval(mins => p_exam.time_limit_minutes) end
  );

  insert into public.exam_attempts (workspace_id, assignment_id, exam_id, class_id, student_id,
                                    attempt_number, token_hash, expires_at)
  values (p_assignment.workspace_id, p_assignment.id, p_exam.id, p_assignment.class_id, p_student_id,
          p_attempt_number, private.hash_token(v_token), v_deadline)
  returning id into v_attempt_id;

  -- Sorteio: escolhe v_per questões ao acaso; ordena ao acaso ou pela ordem da prova.
  insert into public.attempt_questions (workspace_id, attempt_id, exam_question_id, position, option_order, points)
  select p_assignment.workspace_id, v_attempt_id, d.id,
         row_number() over (order by case when p_exam.shuffle_questions then d.rnd else d.position::double precision end),
         case
           when p_exam.shuffle_options and d.content ->> 'type' <> 'true_false' then
             coalesce((select array_agg((o ->> 'id')::uuid order by random())
                       from jsonb_array_elements(d.content -> 'options') o), '{}')
           else
             coalesce((select array_agg((o ->> 'id')::uuid order by ord)
                       from jsonb_array_elements(d.content -> 'options') with ordinality as t(o, ord)), '{}')
         end,
         d.points
  from (
    select eq.*, random() as rnd
    from public.exam_questions eq
    where eq.exam_id = p_exam.id
    order by random()
    limit v_per
  ) d;

  perform private.log_event(p_assignment, v_attempt_id, p_student_id, 'student', 'started',
    jsonb_build_object('attempt_number', p_attempt_number, 'expires_at', v_deadline));

  return jsonb_build_object('token', v_token, 'attempt_id', v_attempt_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- API pública do aluno (anon). Erros de negócio voltam como {"error": "..."},
-- sem exceção, para que o registro de ocorrências não seja desfeito.
-- -----------------------------------------------------------------------------

-- Informações públicas da prova pelo link (antes de entrar).
create function public.get_exam_entry(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_assignment public.exam_assignments;
  v_exam public.exams;
  v_class_name text;
  v_count integer;
  v_state text;
begin
  select a.* into v_assignment from public.exam_assignments a where a.public_code = upper(btrim(p_code));
  if v_assignment.id is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  select e.* into v_exam from public.exams e where e.id = v_assignment.exam_id;
  if v_exam.status <> 'published' then
    return jsonb_build_object('error', 'not_found');
  end if;
  select c.name into v_class_name from public.classes c where c.id = v_assignment.class_id;
  select count(*) into v_count from public.exam_questions where exam_id = v_exam.id;

  v_state := case
    when now() < v_assignment.opens_at then 'scheduled'
    when now() >= least(v_assignment.closes_at, coalesce(v_assignment.closed_at, 'infinity')) then 'closed'
    else 'open'
  end;

  return jsonb_build_object(
    'title', v_exam.title,
    'instructions', v_exam.instructions,
    'class_name', v_class_name,
    'state', v_state,
    'opens_at', v_assignment.opens_at,
    'closes_at', least(v_assignment.closes_at, coalesce(v_assignment.closed_at, 'infinity')),
    'time_limit_minutes', v_exam.time_limit_minutes,
    'question_count', least(coalesce(v_exam.questions_per_attempt, v_count), v_count),
    'requires_access_code', v_assignment.access_code is not null
  );
end;
$$;

-- Entrada do aluno. Cria a aplicação individual ou retoma na mesma aba (p_resume_token).
create function public.start_attempt(
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
  v_registration text := private.normalize_registration_code(p_registration);
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

  -- Limite de tentativas erradas por matrícula (protege o código de 4 dígitos).
  select count(*) into v_failures from public.exam_events
  where assignment_id = v_assignment.id and type = 'entry_failed'
    and payload ->> 'registration' = v_registration
    and created_at > now() - interval '10 minutes';
  if v_failures >= 5 then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;

  if v_assignment.access_code is not null and coalesce(btrim(p_access_code), '') <> v_assignment.access_code then
    perform private.log_event(v_assignment, null, null, 'student', 'entry_failed',
      jsonb_build_object('registration', v_registration, 'reason', 'access_code'));
    return jsonb_build_object('error', case when coalesce(btrim(p_access_code), '') = '' then 'access_code_required' else 'access_code_invalid' end);
  end if;

  select s.* into v_student
  from public.class_students cs
  join public.students s on s.id = cs.student_id
  where cs.class_id = v_assignment.class_id and s.registration_code = v_registration;

  if v_student.id is null or private.first_name_key(p_name) = ''
     or private.first_name_key(p_name) <> private.first_name_key(v_student.full_name) then
    perform private.log_event(v_assignment, null, v_student.id, 'student', 'entry_failed',
      jsonb_build_object('registration', v_registration, 'reason', 'student'));
    return jsonb_build_object('error', 'student_not_found');
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

-- Resultado de uma aplicação finalizada (respeita a configuração de exibição).
create function private.attempt_result(p_attempt public.exam_attempts)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_exam public.exams;
  v_items jsonb := null;
begin
  select * into v_exam from public.exams where id = p_attempt.exam_id;

  if v_exam.result_visibility = 'score_and_key' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'position', aq.position,
      'type', eq.content ->> 'type',
      'stem', eq.content ->> 'stem',
      'points', aq.points,
      'points_awarded', sa.points_awarded,
      'is_correct', sa.is_correct,
      'needs_review', coalesce(sa.needs_review, false),
      'your_answer', case
        when eq.content ->> 'type' in ('short_answer', 'essay') then to_jsonb(sa.text_answer)
        else coalesce((select jsonb_agg(o ->> 'body' order by array_position(aq.option_order, (o ->> 'id')::uuid))
                       from jsonb_array_elements(eq.content -> 'options') o
                       where (o ->> 'id')::uuid = any (coalesce(sa.selected_option_ids, '{}'))), '[]'::jsonb)
      end,
      'correct_answer', case
        when eq.content ->> 'type' = 'essay' then null
        when eq.content ->> 'type' = 'short_answer' then eq.answer_key -> 'accepted'
        else coalesce((select jsonb_agg(o ->> 'body' order by array_position(aq.option_order, (o ->> 'id')::uuid))
                       from jsonb_array_elements(eq.content -> 'options') o
                       where (o ->> 'id') in (select jsonb_array_elements_text(eq.answer_key -> 'correct'))), '[]'::jsonb)
      end
    ) order by aq.position), '[]'::jsonb)
    into v_items
    from public.attempt_questions aq
    join public.exam_questions eq on eq.id = aq.exam_question_id
    left join public.student_answers sa on sa.attempt_question_id = aq.id
    where aq.attempt_id = p_attempt.id;
  end if;

  return jsonb_build_object(
    'status', p_attempt.status,
    'finalize_reason', p_attempt.finalize_reason,
    'score', coalesce(p_attempt.final_score, p_attempt.auto_score),
    'max_score', p_attempt.max_score,
    'pending_review', p_attempt.grading_status = 'pending_review',
    'items', v_items
  );
end;
$$;

-- Estado da aplicação para a tela do aluno: questões (sem gabarito) e respostas salvas.
create function public.get_attempt(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.exam_attempts;
  v_exam public.exams;
  v_student_name text;
  v_class_name text;
  v_questions jsonb;
  v_answers jsonb;
begin
  select * into v_attempt from public.exam_attempts where token_hash = private.hash_token(p_token) for update;
  if v_attempt.id is null or v_attempt.status = 'superseded' then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if v_attempt.status = 'in_progress' and v_attempt.expires_at + private.answer_grace() < now() then
    perform private.finalize_attempt(v_attempt.id, 'expired');
    select * into v_attempt from public.exam_attempts where id = v_attempt.id;
  end if;

  if v_attempt.status = 'interrupted' then
    return jsonb_build_object('status', 'interrupted');
  end if;
  if v_attempt.status in ('submitted', 'expired') then
    return jsonb_build_object('status', v_attempt.status, 'result', private.attempt_result(v_attempt));
  end if;

  select * into v_exam from public.exams where id = v_attempt.exam_id;
  select full_name into v_student_name from public.students where id = v_attempt.student_id;
  select name into v_class_name from public.classes where id = v_attempt.class_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', aq.id,
    'position', aq.position,
    'type', eq.content ->> 'type',
    'stem', eq.content ->> 'stem',
    'points', aq.points,
    'options', coalesce((
      select jsonb_agg(jsonb_build_object('id', o ->> 'id', 'body', o ->> 'body')
                       order by array_position(aq.option_order, (o ->> 'id')::uuid))
      from jsonb_array_elements(eq.content -> 'options') o
    ), '[]'::jsonb)
  ) order by aq.position), '[]'::jsonb)
  into v_questions
  from public.attempt_questions aq
  join public.exam_questions eq on eq.id = aq.exam_question_id
  where aq.attempt_id = v_attempt.id;

  select coalesce(jsonb_object_agg(sa.attempt_question_id, jsonb_build_object(
    'selected', to_jsonb(sa.selected_option_ids),
    'text', sa.text_answer
  )), '{}'::jsonb)
  into v_answers
  from public.student_answers sa
  where sa.attempt_id = v_attempt.id;

  return jsonb_build_object(
    'status', 'in_progress',
    'title', v_exam.title,
    'instructions', v_exam.instructions,
    'student_name', v_student_name,
    'class_name', v_class_name,
    'expires_at', v_attempt.expires_at,
    'has_time_limit', v_exam.time_limit_minutes is not null,
    'server_now', now(),
    'questions', v_questions,
    'answers', v_answers
  );
end;
$$;

-- Salva (ou altera) a resposta de uma questão.
create function public.save_answer(
  p_token text,
  p_attempt_question_id uuid,
  p_selected uuid[],
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.exam_attempts;
  v_question record;
  v_selected uuid[] := coalesce(p_selected, '{}');
begin
  select * into v_attempt from public.exam_attempts where token_hash = private.hash_token(p_token) for update;
  if v_attempt.id is null or v_attempt.status = 'superseded' then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object('error', 'not_in_progress', 'status', v_attempt.status);
  end if;
  if v_attempt.expires_at + private.answer_grace() < now() then
    perform private.finalize_attempt(v_attempt.id, 'expired');
    return jsonb_build_object('error', 'expired');
  end if;

  select aq.id, aq.option_order, eq.content ->> 'type' as qtype into v_question
  from public.attempt_questions aq
  join public.exam_questions eq on eq.id = aq.exam_question_id
  where aq.id = p_attempt_question_id and aq.attempt_id = v_attempt.id;
  if v_question.id is null then
    return jsonb_build_object('error', 'invalid_question');
  end if;

  if v_question.qtype in ('short_answer', 'essay') then
    v_selected := '{}';
    if char_length(coalesce(p_text, '')) > (case when v_question.qtype = 'essay' then 10000 else 500 end) then
      return jsonb_build_object('error', 'too_long');
    end if;
  else
    p_text := null;
    if not (v_selected <@ v_question.option_order) then
      return jsonb_build_object('error', 'invalid_option');
    end if;
    if v_question.qtype in ('single_choice', 'true_false') and cardinality(v_selected) > 1 then
      return jsonb_build_object('error', 'invalid_option');
    end if;
  end if;

  insert into public.student_answers (workspace_id, attempt_id, attempt_question_id, selected_option_ids, text_answer, saved_at)
  values (v_attempt.workspace_id, v_attempt.id, v_question.id, v_selected, p_text, now())
  on conflict (attempt_question_id) do update
    set selected_option_ids = excluded.selected_option_ids,
        text_answer = excluded.text_answer,
        saved_at = excluded.saved_at;

  return jsonb_build_object('ok', true, 'saved_at', now());
end;
$$;

-- Envio da prova (idempotente: repetir devolve o mesmo resultado).
create function public.submit_attempt(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.exam_attempts;
begin
  select * into v_attempt from public.exam_attempts where token_hash = private.hash_token(p_token) for update;
  if v_attempt.id is null or v_attempt.status = 'superseded' then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_attempt.status = 'interrupted' then
    return jsonb_build_object('error', 'interrupted');
  end if;
  if v_attempt.status = 'in_progress' then
    perform private.finalize_attempt(
      v_attempt.id,
      case when v_attempt.expires_at + private.answer_grace() < now() then 'expired' else 'submitted' end
    );
    select * into v_attempt from public.exam_attempts where id = v_attempt.id;
  end if;
  return jsonb_build_object('status', v_attempt.status, 'result', private.attempt_result(v_attempt));
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilégios e RLS
-- -----------------------------------------------------------------------------
revoke all on public.exam_attempts, public.attempt_questions, public.student_answers,
              public.attempt_releases, public.exam_events from anon, authenticated;

-- Professor: leitura (painel de acompanhamento e correção na Etapa 7).
grant select on public.exam_attempts, public.attempt_questions, public.student_answers,
               public.attempt_releases, public.exam_events to authenticated;

alter table public.exam_attempts enable row level security;
alter table public.attempt_questions enable row level security;
alter table public.student_answers enable row level security;
alter table public.attempt_releases enable row level security;
alter table public.exam_events enable row level security;

create policy "exam_attempts: membros leem" on public.exam_attempts for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "attempt_questions: membros leem" on public.attempt_questions for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "student_answers: membros leem" on public.student_answers for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "attempt_releases: membros leem" on public.attempt_releases for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "exam_events: membros leem" on public.exam_events for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

-- Funções do aluno: anon e authenticated (o professor pode testar o próprio link).
revoke all on function public.get_exam_entry(text) from public;
revoke all on function public.start_attempt(text, text, text, text, text) from public;
revoke all on function public.get_attempt(text) from public;
revoke all on function public.save_answer(text, uuid, uuid[], text) from public;
revoke all on function public.submit_attempt(text) from public;
grant execute on function public.get_exam_entry(text) to anon, authenticated;
grant execute on function public.start_attempt(text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_attempt(text) to anon, authenticated;
grant execute on function public.save_answer(text, uuid, uuid[], text) to anon, authenticated;
grant execute on function public.submit_attempt(text) to anon, authenticated;

-- Funções internas: ninguém além do dono.
revoke all on function private.finalize_attempt(uuid, text) from public;
revoke all on function private.finalize_expired_attempts() from public;
revoke all on function private.create_attempt(public.exam_assignments, public.exams, uuid, integer) from public;
revoke all on function private.attempt_result(public.exam_attempts) from public;
revoke all on function private.log_event(public.exam_assignments, uuid, uuid, text, text, jsonb) from public;

-- Encerramento automático por tempo, a cada minuto (RN-15).
select cron.schedule(
  'finalizar-provas-expiradas',
  '* * * * *',
  $$ select private.finalize_expired_attempts() $$
);
