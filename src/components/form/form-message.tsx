import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormMessage({ type, message }: { type: "error" | "success"; message?: string }) {
  if (!message) return null;

  return (
    <Alert variant={type === "error" ? "destructive" : "default"} aria-live="polite">
      {type === "error" ? <CircleAlert aria-hidden /> : <CircleCheck aria-hidden />}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
