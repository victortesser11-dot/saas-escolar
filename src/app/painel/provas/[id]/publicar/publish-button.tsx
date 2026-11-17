"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { FormMessage } from "@/components/form/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { publishExam } from "../../actions";

export function PublishButton({ examId, disabled }: { examId: string; disabled: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-4">
      <FormMessage type="error" message={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          disabled={disabled || pending}
          onClick={() =>
            startTransition(async () => {
              // Em caso de sucesso a ação redireciona; aqui só chegam erros.
              const result = await publishExam(examId);
              if (result) setError(result.message);
            })
          }
        >
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          Publicar prova
        </Button>
        <Link
          href={`/painel/provas/${examId}`}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Voltar e ajustar
        </Link>
      </div>
    </div>
  );
}
