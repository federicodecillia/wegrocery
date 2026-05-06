import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const params = await searchParams;
  const showAccessDenied = params.error === "AccessDenied";
  const showConfigError = params.error === "Configuration";
  const hasGoogleAuth = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const hasDevLogin = process.env.NODE_ENV !== "production" && Boolean(process.env.AUTH_DEV_LOGIN_EMAIL);

  if (session?.user?.email) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col items-center justify-center p-6">
      <div className="w-full rounded-lg border border-pm-border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Porta Moneta - GAS</h1>
        <p className="text-pm-gray mt-2 text-sm">
          Accedi con Google per continuare.
        </p>
        {showAccessDenied ? (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            Accesso negato: la tua email non risulta tra i soci attivi.
          </p>
        ) : null}
        {showConfigError ? (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            Configurazione login incompleta. Controlla le variabili in .env.local.
          </p>
        ) : null}
        <div className="mt-6 space-y-3">
          {hasGoogleAuth ? (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="teal" block>
                Login con Google
              </Button>
            </form>
          ) : null}
          {hasDevLogin ? (
            <form
              action={async () => {
                "use server";
                await signIn("dev-login", { redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="orange" block>
                Login locale
              </Button>
            </form>
          ) : null}
          {!hasGoogleAuth && !hasDevLogin ? (
            <p className="rounded-md border border-pm-border bg-pm-warm-white p-2 text-sm text-pm-gray">
              Aggiungi le variabili auth in .env.local per abilitare il login locale.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
