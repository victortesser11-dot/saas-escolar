-- =============================================================================
-- Etapa 2 — Turmas e alunos.
--
-- - Alunos pertencem ao espaço de trabalho (não à turma) e podem estar em várias turmas.
-- - A matrícula é única por espaço de trabalho e guardada normalizada
--   (sem espaços, maiúsculas), para que "2024a 013" e "2024A013" sejam o mesmo aluno.
-- - FKs compostas com workspace_id garantem que turma e aluno do vínculo
--   sejam do MESMO espaço, independentemente da RLS.
-- Ver docs/ARQUITETURA.md, seção 8.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- classes (turmas)
-- -----------------------------------------------------------------------------
create table public.classes (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  teacher_id    uuid references auth.users (id) on delete set null,
  name          text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  school_year   smallint check (school_year between 2000 and 2100),
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, id)
);

comment on table public.classes is 'Turma de um espaço de trabalho.';

create index classes_workspace_id_idx on public.classes (workspace_id);
create index classes_teacher_id_idx on public.classes (teacher_id);

create trigger classes_set_updated_at
  before update on public.classes
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- students (alunos) — sem conta; identificados por nome + matrícula
-- -----------------------------------------------------------------------------
create table public.students (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  full_name          text not null
                       check (full_name = btrim(full_name) and char_length(full_name) between 2 and 120),
  registration_code  text not null
                       check (registration_code ~ '^[A-Z0-9./_-]{1,40}$'),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (workspace_id, registration_code),
  unique (workspace_id, id)
);

comment on table public.students is 'Aluno (sem conta). Matrícula normalizada: maiúsculas, sem espaços.';
comment on column public.students.registration_code is
  'Matrícula/identificação. Normalizar com private.normalize_registration_code antes de gravar.';

create index students_workspace_id_idx on public.students (workspace_id);

create trigger students_set_updated_at
  before update on public.students
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- class_students (vínculo turma ↔ aluno)
-- -----------------------------------------------------------------------------
create table public.class_students (
  workspace_id  uuid not null,
  class_id      uuid not null,
  student_id    uuid not null,
  created_at    timestamptz not null default now(),
  primary key (class_id, student_id),
  foreign key (workspace_id, class_id)
    references public.classes (workspace_id, id) on delete cascade,
  foreign key (workspace_id, student_id)
    references public.students (workspace_id, id) on delete cascade
);

comment on table public.class_students is 'Alunos de cada turma. Turma e aluno sempre do mesmo espaço (FK composta).';

create index class_students_student_idx on public.class_students (workspace_id, student_id);

-- -----------------------------------------------------------------------------
-- Normalização de matrícula (mesma regra usada no app e, depois, na prova do aluno)
-- -----------------------------------------------------------------------------
create function private.normalize_registration_code(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(raw, ''), '\s+', '', 'g'));
$$;

grant execute on function private.normalize_registration_code(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Importação em lote (planilha CSV): cria os alunos que ainda não existem no espaço
-- e os vincula à turma, numa única transação. Executa com as permissões de quem chama
-- (SECURITY INVOKER), portanto sob RLS.
-- Entrada: [{"full_name": "...", "registration_code": "..."}, ...] (até 500 por chamada)
-- -----------------------------------------------------------------------------
create function public.import_students(p_class_id uuid, p_students jsonb)
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
  v_existing int := 0;
  v_linked int := 0;
  v_already_in_class int := 0;
  v_rows int;
begin
  if jsonb_typeof(p_students) is distinct from 'array' then
    raise exception 'A lista de alunos é inválida.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_students) > 500 then
    raise exception 'Importe no máximo 500 alunos por vez.' using errcode = '22023';
  end if;

  -- A RLS garante que só turmas do próprio espaço sejam encontradas.
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

    insert into public.students (workspace_id, full_name, registration_code)
    values (v_workspace_id, v_name, v_code)
    on conflict (workspace_id, registration_code) do nothing
    returning id into v_student_id;

    if v_student_id is null then
      -- Aluno já existia no espaço: o nome cadastrado é mantido.
      select s.id into v_student_id
      from public.students s
      where s.workspace_id = v_workspace_id and s.registration_code = v_code;
      v_existing := v_existing + 1;
    else
      v_created := v_created + 1;
    end if;

    insert into public.class_students (workspace_id, class_id, student_id)
    values (v_workspace_id, p_class_id, v_student_id)
    on conflict do nothing;

    get diagnostics v_rows = row_count;
    if v_rows = 1 then
      v_linked := v_linked + 1;
    else
      v_already_in_class := v_already_in_class + 1;
    end if;

    v_student_id := null;
  end loop;

  return jsonb_build_object(
    'created', v_created,
    'existing', v_existing,
    'linked', v_linked,
    'already_in_class', v_already_in_class
  );
end;
$$;

revoke all on function public.import_students(uuid, jsonb) from public, anon;
grant execute on function public.import_students(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Privilégios
-- -----------------------------------------------------------------------------
revoke all on public.classes, public.students, public.class_students from anon, authenticated;

grant select, insert, delete on public.classes to authenticated;
grant update (name, school_year, archived_at) on public.classes to authenticated;

grant select, insert, delete on public.students to authenticated;
grant update (full_name, registration_code) on public.students to authenticated;

grant select, insert, delete on public.class_students to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security: membros do espaço gerenciam turmas e alunos do espaço.
-- -----------------------------------------------------------------------------
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.class_students enable row level security;

create policy "classes: membros leem"
  on public.classes for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "classes: membros criam como responsáveis"
  on public.classes for insert to authenticated
  with check (
    (select private.is_workspace_member(workspace_id))
    and teacher_id = (select auth.uid())
  );

create policy "classes: membros editam"
  on public.classes for update to authenticated
  using ((select private.is_workspace_member(workspace_id)))
  with check ((select private.is_workspace_member(workspace_id)));

create policy "classes: membros excluem"
  on public.classes for delete to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "students: membros leem"
  on public.students for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "students: membros criam"
  on public.students for insert to authenticated
  with check ((select private.is_workspace_member(workspace_id)));

create policy "students: membros editam"
  on public.students for update to authenticated
  using ((select private.is_workspace_member(workspace_id)))
  with check ((select private.is_workspace_member(workspace_id)));

create policy "students: membros excluem"
  on public.students for delete to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "class_students: membros leem"
  on public.class_students for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "class_students: membros vinculam"
  on public.class_students for insert to authenticated
  with check ((select private.is_workspace_member(workspace_id)));

create policy "class_students: membros desvinculam"
  on public.class_students for delete to authenticated
  using ((select private.is_workspace_member(workspace_id)));
