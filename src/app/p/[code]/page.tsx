import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getExamEntry } from "@/lib/student/api";
import { StudentExam } from "./student-exam";

/*
 * Página pública da prova (link da turma). O aluno não tem conta: tudo acontece
 * pelas funções da prova no banco, chamadas direto do celular.
 */

export const metadata: Metadata = {
  title: "Prova",
  robots: { index: false, follow: false },
};

export default function StudentExamPage({ params }: PageProps<"/p/[code]">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <Suspense fallback={<div className="m-4 h-64 animate-pulse rounded-md bg-muted" />}>
        <Entry params={params} />
      </Suspense>
    </div>
  );
}

async function Entry({ params }: Pick<PageProps<"/p/[code]">, "params">) {
  await connection();
  const { code } = await params;
  const normalized = code.toUpperCase();
  const entry = /^[2-9A-Z]{8}$/.test(normalized)
    ? await getExamEntry(normalized)
    : { error: "not_found" };

  return (
    <>
      {"title" in entry ? <title>{`${entry.title} · ${entry.class_name}`}</title> : null}
      <StudentExam code={normalized} entry={entry} />
    </>
  );
}
