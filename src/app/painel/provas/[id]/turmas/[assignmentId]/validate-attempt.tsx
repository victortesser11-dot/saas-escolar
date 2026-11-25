"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { finalizeAttemptByTeacher } from "../../../../resultados/actions";

/**
 * Validação manual de uma prova interrompida (ou encerramento de uma em andamento):
 * finaliza com as respostas que o aluno salvou, sem criar nem alterar respostas,
 * calcula a nota e registra quem validou.
 */
export function ValidateAttempt({
  attemptId,
  interrupted,
  size = "sm",
}: {
  attemptId: string;
  /** true: prova interrompida ("Validar prova"); false: em andamento ("Encerrar"). */
  interrupted: boolean;
  size?: "sm" | "default";
}) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const label = interrupted ? "Validar prova" : "Encerrar";

  if (!confirming) {
    return (
      <Button type="button" size={size} variant="outline" onClick={() => setConfirming(true)}>
        {interrupted ? <CircleCheck aria-hidden /> : null}
        {label}
      </Button>
    );
  }

  return (
    <div className="grid gap-2 rounded-md border-[1.5px] border-foreground bg-card p-3 text-left text-sm">
      <p className="max-w-sm">
        {interrupted
          ? "Finalizar com as respostas que o aluno salvou e calcular a nota? Nenhuma resposta é criada ou alterada, e o aluno não poderá continuar esta tentativa."
          : "Encerrar agora e corrigir com as respostas já salvas?"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          autoFocus
          onClick={() =>
            startTransition(async () => {
              const result = await finalizeAttemptByTeacher(attemptId);
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              setConfirming(false);
            })
          }
        >
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          {interrupted ? "Sim, validar" : "Sim, encerrar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
    </div>
  );
}
