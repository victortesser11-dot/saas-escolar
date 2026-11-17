"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Copia um texto; `path` relativo vira URL completa com a origem atual. */
export function CopyButton({
  value,
  path,
  label = "Copiar link",
}: {
  value?: string;
  path?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = path ? `${window.location.origin}${path}` : (value ?? "");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link:", text);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      <span aria-live="polite">{copied ? "Copiado" : label}</span>
    </Button>
  );
}
