import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, Notice } from "@/components/ui";
import { hasOperatorSession } from "@/lib/auth/session";
import { MIN_PASSWORD_LENGTH, MIN_SESSION_SECRET_LENGTH, authConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Accesso" };

export default async function LoginPage() {
  if (await hasOperatorSession()) redirect("/");
  const configured = authConfigured();
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold">WeGrocery Console</h1>
        <p className="mb-4 text-sm text-muted">Accesso riservato all&apos;operatore.</p>
        {configured ? (
          <LoginForm />
        ) : (
          <Notice tone="warn">
            La console non è configurata: imposta <code>CONSOLE_PASSWORD</code> (almeno {MIN_PASSWORD_LENGTH} caratteri) e{" "}
            <code>CONSOLE_SESSION_SECRET</code> (almeno {MIN_SESSION_SECRET_LENGTH} caratteri), poi ridistribuisci.
          </Notice>
        )}
      </Card>
    </main>
  );
}
