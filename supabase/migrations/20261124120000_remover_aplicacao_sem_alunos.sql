-- =============================================================================
-- Retorno do piloto (2026-11-24): o professor aplicou uma prova numa turma para
-- testar e não conseguiu desfazer (a remoção só valia antes de a prova abrir).
--
-- Agora a aplicação pode ser removida a qualquer momento ENQUANTO nenhum aluno
-- tiver começado a prova. Com aluno, continua protegida (notas e histórico).
-- Os registros de entrada (exam_events) saem junto (on delete cascade).
-- =============================================================================

drop policy "exam_assignments: membros removem antes de abrir" on public.exam_assignments;

create policy "exam_assignments: membros removem sem alunos"
  on public.exam_assignments for delete to authenticated
  using (
    (select private.is_workspace_member(workspace_id))
    and not exists (select 1 from public.exam_attempts t where t.assignment_id = exam_assignments.id)
  );
