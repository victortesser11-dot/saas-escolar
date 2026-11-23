import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { listSubjects } from "@/lib/subjects/queries";
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
      <Suspense fallback={<div className="h-64 max-w-2xl animate-pulse rounded-md bg-muted" />}>
        <NewExamForm />
      </Suspense>
    </div>
  );
}

async function NewExamForm() {
  const subjects = await listSubjects();
  return (
    <ExamInfoForm
      action={createExam}
      defaults={{ title: "", subject: "", description: "", instructions: "" }}
      submitLabel="Criar e adicionar questões"
      subjects={subjects.map((s) => s.name)}
    />
  );
}
