"use client";

import { Check, ClipboardList } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";

export type AssignmentLinkRow = {
  id: string;
  className: string;
  path: string;
  accessCode: string | null;
};

/**
 * Resumo para distribuir a prova: turma, link e código de cada aplicação, com cópia
 * individual e de tudo de uma vez (para colar no grupo da escola, por exemplo).
 */
export function AssignmentLinks({
  examTitle,
  rows,
}: {
  examTitle: string;
  rows: AssignmentLinkRow[];
}) {
  const [copiedAll, setCopiedAll] = useState(false);

  async function copyAll() {
    const origin = window.location.origin;
    const text = [
      examTitle,
      ...rows.map(
        (r) =>
          `${r.className}: ${origin}${r.path}${r.accessCode ? ` — código ${r.accessCode}` : ""}`,
      ),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      window.prompt("Copie os links:", text);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Links e códigos por turma</h3>
        <Button type="button" variant="outline" size="sm" onClick={copyAll}>
          {copiedAll ? <Check aria-hidden /> : <ClipboardList aria-hidden />}
          <span aria-live="polite">{copiedAll ? "Copiado" : "Copiar todos"}</span>
        </Button>
      </div>
      <div className="relative overflow-x-auto rounded-md border-[1.5px] border-border bg-card">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b-[1.5px] border-foreground text-left">
              <th scope="col" className="label-mono px-3 py-2 font-normal text-muted-foreground">
                Turma
              </th>
              <th scope="col" className="label-mono px-3 py-2 font-normal text-muted-foreground">
                Link
              </th>
              <th scope="col" className="label-mono px-3 py-2 font-normal text-muted-foreground">
                Código
              </th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Copiar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2 font-medium">{r.className}</td>
                <td className="px-3 py-2 font-mono text-xs break-all">{r.path}</td>
                <td className="px-3 py-2 font-mono text-base tracking-[0.15em]">
                  {r.accessCode ?? (
                    <span className="text-xs text-muted-foreground">sem código</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    <CopyButton path={r.path} label="Link" />
                    {r.accessCode ? <CopyButton value={r.accessCode} label="Código" /> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
