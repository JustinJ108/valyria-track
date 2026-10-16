"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunCheckButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function run() {
    setBusy(true);
    setNote("Checking every link… (~15s)");
    try {
      const res = await fetch("/api/check", { method: "POST" });
      const body = await res.json();
      setNote(res.ok ? "" : body.error || "Check failed");
      router.refresh();
    } catch {
      setNote("Check failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button className="btn" onClick={run} disabled={busy}>{busy ? "Checking…" : "Run check now"}</button>
      {note && <span className="btn-note">{note}</span>}
    </span>
  );
}
