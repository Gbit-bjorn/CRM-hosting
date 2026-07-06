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
    <div className="mx-auto mt-24 max-w-sm space-y-6 px-4">
      <h1 className="text-xl font-semibold">G-Bit Hosting CRM — Aanmelden</h1>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
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
          <button className="w-full rounded bg-blue-600 py-2 text-white">
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
            // Auth.js gooit bij een geslaagde login een redirect (géén AuthError):
            // die laten we doorgaan. Enkel echte auth-fouten tonen we netjes.
            if (e instanceof AuthError) redirect("/login?error=1");
            throw e;
          }
        }}
        className="space-y-2"
      >
        <input
          name="email"
          placeholder="admin e-mail"
          autoComplete="username"
          className="w-full rounded border px-2 py-1"
        />
        <input
          name="password"
          type="password"
          placeholder="wachtwoord"
          autoComplete="current-password"
          className="w-full rounded border px-2 py-1"
        />
        <button className="w-full rounded border py-2">Aanmelden als admin</button>
      </form>
    </div>
  );
}
