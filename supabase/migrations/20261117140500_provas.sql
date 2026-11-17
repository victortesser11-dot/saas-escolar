-- =============================================================================
-- Etapa 4 — Provas (fluxo "prova primeiro").
--
-- - exams: a prova (conteúdo e regras). Não pertence a uma turma.
-- - exam_questions: questões da prova, com o valor na prova. Referenciam o banco
--   enquanto a prova é rascunho; na publicação recebem uma CÓPIA CONGELADA
--   (content) e o gabarito (answer_key). Editar o banco depois não altera a prova.
-- - exam_assignments: aplicação da prova em uma turma, com período, link público
--   (public_code) e código de acesso opcional. Uma prova pode ir para várias turmas.
-- - Prova publicada fica travada (questões, valores e regras). Despublicar só é
--   possível antes de qualquer aplicação começar.
-- Ver docs/ARQUITETURA.md e PRD (RF-06 a RF-14, RF-29 a RF-35, RN-01 a RN-12).
-- =============================================================================

create type public.exam_status as enum ('draft', 'published');
create type public.result_visibility as enum ('score_only', 'score_and_key');

-- -----------------------------------------------------------------------------
-- exams
-- -----------------------------------------------------------------------------
create table public.exams (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references public.workspaces (id) on delete cascade,
  owner_id               uuid references auth.users (id) on delete set null,
  title                  text not null check (title = btrim(title) and char_length(title) between 1 and 120),
  description            text check (description is null or char_length(description) between 1 and 2000),
  instructions           text check (instructions is null or char_length(instructions) between 1 and 5000),
  status                 public.exam_status not null default 'draft',
  questions_per_attempt  smallint check (questions_per_attempt between 1 and 200),
  shuffle_questions      boolean not null default true,
  shuffle_options        boolean not null default true,
  time_limit_minutes     smallint check (time_limit_minutes between 1 and 600),
  result_visibility      public.result_visibility not null default 'score_only',
  published_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (workspace_id, id)
);

comment on column public.exams.questions_per_attempt is
  'Quantas questões cada aluno recebe (sorteadas). Nulo = todas as questões da prova.';

create index exams_workspace_created_idx on public.exams (workspace_id, created_at desc);

create trigger exams_set_updated_at
  before update on public.exams
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- exam_questions
-- -----------------------------------------------------------------------------
create table public.exam_questions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  exam_id       uuid not null,
  question_id   uuid not null,
  points        numeric(5, 2) not null check (points > 0 and points <= 100),
  position      integer not null,
  content       jsonb,  -- cópia congelada na publicação: {type, stem, options:[{id, body}]}
  answer_key    jsonb,  -- gabarito congelado: {correct:[ids], accepted:[textos], explanation}
  created_at    timestamptz not null default now(),
  foreign key (workspace_id, exam_id) references public.exams (workspace_id, id) on delete cascade,
  -- Uma questão usada em prova não pode ser excluída do banco.
  foreign key (workspace_id, question_id) references public.questions (workspace_id, id) on delete restrict,
  unique (exam_id, question_id)
);

create index exam_questions_exam_idx on public.exam_questions (exam_id, position);
create index exam_questions_question_idx on public.exam_questions (workspace_id, question_id);

-- -----------------------------------------------------------------------------
-- exam_assignments (aplicação da prova em uma turma)
-- -----------------------------------------------------------------------------

-- Código público do link: 8 caracteres sem ambíguos (sem 0/O, 1/I/L).
create function private.generate_public_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return code;
end;
$$;

create table public.exam_assignments (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  exam_id       uuid not null,
  class_id      uuid not null,
  public_code   text not null unique default private.generate_public_code()
                  check (public_code ~ '^[2-9A-Z]{8}$'),
  access_code   text check (access_code ~ '^[0-9]{4}$'),
  opens_at      timestamptz not null,
  closes_at     timestamptz not null,
  closed_at     timestamptz,  -- encerramento manual antecipado
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (closes_at > opens_at),
  foreign key (workspace_id, exam_id) references public.exams (workspace_id, id) on delete cascade,
  -- Turma com prova aplicada não pode ser excluída (deve ser arquivada).
  foreign key (workspace_id, class_id) references public.classes (workspace_id, id) on delete restrict,
  unique (exam_id, class_id)
);

comment on table public.exam_assignments is 'Aplicação de uma prova em uma turma: período, link público e código de acesso.';

create index exam_assignments_class_idx on public.exam_assignments (workspace_id, class_id);
create index exam_assignments_exam_idx on public.exam_assignments (exam_id);

create trigger exam_assignments_set_updated_at
  before update on public.exam_assignments
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Travas: prova publicada não muda conteúdo nem regras; aplicação só de prova publicada.
-- -----------------------------------------------------------------------------
create function private.guard_exam_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' and new.status = 'published' and (
       new.questions_per_attempt is distinct from old.questions_per_attempt
    or new.shuffle_questions is distinct from old.shuffle_questions
    or new.shuffle_options is distinct from old.shuffle_options
    or new.time_limit_minutes is distinct from old.time_limit_minutes
    or new.result_visibility is distinct from old.result_visibility
  ) then
    raise exception 'A prova está publicada: as regras não podem ser alteradas.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger exams_guard_update
  before update on public.exams
  for each row execute function private.guard_exam_update();

create function private.guard_exam_questions()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_exam uuid := coalesce(new.exam_id, old.exam_id);
  v_status public.exam_status;
begin
  select e.status into v_status from public.exams e where e.id = v_exam;
  -- A exclusão em cascata da própria prova é permitida.
  if v_status is null then
    return coalesce(new, old);
  end if;
  -- Usuários (papéis authenticated/anon) não alteram prova publicada. As funções
  -- publish_exam/unpublish_exam rodam como dono das tabelas e podem gravar a cópia congelada.
  if v_status <> 'draft' and current_user in ('authenticated', 'anon') then
    raise exception 'A prova está publicada: as questões não podem ser alteradas.' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger exam_questions_guard
  before insert or update or delete on public.exam_questions
  for each row execute function private.guard_exam_questions();

create function private.guard_exam_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.exams e where e.id = new.exam_id and e.status = 'published') then
    raise exception 'Publique a prova antes de aplicá-la em uma turma.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger exam_assignments_guard
  before insert on public.exam_assignments
  for each row execute function private.guard_exam_assignment();

-- -----------------------------------------------------------------------------
-- add_questions_to_exam: adiciona questões do banco ao fim da prova (valor padrão).
-- -----------------------------------------------------------------------------
create function public.add_questions_to_exam(p_exam_id uuid, p_question_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace uuid;
  v_next integer;
  v_added integer;
begin
  select e.workspace_id into v_workspace from public.exams e where e.id = p_exam_id;
  if v_workspace is null then
    raise exception 'Prova não encontrada.' using errcode = 'P0002';
  end if;

  select coalesce(max(eq.position), 0) into v_next from public.exam_questions eq where eq.exam_id = p_exam_id;

  insert into public.exam_questions (workspace_id, exam_id, question_id, points, position)
  select v_workspace, p_exam_id, q.id, q.default_points, v_next + row_number() over (order by ids.ord)
  from unnest(p_question_ids) with ordinality as ids(id, ord)
  join public.questions q on q.id = ids.id and q.workspace_id = v_workspace
  on conflict (exam_id, question_id) do nothing;

  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

-- -----------------------------------------------------------------------------
-- move_exam_question: sobe/desce uma questão trocando de posição com a vizinha.
-- -----------------------------------------------------------------------------
create function public.move_exam_question(p_exam_question_id uuid, p_direction integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.exam_questions;
  v_neighbor public.exam_questions;
begin
  select * into v_current from public.exam_questions where id = p_exam_question_id;
  if v_current.id is null then
    raise exception 'Questão não encontrada.' using errcode = 'P0002';
  end if;

  if p_direction < 0 then
    select * into v_neighbor from public.exam_questions
    where exam_id = v_current.exam_id and position < v_current.position
    order by position desc limit 1;
  else
    select * into v_neighbor from public.exam_questions
    where exam_id = v_current.exam_id and position > v_current.position
    order by position asc limit 1;
  end if;

  if v_neighbor.id is null then
    return;
  end if;

  update public.exam_questions set position = v_neighbor.position where id = v_current.id;
  update public.exam_questions set position = v_current.position where id = v_neighbor.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- publish_exam: valida e congela o conteúdo da prova.
-- SECURITY DEFINER porque grava content/answer_key (sem permissão direta);
-- a participação no espaço é verificada explicitamente.
-- -----------------------------------------------------------------------------
create function public.publish_exam(p_exam_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.exams;
  v_count integer;
  v_distinct_points integer;
begin
  select * into v_exam from public.exams where id = p_exam_id for update;
  if v_exam.id is null or not private.is_workspace_member(v_exam.workspace_id) then
    raise exception 'Prova não encontrada.' using errcode = 'P0002';
  end if;
  if v_exam.status <> 'draft' then
    raise exception 'A prova já está publicada.' using errcode = '55000';
  end if;

  select count(*), count(distinct points) into v_count, v_distinct_points
  from public.exam_questions where exam_id = p_exam_id;

  if v_count = 0 then
    raise exception 'Adicione ao menos uma questão antes de publicar.' using errcode = '22023';
  end if;
  if v_exam.questions_per_attempt is not null and v_exam.questions_per_attempt > v_count then
    raise exception 'A prova sorteia % questões, mas tem só %.', v_exam.questions_per_attempt, v_count
      using errcode = '22023';
  end if;
  -- Q-01: com sorteio de parte das questões, todas devem valer o mesmo.
  if v_exam.questions_per_attempt is not null and v_exam.questions_per_attempt < v_count
     and v_distinct_points > 1 then
    raise exception 'Quando cada aluno recebe só parte das questões, todas precisam ter o mesmo valor.'
      using errcode = '22023';
  end if;


  update public.exam_questions eq
  set content = jsonb_build_object(
        'type', q.type,
        'stem', q.stem,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body) order by o.position)
          from public.question_options o
          where o.question_id = q.id and q.type <> 'short_answer'
        ), '[]'::jsonb)
      ),
      answer_key = jsonb_build_object(
        'correct', coalesce((
          select jsonb_agg(o.id order by o.position)
          from public.question_options o
          where o.question_id = q.id and o.is_correct and q.type <> 'short_answer'
        ), '[]'::jsonb),
        'accepted', coalesce((
          select jsonb_agg(o.body order by o.position)
          from public.question_options o
          where o.question_id = q.id and q.type = 'short_answer'
        ), '[]'::jsonb),
        'explanation', q.explanation
      )
  from public.questions q
  where eq.exam_id = p_exam_id and q.id = eq.question_id;

  update public.exams set status = 'published', published_at = now() where id = p_exam_id;

end;
$$;

-- -----------------------------------------------------------------------------
-- unpublish_exam: volta a rascunho, só se nenhuma aplicação já começou.
-- -----------------------------------------------------------------------------
create function public.unpublish_exam(p_exam_id uuid)
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
  if exists (select 1 from public.exam_assignments a where a.exam_id = p_exam_id and a.opens_at <= now()) then
    raise exception 'A prova já foi aberta para uma turma e não pode voltar a rascunho.' using errcode = '55000';
  end if;

  update public.exam_questions set content = null, answer_key = null where exam_id = p_exam_id;
  update public.exams set status = 'draft', published_at = null where id = p_exam_id;
end;
$$;

revoke all on function public.add_questions_to_exam(uuid, uuid[]) from public, anon;
revoke all on function public.move_exam_question(uuid, integer) from public, anon;
revoke all on function public.publish_exam(uuid) from public, anon;
revoke all on function public.unpublish_exam(uuid) from public, anon;
grant execute on function public.add_questions_to_exam(uuid, uuid[]) to authenticated;
grant execute on function public.move_exam_question(uuid, integer) to authenticated;
grant execute on function public.publish_exam(uuid) to authenticated;
grant execute on function public.unpublish_exam(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Privilégios
-- -----------------------------------------------------------------------------
revoke all on public.exams, public.exam_questions, public.exam_assignments from anon, authenticated;

grant select, insert, delete on public.exams to authenticated;
grant update (title, description, instructions, questions_per_attempt, shuffle_questions,
              shuffle_options, time_limit_minutes, result_visibility)
  on public.exams to authenticated;

grant select, delete on public.exam_questions to authenticated;
grant insert (workspace_id, exam_id, question_id, points, position) on public.exam_questions to authenticated;
grant update (points, position) on public.exam_questions to authenticated;

grant select, insert, delete on public.exam_assignments to authenticated;
grant update (opens_at, closes_at, access_code, closed_at) on public.exam_assignments to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_assignments enable row level security;

create policy "exams: membros leem"
  on public.exams for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "exams: membros criam como responsáveis"
  on public.exams for insert to authenticated
  with check ((select private.is_workspace_member(workspace_id)) and owner_id = (select auth.uid()) and status = 'draft');

create policy "exams: membros editam"
  on public.exams for update to authenticated
  using ((select private.is_workspace_member(workspace_id)))
  with check ((select private.is_workspace_member(workspace_id)));

-- Prova só pode ser excluída enquanto não tiver sido aplicada em nenhuma turma.
create policy "exams: membros excluem sem aplicações"
  on public.exams for delete to authenticated
  using (
    (select private.is_workspace_member(workspace_id))
    and not exists (select 1 from public.exam_assignments a where a.exam_id = exams.id)
  );

create policy "exam_questions: membros leem"
  on public.exam_questions for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "exam_questions: membros adicionam"
  on public.exam_questions for insert to authenticated
  with check ((select private.is_workspace_member(workspace_id)));

create policy "exam_questions: membros editam"
  on public.exam_questions for update to authenticated
  using ((select private.is_workspace_member(workspace_id)))
  with check ((select private.is_workspace_member(workspace_id)));

create policy "exam_questions: membros removem"
  on public.exam_questions for delete to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "exam_assignments: membros leem"
  on public.exam_assignments for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "exam_assignments: membros criam"
  on public.exam_assignments for insert to authenticated
  with check ((select private.is_workspace_member(workspace_id)));

create policy "exam_assignments: membros editam"
  on public.exam_assignments for update to authenticated
  using ((select private.is_workspace_member(workspace_id)))
  with check ((select private.is_workspace_member(workspace_id)));

create policy "exam_assignments: membros removem antes de abrir"
  on public.exam_assignments for delete to authenticated
  using ((select private.is_workspace_member(workspace_id)) and opens_at > now());
