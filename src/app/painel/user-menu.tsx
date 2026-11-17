import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { signOut } from "../(auth)/actions";

export async function UserMenu() {
  const user = await getCurrentUser();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right text-sm leading-tight sm:block">
        <p className="font-medium">{user.fullName || user.email}</p>
        <p className="text-xs text-muted-foreground">{user.workspace.name}</p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm">
          <LogOut aria-hidden />
          <span className="sr-only sm:not-sr-only">Sair</span>
        </Button>
      </form>
    </div>
  );
}
