import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const params = await searchParams;
  const showAccessDenied = params.error === "AccessDenied";

  if (session?.user?.email) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col items-center justify-center p-6">
      <div className="w-full rounded-lg border border-[var(--border)] bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Porta Moneta v3</h1>
        <p className="mt-2 text-sm text-[var(--gray)]">
          Accedi con Google per continuare.
        </p>
        {showAccessDenied ? (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            Accesso negato: la tua email non risulta tra i soci attivi.
          </p>
        ) : null}
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-[var(--teal)] px-4 py-2 font-semibold text-white"
          >
            Login con Google
          </button>
        </form>
      </div>
    </main>
  );
}
