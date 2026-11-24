"use client";

import { Search, X } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/*
 * Filtro no navegador para listas curtas do painel (provas, turmas): busca por nome,
 * sem diferenciar acentos e maiúsculas, e opcionalmente um grupo (ex.: disciplina).
 * Não consulta o servidor: só mostra ou esconde os itens já carregados.
 */

export type FilterItem = {
  id: string;
  /** Texto pesquisado (ex.: nome da prova). */
  text: string;
  /** Grupo do item (ex.: disciplina); null = sem grupo. */
  group?: string | null;
  node: ReactNode;
};

const NO_GROUP = "__sem__";

/** "Avaliação  de FRAÇÕES" → "avaliacao de fracoes" */
export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function FilterableList({
  items,
  searchLabel,
  groupLabel,
  noGroupLabel = "Sem disciplina",
  emptyLabel,
  className,
}: {
  items: FilterItem[];
  searchLabel: string;
  /** Mostra o seletor de grupo quando definido e houver mais de um grupo. */
  groupLabel?: string;
  noGroupLabel?: string;
  emptyLabel: string;
  className?: string;
}) {
  const ids = useId();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");

  const groups = useMemo(() => {
    const names = new Set<string>();
    let hasNone = false;
    for (const item of items) {
      if (item.group) names.add(item.group);
      else hasNone = true;
    }
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { sorted, hasNone };
  }, [items]);
  const showGroups = Boolean(groupLabel) && groups.sorted.length + Number(groups.hasNone) > 1;

  const needle = normalizeSearch(query);
  const visible = items.filter((item) => {
    if (needle && !normalizeSearch(item.text).includes(needle)) return false;
    if (group === NO_GROUP) return !item.group;
    if (group) return item.group === group;
    return true;
  });
  const filtering = needle !== "" || group !== "";

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <label htmlFor={`${ids}-q`} className="sr-only">
            {searchLabel}
          </label>
          <Input
            id={`${ids}-q`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchLabel}
            autoComplete="off"
            className="pl-9"
          />
        </div>
        {showGroups ? (
          <>
            <label htmlFor={`${ids}-g`} className="sr-only">
              {groupLabel}
            </label>
            <select
              id={`${ids}-g`}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="h-10 max-w-full rounded-md border-[1.5px] border-input bg-card px-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring"
            >
              <option value="">Todas as disciplinas</option>
              {groups.sorted.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {groups.hasNone ? <option value={NO_GROUP}>{noGroupLabel}</option> : null}
            </select>
          </>
        ) : null}
        {filtering ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setGroup("");
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden />
            Limpar
          </button>
        ) : null}
      </div>

      {filtering ? (
        <p className="-mt-1 text-xs text-muted-foreground" aria-live="polite">
          {visible.length} de {items.length}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-md border-[1.5px] border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <ul className={cn(className)}>
          {visible.map((item) => (
            <li key={item.id}>{item.node}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
