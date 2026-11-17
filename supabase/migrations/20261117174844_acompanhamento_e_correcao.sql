-- =============================================================================
-- Etapa 7 — Acompanhamento, liberações e correção (lado do professor).
--
-- Funções SECURITY DEFINER com verificação explícita de participação no espaço:
-- - grant_release: libera retomada (com minutos extras) ou nova tentativa;
-- - teacher_finalize_attempt: encerra uma aplicação interrompida/em andamento;
-- - grade_answer: correção manual (dissertativa) ou revisão de qualquer questão.
-- Também: "encerrar agora" na turma passa a encerrar as aplicações em andamento.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Encerrar/antecipar o fechamento da turma limita o prazo das aplicações abertas.
-- -----------------------------------------------------------------------------
create function private.sync_attempt_deadlines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.exam_attempts
  set expires_at = least(expires_at, new.closes_at, coalesce(new.closed_at, 'infinity'))
  where assignment_id = new.id and status in ('in_progress', 'interrupted');
  return new;
end;
$$;

create trigger exam_assignments_sync_deadlines
  after update of closes_at, closed_at on public.exam_assignments
  for each row execute function private.sync_attempt_deadlines();

-- -----------------------------------------------------------------------------
-- Recalcula a nota da aplicação depois de uma correção manual.
-- -----------------------------------------------------------------------------
create function private.recompute_attempt_score(p_attempt_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.exam_attempts t
  set auto_score = s.total,
      final_score = case when s.pending > 0 then null else s.total end,
      grading_status = case when s.pending > 0 then 'pending_review' else 'graded' end::public.grading_status
  from (
    select coalesce(sum(sa.points_awarded), 0) as total,
           count(*) filter (where sa.needs_review) as pending
    from public.student_answers sa
    where sa.attempt_id = p_attempt_id
  ) s
  where t.id = p_attempt_id;
$$;

-- -----------------------------------------------------------------------------
-- grant_release
-- -----------------------------------------------------------------------------
create function public.grant_release(
  p_assignment_id uuid,
  p_student_id uuid,
  p_kind public.release_kind,
  p_extra_minutes integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.exam_assignments;
  v_attempt public.exam_attempts;
  v_release_id uuid;
begin
  select * into v_assignment from public.exam_assignments where id = p_assignment_id;
  if v_assignment.id is null or not private.is_workspace_member(v_assignment.workspace_id) then
    return jsonb_build_object('error', 'not_found');
  end if;
  if now() >= least(v_assignment.closes_at, coalesce(v_assignment.closed_at, 'infinity')) then
    return jsonb_build_object('error', 'assignment_closed');
  end if;

  select * into v_attempt from public.exam_attempts
  where assignment_id = p_assignment_id and student_id = p_student_id
  order by attempt_number desc limit 1;

  if v_attempt.id is null then
    return jsonb_build_object('error', 'no_attempt');
  end if;
  if p_kind = 'resume' and v_attempt.status <> 'interrupted' then
    return jsonb_build_object('error', 'not_interrupted');
  end if;
  if p_kind = 'new_attempt' and v_attempt.status not in ('submitted', 'expired', 'interrupted') then
    return jsonb_build_object('error', 'attempt_in_progress');
  end if;

  -- Uma liberação pendente por aluno: a nova substitui a anterior.
  delete from public.attempt_releases
  where assignment_id = p_assignment_id and student_id = p_student_id and consumed_at is null;

  insert into public.attempt_releases (workspace_id, assignment_id, student_id, kind, extra_minutes, reason, granted_by)
  values (v_assignment.workspace_id, p_assignment_id, p_student_id, p_kind,
          greatest(0, least(coalesce(p_extra_minutes, 0), 240)), nullif(btrim(p_reason), ''), (select auth.uid()))
  returning id into v_release_id;

  perform private.log_event(v_assignment, v_attempt.id, p_student_id, 'teacher', 'release_granted',
    jsonb_build_object('kind', p_kind, 'extra_minutes', coalesce(p_extra_minutes, 0)));

  return jsonb_build_object('ok', true, 'release_id', v_release_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- teacher_finalize_attempt: encerra e corrige com as respostas recebidas.
-- -----------------------------------------------------------------------------
create function public.teacher_finalize_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.exam_attempts;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id;
  if v_attempt.id is null or not private.is_workspace_member(v_attempt.workspace_id) then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_attempt.status not in ('in_progress', 'interrupted') then
    return jsonb_build_object('error', 'already_finalized');
  end if;
  perform private.finalize_attempt(p_attempt_id, 'teacher');
  return jsonb_build_object('ok', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- grade_answer: o professor define os pontos de uma resposta (0 até o valor da questão).
-- -----------------------------------------------------------------------------
create function public.grade_answer(p_answer_id uuid, p_points numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_answer public.student_answers;
  v_attempt public.exam_attempts;
  v_max numeric;
  v_previous numeric;
  v_assignment public.exam_assignments;
begin
  select * into v_answer from public.student_answers where id = p_answer_id for update;
  if v_answer.id is null or not private.is_workspace_member(v_answer.workspace_id) then
    return jsonb_build_object('error', 'not_found');
  end if;

  select * into v_attempt from public.exam_attempts where id = v_answer.attempt_id for update;
  if v_attempt.status not in ('submitted', 'expired', 'superseded') then
    return jsonb_build_object('error', 'not_finalized');
  end if;

  select aq.points into v_max from public.attempt_questions aq where aq.id = v_answer.attempt_question_id;
  if p_points is null or p_points < 0 or p_points > v_max or round(p_points, 2) <> p_points then
    return jsonb_build_object('error', 'invalid_points', 'max', v_max);
  end if;

  v_previous := v_answer.points_awarded;

  update public.student_answers
  set points_awarded = p_points,
      is_correct = case when p_points = v_max then true when p_points = 0 then false else null end,
      needs_review = false,
      graded_by = (select auth.uid()),
      graded_at = now()
  where id = p_answer_id;

  perform private.recompute_attempt_score(v_attempt.id);

  select * into v_assignment from public.exam_assignments where id = v_attempt.assignment_id;
  perform private.log_event(v_assignment, v_attempt.id, v_attempt.student_id, 'teacher', 'graded',
    jsonb_build_object('answer_id', p_answer_id, 'previous', v_previous, 'points', p_points));

  select * into v_attempt from public.exam_attempts where id = v_attempt.id;
  return jsonb_build_object('ok', true, 'final_score', v_attempt.final_score,
                            'pending_review', v_attempt.grading_status = 'pending_review');
end;
$$;

revoke all on function public.grant_release(uuid, uuid, public.release_kind, integer, text) from public, anon;
revoke all on function public.teacher_finalize_attempt(uuid) from public, anon;
revoke all on function public.grade_answer(uuid, numeric) from public, anon;
grant execute on function public.grant_release(uuid, uuid, public.release_kind, integer, text) to authenticated;
grant execute on function public.teacher_finalize_attempt(uuid) to authenticated;
grant execute on function public.grade_answer(uuid, numeric) to authenticated;
revoke all on function private.recompute_attempt_score(uuid) from public;
revoke all on function private.sync_attempt_deadlines() from public;
