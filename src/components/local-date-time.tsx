"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Data/hora no fuso do navegador do professor (o Brasil tem vários fusos).
 * No servidor, formata no horário de Brasília; no navegador, ajusta ao fuso local.
 */
export function LocalDateTime({
  iso,
  style = "datetime",
}: {
  iso: string;
  style?: "datetime" | "date" | "time";
}) {
  const options: Intl.DateTimeFormatOptions =
    style === "date"
      ? { day: "2-digit", month: "2-digit", year: "numeric" }
      : style === "time"
        ? { hour: "2-digit", minute: "2-digit" }
        : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" };

  const text = useSyncExternalStore(
    subscribe,
    () => new Intl.DateTimeFormat("pt-BR", options).format(new Date(iso)),
    () =>
      new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "America/Sao_Paulo" }).format(
        new Date(iso),
      ),
  );

  return (
    <time dateTime={iso} className="tabular-nums">
      {text}
    </time>
  );
}
