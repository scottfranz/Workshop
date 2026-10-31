"use client";

import { useState } from "react";

export function ReportForm({ initialRoaster }: { initialRoaster: string }) {
  const [roaster, setRoaster] = useState(initialRoaster);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roaster, message, email, website: trap }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't send that right now.");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("idle");
    }
  }

  if (state === "sent") {
    return <p className="notice" role="status">Thanks! Your report was sent.</p>;
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="report-roaster">Roaster&apos;s website <span className="muted">(if it&apos;s about one)</span></label>
        <input id="report-roaster" className="input" type="text" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false}
          placeholder="roaster.com" value={roaster} onChange={(e) => setRoaster(e.target.value)} maxLength={300} />
      </div>
      <div className="field">
        <label htmlFor="report-message">What&apos;s wrong?</label>
        <textarea id="report-message" className="input textarea" required minLength={5} maxLength={3000} rows={6}
          placeholder="e.g. Their Ethiopia shows as $2 but it's $22 on their site." value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="report-email">Your email <span className="muted">(optional, only if you&apos;d like a reply)</span></label>
        <input id="report-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
      </div>
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="report-website">Website</label>
        <input id="report-website" type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
      </div>
      <div aria-live="polite">{error && <p className="error">{error}</p>}</div>
      <button className="btn btn-primary" disabled={state === "sending" || message.trim().length < 5}>
        {state === "sending" ? "Sending…" : "Send report"}
      </button>
      <p className="hint" style={{ marginTop: 14 }}>Only what you type here is sent. Nothing else about you is attached.</p>
    </form>
  );
}
