"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Atualiza os dados da página periodicamente (acompanhamento ao vivo da prova). */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
