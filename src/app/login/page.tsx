import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const entraAan = !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID;

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-25 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-neutral-200 bg-white p-6">
        <div>
          <p className="text-lg font-semibold tracking-tight text-charcoal">
            G-Bit <span className="text-coral">CRM</span>
          </p>
          <p className="mt-1 text-sm text-neutral-500">Meld je aan om verder te gaan.</p>
        </div>

        {error && (
          <p className="rounded-md border border-bad-text/20 bg-bad-bg px-3 py-2 text-sm text-bad-text">
            Aanmelden mislukt — controleer je e-mail en wachtwoord.
          </p>
        )}

        {entraAan && (
          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", { redirectTo: "/" });
            }}
          >
            <button className="w-full rounded-md bg-charcoal py-2 text-sm font-medium text-white transition hover:bg-charcoal-light">
              Aanmelden met Microsoft 365
            </button>
          </form>
        )}

        <form
          action={async (fd: FormData) => {
            "use server";
            try {
              await signIn("credentials", {
                email: fd.get("email"),
                password: fd.get("password"),
                redirectTo: "/",
              });
            } catch (e) {
              if (e instanceof AuthError) redirect("/login?error=1");
              throw e;
            }
          }}
          className="space-y-2"
        >
          <input
            name="email"
            placeholder="E-mail"
            autoComplete="username"
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-300 focus:ring-2 focus:ring-coral/15"
          />
          <input
            name="password"
            type="password"
            placeholder="Wachtwoord"
            autoComplete="current-password"
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-300 focus:ring-2 focus:ring-coral/15"
          />
          <button className="w-full rounded-md bg-coral py-2 text-sm font-medium text-white transition hover:bg-coral-hover">
            Aanmelden
          </button>
        </form>
      </div>
    </div>
  );
}
