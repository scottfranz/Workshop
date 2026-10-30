"use client";

import { useState } from "react";
import type { SharedRoaster } from "@/lib/storage";

const display = (url: string) => url.replace(/^https?:\/\//, "").replace(/^www\./, "");

/** Lists every roaster in a share link so the visitor picks which to follow. */
export function LinkPreview({ incoming, already, onFollow, onCancel }: {
  incoming: SharedRoaster[];
  already: SharedRoaster[];
  onFollow: (selected: SharedRoaster[]) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState(() => new Set(incoming.map((e) => e.url)));
  const toggle = (url: string) => setPicked((p) => {
    const next = new Set(p);
    if (next.has(url)) next.delete(url); else next.add(url);
    return next;
  });
  const allPicked = picked.size === incoming.length;

  return (
    <>
      <p className="hint" style={{ margin: "0 0 12px" }}>
        Untick any you don&apos;t want. They&apos;re added to the roasters you already follow.
      </p>
      {incoming.length > 1 && (
        <button type="button" className="link-btn" onClick={() => setPicked(allPicked ? new Set() : new Set(incoming.map((e) => e.url)))}>
          {allPicked ? "Untick all" : "Tick all"}
        </button>
      )}
      <ul className="pick-list">
        {incoming.map((e) => (
          <li key={e.url}>
            <label>
              <input type="checkbox" checked={picked.has(e.url)} onChange={() => toggle(e.url)} />
              <span>
                {e.name ? <><strong>{e.name}</strong> <span className="muted">{display(e.url)}</span></> : <strong>{display(e.url)}</strong>}
              </span>
            </label>
          </li>
        ))}
        {already.map((e) => (
          <li key={e.url} className="already">
            <label>
              <input type="checkbox" checked disabled />
              <span>{e.name ?? display(e.url)} <span className="muted">already following</span></span>
            </label>
          </li>
        ))}
      </ul>
      <div className="pick-actions">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={picked.size === 0}
          onClick={() => onFollow(incoming.filter((e) => picked.has(e.url)))}>
          Follow {picked.size === incoming.length && picked.size > 1 ? "all " : ""}{picked.size} roaster{picked.size === 1 ? "" : "s"}
        </button>
      </div>
    </>
  );
}
