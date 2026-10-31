"use client";

import { useState } from "react";
import { reportLink } from "@/lib/site";
import { cleanPastedUrl } from "@/lib/url";

export function AddRoasterForm({ onAdd, autoFocus, compact }: {
  onAdd: (url: string, name?: string) => Promise<void>;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    // Show the address without the tracking codes it was copied with.
    const clean = cleanPastedUrl(url);
    setUrl(clean);
    setBusy(true);
    setError(null);
    try {
      await onAdd(clean, name.trim() || undefined);
      setUrl("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <form onSubmit={submit}>
        <div className="add-form">
          <label htmlFor="quick-url" className="sr-only">Roaster website</label>
          <input id="quick-url" className="search" type="text" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false}
            placeholder="Paste a roaster's website or shop page" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus={autoFocus} />
          <button className="btn btn-primary" disabled={busy || !url.trim()}>{busy ? "Looking…" : "Follow"}</button>
        </div>
        <div aria-live="polite">{error && <p className="error" style={{ marginTop: 10 }}>{error} <a href={reportLink(url)}>Report this roaster</a></p>}</div>
      </form>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="roaster-url">Website or shop page</label>
        <input id="roaster-url" className="input" type="text" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false}
          placeholder="roaster.com or roaster.com/collections/coffee" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus={autoFocus} />
        <span className="hint">
          Works with Shopify, WooCommerce, Squarespace, Square Online and Big Cartel shops, plus most others that list products for search engines.
          If the homepage doesn&apos;t work, paste the link to their coffee page. A collection link (like /collections/single-origin) narrows the feed.
        </span>
      </div>
      <div className="field">
        <label htmlFor="roaster-name">Name <span className="muted">(optional)</span></label>
        <input id="roaster-name" className="input" type="text" placeholder="We'll use the store's name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div aria-live="polite">{error && <p className="error">{error} <a href={reportLink(url)}>Report this roaster</a></p>}</div>
      <button className="btn btn-primary" disabled={busy || !url.trim()}>{busy ? "Looking for coffees…" : "Follow roaster"}</button>
    </form>
  );
}
