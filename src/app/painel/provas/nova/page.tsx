import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { createExam } from "../actions";
import { ExamInfoForm } from "../_components/exam-info-form";

export const metadata: Metadata = { title: "Nova prova" };

export default function NewExamPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        back={{ href: "/painel/provas", label: "Provas" }}
        title="Nova prova"
        description="Comece pelo nome. Em seguida você escreve as questões e define as regras."
      />
      <ExamInfoForm
        action={createExam}
        defaults={{ title: "", description: "", instructions: "" }}
        submitLabel="Criar e adicionar questões"
      />
    </div>
  );
}
