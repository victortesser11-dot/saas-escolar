"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Ação que exige confirmação em dois passos, sem janelas do navegador:
 * o primeiro clique mostra "Confirmar"/"Cancelar" no lugar do botão.
 */
export function ConfirmAction({
  action,
  label,
  confirmLabel,
  question,
  variant = "destructive",
  size = "sm",
  icon,
}: {
  action: () => Promise<void>;
  label: string;
  confirmLabel: string;
  question?: string;
  variant?: "destructive" | "outline" | "ghost";
  size?: "sm" | "default";
  icon?: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button type="button" variant={variant} size={size} onClick={() => setConfirming(true)}>
        {icon}
        {label}
      </Button>
    );
  }

  return (
    <span
      className="inline-flex flex-wrap items-center gap-2"
      role="group"
      aria-label={question ?? label}
    >
      {question ? <span className="text-sm text-muted-foreground">{question}</span> : null}
      <Button
        type="button"
        variant="destructive"
        size={size}
        disabled={pending}
        autoFocus
        onClick={() => startTransition(() => action())}
        className="border-pen bg-pen text-white hover:bg-pen/90"
      >
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        {confirmLabel}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={size}
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        Cancelar
      </Button>
    </span>
  );
}
