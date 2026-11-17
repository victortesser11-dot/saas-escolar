-- Ajuste da Etapa 4: uma prova só volta a rascunho se não tiver sido aplicada em
-- nenhuma turma (nem agendada). Evita turma com link para prova não publicada.

create or replace function public.unpublish_exam(p_exam_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.exams;
begin
  select * into v_exam from public.exams where id = p_exam_id for update;
  if v_exam.id is null or not private.is_workspace_member(v_exam.workspace_id) then
    raise exception 'Prova não encontrada.' using errcode = 'P0002';
  end if;
  if v_exam.status <> 'published' then
    return;
  end if;
  if exists (select 1 from public.exam_assignments a where a.exam_id = p_exam_id) then
    raise exception 'Remova as aplicações nas turmas antes de voltar a prova para rascunho.'
      using errcode = '55000';
  end if;

  update public.exam_questions set content = null, answer_key = null where exam_id = p_exam_id;
  update public.exams set status = 'draft', published_at = null where id = p_exam_id;
end;
$$;
