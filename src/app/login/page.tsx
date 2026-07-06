import { signIn } from "@/auth";

export default function Login() {
  const entraAan = !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID;

  return (
    <div className="mx-auto mt-24 max-w-sm space-y-6 px-4">
      <h1 className="text-xl font-semibold">G-Bit Hosting CRM — Aanmelden</h1>

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
          await signIn("credentials", {
            email: fd.get("email"),
            password: fd.get("password"),
            redirectTo: "/",
          });
        }}
        className="space-y-2"
      >
        <input
          name="email"
          placeholder="admin e-mail"
          className="w-full rounded border px-2 py-1"
        />
        <input
          name="password"
          type="password"
          placeholder="wachtwoord"
          className="w-full rounded border px-2 py-1"
        />
        <button className="w-full rounded border py-2">Aanmelden als admin</button>
      </form>
    </div>
  );
}
