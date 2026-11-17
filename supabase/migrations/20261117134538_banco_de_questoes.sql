-- =============================================================================
-- Etapa 3 — Banco de questões.
--
-- - 5 tipos: múltipla escolha (1 correta), verdadeiro/falso, seleção múltipla,
--   resposta curta (respostas aceitas) e dissertativa (correção manual).
-- - Questões e alternativas só são gravadas pela função save_question, que valida
--   as regras de cada tipo e substitui as alternativas numa única transação.
--   Assim nenhuma questão fica em estado inválido (ex.: múltipla escolha sem gabarito).
-- - status/source preparam a geração por IA (rascunho → revisão → aprovada).
-- - O gabarito (is_correct) nunca é acessível ao papel anon.
-- Ver docs/ARQUITETURA.md, seções 6.3, 8 e 11.
-- =============================================================================

create type public.question_type as enum (
  'single_choice',    -- múltipla escolha, uma correta
  'true_false',       -- verdadeiro ou falso
  'multiple_choice',  -- seleção múltipla, uma ou mais corretas
  'short_answer',     -- resposta curta, comparada com respostas aceitas
  'essay'             -- dissertativa, correção manual
);

create type public.question_status as enum ('draft', 'approved');
create type public.question_source as enum ('manual', 'import', 'ai');

-- -----------------------------------------------------------------------------
-- questions
-- -----------------------------------------------------------------------------
create table public.questions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  author_id       uuid references auth.users (id) on delete set null,
  type            public.question_type not null,
  stem            text not null check (stem = btrim(stem) and char_length(stem) between 1 and 5000),
  explanation     text check (explanation is null or char_length(explanation) between 1 and 5000),
  default_points  numeric(5, 2) not null default 1 check (default_points > 0 and default_points <= 100),
  tags            text[] not null default '{}' check (cardinality(tags) <= 10),
  status          public.question_status not null default 'approved',
  source          public.question_source not null default 'manual',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, id)
);

comment on table public.questions is 'Banco de questões do espaço. Gravação somente via save_question.';
comment on column public.questions.explanation is
  'Resolução comentada (objetivas) ou critérios de correção (dissertativa). Visível só ao professor.';
comment on column public.questions.status is 'draft: aguardando revisão (ex.: gerada por IA); approved: pode ir para provas.';

create index questions_workspace_created_idx on public.questions (workspace_id, created_at desc);
create index questions_tags_idx on public.questions using gin (tags);

create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- question_options: alternativas (ou respostas aceitas, na resposta curta)
-- -----------------------------------------------------------------------------
create table public.question_options (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  question_id   uuid not null,
  body          text not null check (body = btrim(body) and char_length(body) between 1 and 1000),
  is_correct    boolean not null default false,
  position      smallint not null check (position between 0 and 9),
  foreign key (workspace_id, question_id)
    references public.questions (workspace_id, id) on delete cascade,
  unique (question_id, position)
);

comment on table public.question_options is
  'Alternativas da questão. Na resposta curta, cada linha é uma resposta aceita (is_correct = true).';

create index question_options_ws_question_idx on public.question_options (workspace_id, question_id);

-- -----------------------------------------------------------------------------
-- Normalização de tags: minúsculas, sem espaços extras, sem repetição, sem vazias.
-- -----------------------------------------------------------------------------
create function private.normalize_tags(raw text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(t order by first_pos), '{}')
  from (
    select t, min(pos) as first_pos
    from (
      select lower(btrim(regexp_replace(tag, '\s+', ' ', 'g'))) as t, pos
      from unnest(coalesce(raw, '{}')) with ordinality as u(tag, pos)
    ) cleaned
    where t <> ''
    group by t
  ) dedup;
$$;

-- -----------------------------------------------------------------------------
-- save_question: cria ou atualiza uma questão com suas alternativas, validando o tipo.
-- SECURITY DEFINER (as tabelas não aceitam escrita direta); a autorização é verificada
-- explicitamente pela participação no espaço de trabalho.
-- p_options: [{"body": "...", "is_correct": true|false}, ...] na ordem de exibição.
-- -----------------------------------------------------------------------------
create function public.save_question(
  p_question_id  uuid,
  p_workspace_id uuid,
  p_type         public.question_type,
  p_stem         text,
  p_explanation  text,
  p_points       numeric,
  p_tags         text[],
  p_options      jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_workspace uuid;
  v_id uuid;
  v_total int;
  v_correct int;
  v_tags text[];
begin
  if v_user is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;

  if p_question_id is null then
    v_workspace := p_workspace_id;
    if v_workspace is null or not private.is_workspace_member(v_workspace) then
      raise exception 'Espaço de trabalho não encontrado.' using errcode = '42501';
    end if;
  else
    select q.workspace_id into v_workspace
    from public.questions q
    where q.id = p_question_id
    for update;

    if v_workspace is null or not private.is_workspace_member(v_workspace) then
      raise exception 'Questão não encontrada.' using errcode = 'P0002';
    end if;
  end if;

  if p_options is null or jsonb_typeof(p_options) <> 'array' then
    raise exception 'Alternativas inválidas.' using errcode = '22023';
  end if;

  v_total := jsonb_array_length(p_options);
  select count(*) filter (where coalesce((o ->> 'is_correct')::boolean, false))
    into v_correct
  from jsonb_array_elements(p_options) as o;

  -- Regras por tipo (espelhadas em src/lib/questions/schema.ts).
  case p_type
    when 'single_choice' then
      if v_total not between 2 and 10 or v_correct <> 1 then
        raise exception 'Múltipla escolha precisa de 2 a 10 alternativas e exatamente 1 correta.'
          using errcode = '22023';
      end if;
    when 'true_false' then
      if v_total <> 2 or v_correct <> 1 then
        raise exception 'Verdadeiro ou falso precisa de 2 alternativas e exatamente 1 correta.'
          using errcode = '22023';
      end if;
    when 'multiple_choice' then
      if v_total not between 2 and 10 or v_correct < 1 then
        raise exception 'Seleção múltipla precisa de 2 a 10 alternativas e ao menos 1 correta.'
          using errcode = '22023';
      end if;
    when 'short_answer' then
      if v_total not between 1 and 10 or v_correct <> v_total then
        raise exception 'Resposta curta precisa de 1 a 10 respostas aceitas.'
          using errcode = '22023';
      end if;
    when 'essay' then
      if v_total <> 0 then
        raise exception 'Questão dissertativa não tem alternativas.' using errcode = '22023';
      end if;
  end case;

  v_tags := private.normalize_tags(p_tags);

  if p_question_id is null then
    insert into public.questions (workspace_id, author_id, type, stem, explanation, default_points, tags)
    values (v_workspace, v_user, p_type, btrim(p_stem), nullif(btrim(p_explanation), ''), p_points, v_tags)
    returning id into v_id;
  else
    update public.questions
    set type = p_type,
        stem = btrim(p_stem),
        explanation = nullif(btrim(p_explanation), ''),
        default_points = p_points,
        tags = v_tags
    where id = p_question_id
    returning id into v_id;

    delete from public.question_options where question_id = v_id;
  end if;

  insert into public.question_options (workspace_id, question_id, body, is_correct, position)
  select v_workspace, v_id, btrim(o ->> 'body'), coalesce((o ->> 'is_correct')::boolean, false), (ord - 1)::smallint
  from jsonb_array_elements(p_options) with ordinality as e(o, ord);

  return v_id;
end;
$$;

revoke all on function public.save_question(uuid, uuid, public.question_type, text, text, numeric, text[], jsonb)
  from public, anon;
grant execute on function public.save_question(uuid, uuid, public.question_type, text, text, numeric, text[], jsonb)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Privilégios: leitura e exclusão diretas; criação/edição somente via save_question.
-- -----------------------------------------------------------------------------
revoke all on public.questions, public.question_options from anon, authenticated;
grant select, delete on public.questions to authenticated;
grant select on public.question_options to authenticated;

alter table public.questions enable row level security;
alter table public.question_options enable row level security;

create policy "questions: membros leem"
  on public.questions for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "questions: membros excluem"
  on public.questions for delete to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy "question_options: membros leem"
  on public.question_options for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
