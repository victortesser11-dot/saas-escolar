-- =============================================================================
-- Melhorias pedidas após a primeira aplicação real (2026-11-25):
--
-- 1. Validação manual de prova interrompida: teacher_finalize_attempt passa a
--    registrar QUEM validou (evento 'validated', com o nome do professor) e a
--    cancelar liberações pendentes daquele aluno (a tentativa validada não pode
--    mais ser retomada). As respostas salvas são preservadas; nada é inventado.
-- 2. Identificação da prova para o aluno: exams.period (ex.: "1º trimestre") e
--    get_exam_entry devolve disciplina, período, turma e professor(a).
-- 3. Aplicar em várias turmas: não exige mudança no banco (uma linha de
--    exam_assignments por turma, inseridas de uma vez pelo app).
-- =============================================================================

-- 2. Período da prova ---------------------------------------------------------
alter table public.exams
  add column period text check (period is null or (period = btrim(period) and char_length(period) between 1 and 40));

comment on column public.exams.period is 'Período letivo da prova, mostrado ao aluno (ex.: "1º trimestre"). Opcional.';

grant update (period) on public.exams to authenticated;

-- 1. Validação manual ----------------------------------------------------------
create or replace function public.teacher_finalize_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.exam_attempts;
  v_assignment public.exam_assignments;
  v_was text;
  v_saved integer;
  v_total integer;
  v_by_name text;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id for update;
  if v_attempt.id is null or not private.is_workspace_member(v_attempt.workspace_id) then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_attempt.status not in ('in_progress', 'interrupted') then
    return jsonb_build_object('error', 'already_finalized');
  end if;
  v_was := v_attempt.status::text;

  -- Respostas efetivamente registradas pelo aluno (antes da correção criar linhas vazias).
  select count(*) into v_saved from public.student_answers sa
  where sa.attempt_id = p_attempt_id
    and (coalesce(cardinality(sa.selected_option_ids), 0) > 0 or coalesce(btrim(sa.text_answer), '') <> '');
  select count(*) into v_total from public.attempt_questions where attempt_id = p_attempt_id;
  select p.full_name into v_by_name from public.profiles p where p.id = (select auth.uid());

  perform private.finalize_attempt(p_attempt_id, 'teacher');

  -- A tentativa validada não pode mais ser retomada.
  delete from public.attempt_releases
  where assignment_id = v_attempt.assignment_id and student_id = v_attempt.student_id and consumed_at is null;

  select * into v_assignment from public.exam_assignments where id = v_attempt.assignment_id;
  perform private.log_event(v_assignment, p_attempt_id, v_attempt.student_id, 'teacher', 'validated',
    jsonb_build_object('previous_status', v_was, 'answers_saved', v_saved, 'questions', v_total,
                       'by', (select auth.uid()), 'by_name', v_by_name));

  return jsonb_build_object('ok', true, 'answers_saved', v_saved, 'questions', v_total);
end;
$$;

-- 2. Entrada do aluno com identificação completa ------------------------------
create or replace function public.get_exam_entry(p_code text)
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
  v_subject_name text;
  v_teacher_name text;
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
  select s.name into v_subject_name from public.subjects s where s.id = v_exam.subject_id;
  select p.full_name into v_teacher_name from public.profiles p where p.id = v_exam.owner_id;
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
    'subject_name', v_subject_name,
    'period', v_exam.period,
    'teacher_name', nullif(btrim(v_teacher_name), ''),
    'state', v_state,
    'opens_at', v_assignment.opens_at,
    'closes_at', least(v_assignment.closes_at, coalesce(v_assignment.closed_at, 'infinity')),
    'time_limit_minutes', v_exam.time_limit_minutes,
    'question_count', least(coalesce(v_exam.questions_per_attempt, v_count), v_count),
    'requires_access_code', v_assignment.access_code is not null
  );
end;
$$;
