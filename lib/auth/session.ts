import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { normalizeRole, type Role } from "@/lib/roles";

export type UserRole = Role | null;
export type AppSession = {
  user: {
    email: string;
    role?: string | null;
    active?: boolean;
    memberId?: string | null;
    fullName?: string | null;
  };
};

export async function requireUserSession(): Promise<AppSession> {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect("/login");
  }

  const u = session.user as {
    role?: string | null;
    active?: boolean;
    memberId?: string | null;
    fullName?: string | null;
  };
  return {
    user: {
      email,
      role: u?.role ?? null,
      active: Boolean(u?.active),
      memberId: u?.memberId ?? null,
      fullName: u?.fullName ?? null,
    },
  };
}

// Legacy stored values ('socio', 'attivo', 'member') come back canonical.
export function getUserRole(session: AppSession): UserRole {
  return normalizeRole(session.user.role);
}
