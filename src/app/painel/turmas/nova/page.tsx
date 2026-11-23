import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { createClass } from "../../actions";
import { ClassForm } from "../../_components/class-form";

export const metadata: Metadata = { title: "Nova turma" };

export default function NewClassPage() {
  return (
    <div className="grid gap-8">
      <PageHeader back={{ href: "/painel", label: "Turmas" }} title="Nova turma" />
      <ClassForm
        action={createClass}
        defaults={{ name: "", schoolYear: "" }}
        submitLabel="Criar turma"
        withSubjects
      />
    </div>
  );
}
