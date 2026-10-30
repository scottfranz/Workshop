"use client";

import { useEffect, useRef, useState } from "react";
import type { RoasterFeed } from "@/lib/scrapers/types";
import type { SharedRoaster } from "@/lib/storage";

const CONCURRENCY = 4;

type Lookup = { state: "loading" } | { state: "ok"; feed: RoasterFeed } | { state: "error" };

export interface PickedRoaster {
  entry: SharedRoaster;
  feed: RoasterFeed;
}

/**
 * Lists every roaster in a share link so the visitor picks which to follow.
 * Short links carry only addresses, so each roaster is looked up as soon as the
 * list opens: that gives its real name, and the result is reused when following.
 */
export function LinkPreview({ incoming, alreadyNames, firstVisit, lookup, onFollow, onCancel }: {
  incoming: SharedRoaster[];
  alreadyNames: string[];
  firstVisit: boolean;
  lookup: (entry: SharedRoaster) => Promise<RoasterFeed>;
  onFollow: (picked: PickedRoaster[]) => void;
  onCancel: () => void;
}) {
  const [lookups, setLookups] = useState<Record<string, Lookup>>({});
  const [picked, setPicked] = useState(() => new Set(incoming.map((e) => e.url)));
  const [waiting, setWaiting] = useState(false);
  const pending = useRef(new Map<string, Promise<RoasterFeed | null>>());

  useEffect(() => {
    const queue = [...incoming];
    let cancelled = false;
    const run = (e: SharedRoaster) => {
      const p = lookup(e)
        .then((feed) => {
          if (feed.products.length === 0) throw new Error("no coffees");
          if (!cancelled) setLookups((l) => ({ ...l, [e.url]: { state: "ok", feed } }));
          return feed;
        })
        .catch(() => {
          if (!cancelled) {
            setLookups((l) => ({ ...l, [e.url]: { state: "error" } }));
            setPicked((s) => { const next = new Set(s); next.delete(e.url); return next; });
          }
          return null;
        });
      pending.current.set(e.url, p);
      return p;
    };
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let e = queue.shift(); e && !cancelled; e = queue.shift()) await run(e);
    });
    return () => { cancelled = true; };
  }, [incoming, lookup]);

  const toggle = (url: string) => setPicked((p) => {
    const next = new Set(p);
    if (next.has(url)) next.delete(url); else next.add(url);
    return next;
  });
  const usable = incoming.filter((e) => lookups[e.url]?.state !== "error");
  const allPicked = usable.length > 0 && usable.every((e) => picked.has(e.url));

  async function follow() {
    setWaiting(true);
    const chosen = incoming.filter((e) => picked.has(e.url));
    // Some lookups may still be running; wait for those.
    const feeds = await Promise.all(chosen.map((e) => pending.current.get(e.url) ?? lookup(e).catch(() => null)));
    onFollow(chosen.flatMap((entry, i) => (feeds[i] ? [{ entry, feed: feeds[i]! }] : [])));
  }

  const nameOf = (e: SharedRoaster) => {
    const l = lookups[e.url];
    return e.name || (l?.state === "ok" ? l.feed.siteName : null);
  };
  const shortHost = (url: string) => url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

  return (
    <>
      <p className="hint" style={{ margin: "0 0 12px" }}>
        {firstVisit
          ? "Bean Feed shows the newest coffees from roasters you follow. No account needed. Untick any you don't want."
          : "Untick any you don't want. They're added to the roasters you already follow."}
      </p>
      {usable.length > 1 && (
        <button type="button" className="link-btn" onClick={() => setPicked(allPicked ? new Set() : new Set(usable.map((e) => e.url)))}>
          {allPicked ? "Untick all" : "Tick all"}
        </button>
      )}
      <ul className="pick-list">
        {incoming.map((e) => {
          const state = lookups[e.url]?.state ?? "loading";
          const name = nameOf(e);
          return (
            <li key={e.url} className={state === "error" ? "already" : undefined}>
              <label>
                <input type="checkbox" checked={picked.has(e.url)} disabled={state === "error"} onChange={() => toggle(e.url)} />
                {name ? (
                  <strong>{name}</strong>
                ) : state === "error" ? (
                  <strong>{shortHost(e.url)}</strong>
                ) : (
                  <span className="name-loading skeleton" aria-label="Looking up roaster" />
                )}
                {state === "error" && <span className="muted">couldn&apos;t reach right now</span>}
              </label>
            </li>
          );
        })}
        {alreadyNames.map((name) => (
          <li key={name} className="already">
            <label>
              <input type="checkbox" checked disabled />
              <span>{name} <span className="muted">already following</span></span>
            </label>
          </li>
        ))}
      </ul>
      <div className="pick-actions">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={picked.size === 0 || waiting} onClick={follow} autoFocus>
          {waiting ? "Adding…" : `Follow ${allPicked && picked.size > 1 ? "all " : ""}${picked.size} roaster${picked.size === 1 ? "" : "s"}`}
        </button>
      </div>
    </>
  );
}
