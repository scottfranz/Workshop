"use client";

import { useState } from "react";
import { timeAgo } from "@/lib/feed";
import { PLATFORM_LABELS } from "@/lib/scrapers/types";
import { CURRENCIES } from "@/lib/money";
import { encodeShare, type CachedFeed, type SavedRoaster } from "@/lib/storage";
import type { RoasterStatus } from "./Feed";

export function ManageRoasters({
  roasters, status, cache, cupGrams, currency, ratesDate, onCupGrams, onCurrency, onRename, onRecolor, onRemove, onRemoveAll, onRefresh,
}: {
  cupGrams: number;
  currency: string | null;
  ratesDate: string | null;
  onCupGrams: (grams: number) => void;
  onCurrency: (currency: string | null) => void;
  roasters: SavedRoaster[];
  status: Record<string, RoasterStatus>;
  cache: Record<string, CachedFeed | undefined>;
  onRename: (id: string, name: string) => void;
  onRecolor: (id: string, color: string) => void;
  onRemove: (id: string) => void;
  onRemoveAll: () => void;
  onRefresh: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window === "undefined" || roasters.length === 0
    ? ""
    : `${window.location.origin}/#${encodeShare(roasters)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  }

  if (roasters.length === 0) return <p className="muted">You&apos;re not following any roasters yet.</p>;

  return (
    <>
      <ul className="roaster-list">
        {roasters.map((r) => {
          const s = status[r.id];
          const at = cache[r.id]?.fetchedAt;
          const skipped = cache[r.id]?.skipped ?? [];
          return (
            <li key={r.id} className="roaster-row">
              <div className="name-cell">
                <label className="color-swatch" title="Change color" style={{ background: r.color }}>
                  <span className="sr-only">Color for {r.name}</span>
                  <input type="color" value={r.color ?? "#c0622a"} onChange={(e) => onRecolor(r.id, e.target.value)} />
                </label>
                <label className="sr-only" htmlFor={`name-${r.id}`}>Name for {r.feedUrl}</label>
                <input id={`name-${r.id}`} className="input" defaultValue={r.name} maxLength={80}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== r.name) onRename(r.id, v); }} />
              </div>
              <div className="row-actions">
                <button type="button" className="btn btn-ghost icon-btn" onClick={() => onRefresh(r.id)} aria-label={`Refresh ${r.name}`} disabled={s?.state === "loading"}>↻</button>
                <button type="button" className="btn btn-ghost btn-danger" onClick={() => onRemove(r.id)}>Remove</button>
              </div>
              <div className="roaster-meta">
                {PLATFORM_LABELS[r.platform]} · <a href={r.feedUrl} target="_blank" rel="noopener noreferrer">{r.feedUrl.replace(/^https?:\/\//, "")}</a>
                {at && <> · updated {timeAgo(at)}</>}
                {s?.state === "loading" && <> · checking…</>}
                {s?.state === "error" && <p className="error">{s.message}</p>}
                {skipped.length > 0 && (
                  <details className="skipped">
                    <summary>{skipped.length} non-coffee item{skipped.length === 1 ? "" : "s"} left out</summary>
                    <ul>{skipped.map((t) => <li key={t}>{t}</li>)}</ul>
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {roasters.length > 1 && (
        <div className="remove-all">
          <button type="button" className="btn btn-ghost btn-danger" onClick={onRemoveAll}>Remove all roasters</button>
        </div>
      )}
      <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Prices</h3>
      <div className="settings">
        <label className="setting">
          <span>Coffee per cup</span>
          <span className="cup-input">
            <input type="number" inputMode="decimal" min={5} max={60} step={0.5} defaultValue={cupGrams}
              onChange={(e) => { const v = parseFloat(e.target.value); if (v >= 5 && v <= 60) onCupGrams(v); }} />
            <span>g</span>
          </span>
        </label>
        <label className="setting">
          <span>Show prices in</span>
          <select className="select" value={currency ?? ""} onChange={(e) => onCurrency(e.target.value || null)}>
            <option value="">Each store&apos;s currency</option>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <p className="hint" style={{ margin: 0 }}>
          Price per cup uses the bag size each store lists.
          {currency && <> Converted prices use European Central Bank rates{ratesDate ? ` from ${ratesDate}` : ""} and are marked ≈.</>}
        </p>
      </div>

      <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>Use your list on another device</h3>
      <p className="hint" style={{ margin: "0 0 10px" }}>
        This link holds only your roasters&apos; web addresses. Open it on your phone or in another browser and they&apos;re added there.
      </p>
      <div className="add-form">
        <label htmlFor="share-url" className="sr-only">Share link</label>
        <input id="share-url" className="input" readOnly value={shareUrl} onFocus={(e) => e.target.select()} style={{ flex: "1 1 240px" }} />
        <button type="button" className="btn" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
      </div>
    </>
  );
}
