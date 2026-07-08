"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { neemOverInCrm } from "@/lib/mutations";

/** Expliciete, per-veld overname van een CoManage-waarde naar het CRM. */
export default function OverneemKnop({
  klantId,
  veld,
  waarde,
  label = "Neem over in CRM",
}: {
  klantId: string;
  veld: "vatNumber" | "adres";
  waarde: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          await neemOverInCrm(klantId, veld, waarde);
          router.refresh();
        })
      }
      className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
    >
      {pending ? "Bezig…" : label}
    </button>
  );
}
