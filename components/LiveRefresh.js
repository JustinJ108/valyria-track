"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 6000;
const MAX_POLLS = 15; // ~90s, longer than a full check takes

const ago = (ms) => {
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} hr ago` : `${Math.round(h / 24)} days ago`;
};

// Shows the cached results straight away. If they are stale (or the button is
// pressed), it waits for the server to rebuild the page and swaps the new
// results in without a reload.
export default function LiveRefresh({ checkedAt, staleMs }) {
  const router = useRouter();
  const [state, setState] = useState("idle"); // idle | updating | failed
  const [note, setNote] = useState("");
  const [now, setNow] = useState(null);
  const polls = useRef(0);
  const startedFrom = useRef(null);

  // Opening a stale page already asks Vercel to rebuild it in the background,
  // so all we need to do here is wait for the new version.
  useEffect(() => {
    setNow(Date.now());
    if (Date.now() - new Date(checkedAt) > staleMs) waitForNewResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While updating, re-fetch the page every few seconds until it carries
  // results newer than the ones we started with.
  useEffect(() => {
    if (state !== "updating") return;
    const t = setInterval(() => {
      if (polls.current++ >= MAX_POLLS) setState("failed");
      else router.refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [state, router]);

  useEffect(() => {
    if (state === "updating" && checkedAt !== startedFrom.current) {
      setState("idle");
      setNote("");
      setNow(Date.now());
    }
  }, [state, checkedAt]);

  function waitForNewResults() {
    startedFrom.current = checkedAt;
    polls.current = 0;
    setState("updating");
  }

  async function runNow() {
    setNote("");
    try {
      const res = await fetch("/api/check", { method: "POST" });
      if (!res.ok) {
        setNote((await res.json()).error || "Check failed");
        return;
      }
      waitForNewResults();
    } catch {
      setNote("Check failed");
    }
  }

  const age = now ? now - new Date(checkedAt) : null;
  return (
    <span className="live">
      <span className={`live-status ${state}`} role="status">
        {state === "updating" && <><span className="spinner" aria-hidden="true" />Checking links… new results appear here automatically</>}
        {state === "failed" && "Couldn't get new results — showing the last check"}
        {state === "idle" && age != null && `Results from ${ago(age)}`}
      </span>
      <button className="btn" onClick={runNow} disabled={state === "updating"}>
        {state === "updating" ? "Checking…" : "Run check now"}
      </button>
      {note && <span className="btn-note">{note}</span>}
    </span>
  );
}
