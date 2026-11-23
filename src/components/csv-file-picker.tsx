"use client";

import { Upload } from "lucide-react";
import { useId, useState, type DragEvent, type ReactNode } from "react";
import { FormMessage } from "@/components/form/form-message";
import { decodeCsvBytes } from "@/lib/students/csv";

const MAX_FILE_BYTES = 1024 * 1024;

/** Lê o arquivo escolhido como texto CSV, com mensagens para os erros comuns. */
export async function readCsvFile(file: File): Promise<{ text: string } | { error: string }> {
  if (/\.xlsx?$/i.test(file.name)) {
    return {
      error:
        'Esse arquivo é do Excel. Salve-o como CSV: no Excel, use "Arquivo › Salvar como" e escolha "CSV (separado por vírgulas)".',
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: "O arquivo é grande demais. Envie no máximo 1 MB." };
  }
  return { text: decodeCsvBytes(await file.arrayBuffer()) };
}

/** Área para escolher ou arrastar um CSV, com orientações abaixo. */
export function CsvFilePicker({
  hint,
  error,
  onFile,
  children,
}: {
  hint: ReactNode;
  error?: string;
  onFile: (file: File | undefined) => void;
  children: ReactNode;
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    onFile(event.dataTransfer.files[0]);
  }

  return (
    <div className="grid max-w-2xl gap-6">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-dragging={dragging || undefined}
        className="bg-graph grid cursor-pointer justify-items-center gap-3 rounded-md border-[1.5px] border-dashed border-foreground/50 px-6 py-12 text-center transition-colors outline-none focus-within:ring-4 focus-within:ring-ring hover:border-foreground data-dragging:border-foreground data-dragging:bg-mark/30"
      >
        <span className="flex size-12 items-center justify-center rounded-md border-2 border-foreground bg-card">
          <Upload className="size-5" aria-hidden />
        </span>
        <span className="font-semibold">Escolha o arquivo CSV ou arraste para cá</span>
        <span className="text-sm text-muted-foreground">{hint}</span>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>

      <FormMessage type="error" message={error} />

      <div className="grid gap-3 text-sm">{children}</div>
    </div>
  );
}
