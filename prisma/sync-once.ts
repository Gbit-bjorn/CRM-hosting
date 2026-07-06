// Eenmalige Nomeo-sync vanaf de command line (voor herbouw/onderhoud).
import { config } from "dotenv";
config({ path: ".env.local" });

(async () => {
  const { syncNomeo } = await import("../src/lib/sync");
  const r = await syncNomeo();
  console.log("Sync klaar:", r);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
