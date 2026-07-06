import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js gebruikt .env.local; laad die expliciet voor de Prisma CLI.
loadEnv({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
