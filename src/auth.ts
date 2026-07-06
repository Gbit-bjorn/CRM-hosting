import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import EntraID from "next-auth/providers/microsoft-entra-id";

const toegelaten = ["bjorn@g-bit.be", "gill@g-bit.be", "jarn@g-bit.be"];

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Admin",
    credentials: { email: {}, password: {} },
    authorize: (c) =>
      c?.email === process.env.ADMIN_EMAIL && c?.password === process.env.ADMIN_PASSWORD
        ? { id: "admin", name: "Admin", email: process.env.ADMIN_EMAIL as string }
        : null,
  }),
];

// Entra ID enkel toevoegen als het geconfigureerd is (vermijdt init-fouten zonder config).
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID) {
  providers.push(
    EntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers,
  pages: { signIn: "/login" },
  callbacks: {
    signIn: ({ user, account }) =>
      account?.provider === "credentials" ||
      (!!user.email && toegelaten.includes(user.email.toLowerCase())),
  },
});
