"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildItems, filterAndSort, markSeen, type FeedItem } from "@/lib/feed";
import type { Product, RoasterFeed } from "@/lib/scrapers/types";
import { SITE_NAME } from "@/lib/site";
import {
  ROASTER_COLORS, beginVisit, decodeShare, emptyState, loadCache, loadState, pickColor, saveCache, saveState, withColors,
  type CachedFeed, type Prefs, type SavedRoaster, type SavedState, type SortMode, type ViewMode,
} from "@/lib/storage";
import { AddRoasterForm } from "./AddRoasterForm";
import { Dialog } from "./Dialog";
import { ManageRoasters } from "./ManageRoasters";
import { ProductCard, SkeletonCard } from "./ProductCard";

export type RoasterStatus = { state: "loading" } | { state: "ok" } | { state: "error"; message: string };

const STALE_MS = 20 * 60 * 1000;
const CONCURRENCY = 4;

async function requestFeed(params: Record<string, string>): Promise<RoasterFeed> {
  const res = await fetch(`/api/roaster?${new URLSearchParams(params)}`);
  const data = await res.json().catch(() => ({ error: "The server sent an unexpected response." }));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as RoasterFeed;
}

function hostName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function Feed() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<SavedState>(emptyState);
  const [cache, setCache] = useState<Record<string, CachedFeed>>({});
  const [status, setStatus] = useState<Record<string, RoasterStatus>>({});
  const [storageOk, setStorageOk] = useState(true);
  const [query, setQuery] = useState("");
  const [roasterFilter, setRoasterFilter] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"add" | "manage" | null>(null);
  const [pendingImport, setPendingImport] = useState<Omit<SavedRoaster, "addedAt">[] | null>(null);
  const [lastHidden, setLastHidden] = useState<string | null>(null);
  const [chipsOpen, setChipsOpen] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [hiddenChips, setHiddenChips] = useState(0);
  const barRef = useRef<HTMLElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const readShareLink = useCallback(() => {
    const encoded = new URLSearchParams(window.location.hash.slice(1)).get("follow");
    if (!encoded) return;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    const shared = decodeShare(encoded);
    const following = new Set(stateRef.current.roasters.map((r) => r.id));
    const incoming = shared.filter((r) => !following.has(r.id));
    if (incoming.length) setPendingImport(incoming);
    else setShareNote(shared.length ? "You already follow every roaster in that link." : "That share link looks incomplete. Try copying it again.");
  }, []);

  // ── Loading & saving ──────────────────────────────────────────────────────
  const refreshOne = useCallback(async (r: SavedRoaster) => {
    setStatus((s) => ({ ...s, [r.id]: { state: "loading" } }));
    try {
      const feed = await requestFeed({ url: r.feedUrl, platform: r.platform });
      setCache((c) => ({ ...c, [r.id]: { fetchedAt: Date.now(), products: feed.products, skipped: feed.skipped } }));
      setState((s) => ({
        ...s,
        seen: markSeen(s.seen, r.id, feed.products),
        // The roaster moved platform or domain and the server re-detected it: remember the new setup.
        roasters: s.roasters.map((x) => (x.id === r.id && (x.platform !== feed.source.platform || x.feedUrl !== feed.source.feedUrl)
          ? { ...x, platform: feed.source.platform, feedUrl: feed.source.feedUrl }
          : x)),
      }));
      setStatus((s) => ({ ...s, [r.id]: { state: "ok" } }));
    } catch (err) {
      setStatus((s) => ({ ...s, [r.id]: { state: "error", message: err instanceof Error ? err.message : String(err) } }));
    }
  }, []);

  const refreshMany = useCallback(async (roasters: SavedRoaster[]) => {
    const queue = [...roasters];
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let r = queue.shift(); r; r = queue.shift()) await refreshOne(r);
    }));
  }, [refreshOne]);

  useEffect(() => {
    const loaded = beginVisit(loadState());
    const cached = loadCache();
    setState(loaded);
    stateRef.current = loaded; // readShareLink below compares against what's saved
    setCache(cached);
    setStorageOk(saveState(loaded));
    setReady(true);

    readShareLink();
    refreshMany(loaded.roasters.filter((r) => !cached[r.id] || Date.now() - cached[r.id].fetchedAt > STALE_MS));
  }, [refreshMany, readShareLink]);

  // Pasting a share link into a tab that already has the site open only changes
  // the #fragment, which doesn't reload the page, so listen for that too.
  useEffect(() => {
    window.addEventListener("hashchange", readShareLink);
    return () => window.removeEventListener("hashchange", readShareLink);
  }, [readShareLink]);

  useEffect(() => {
    if (ready) setStorageOk(saveState(state));
  }, [state, ready]);

  useEffect(() => {
    if (!ready) return;
    const ids = new Set(state.roasters.map((r) => r.id));
    saveCache(Object.fromEntries(Object.entries(cache).filter(([id]) => ids.has(id))));
  }, [cache, state.roasters, ready]);

  // Roasters wrap onto at most two rows until expanded. Chips past that are
  // counted for the "+N more" button and hidden from focus.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => {
      const limit = bar.clientHeight;
      let hidden = 0;
      for (const chip of Array.from(bar.children) as HTMLElement[]) {
        const over = !chipsOpen && chip.offsetTop >= limit;
        chip.toggleAttribute("data-overflow", over);
        chip.toggleAttribute("inert", over);
        if (over) hidden++;
      }
      setHiddenChips(hidden);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [chipsOpen, state.roasters, ready]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function addRoaster(url: string, name?: string) {
    const feed = await requestFeed({ url });
    const id = feed.source.feedUrl;
    const existing = stateRef.current.roasters.find((r) => r.id === id);
    if (existing) throw new Error(`You're already following ${existing.name}.`);
    if (feed.products.length === 0) {
      throw new Error("We reached the store but didn't find any coffees. Try the link to their coffee or shop page.");
    }
    const now = Date.now();
    const roaster: SavedRoaster = {
      id, name: name || feed.siteName || hostName(id), platform: feed.source.platform, feedUrl: id, addedAt: now,
      color: pickColor(stateRef.current.roasters.map((r) => r.color)),
    };
    setState((s) => ({ ...s, roasters: [...s.roasters, roaster], seen: markSeen(s.seen, id, feed.products, now) }));
    setCache((c) => ({ ...c, [id]: { fetchedAt: now, products: feed.products, skipped: feed.skipped } }));
    setStatus((s) => ({ ...s, [id]: { state: "ok" } }));
    setDialog(null);
  }

  function removeRoaster(id: string) {
    const r = state.roasters.find((x) => x.id === id);
    if (r && !window.confirm(`Remove ${r.name} from your roasters?`)) return;
    setState((s) => ({ ...s, roasters: s.roasters.filter((x) => x.id !== id) }));
    if (roasterFilter === id) setRoasterFilter(null);
  }

  function removeAllRoasters() {
    const n = state.roasters.length;
    if (!window.confirm(`Remove all ${n} roaster${n === 1 ? "" : "s"}? This can't be undone.`)) return;
    // Seen history, hidden coffees and the cache are per roaster, so they go too.
    setState((s) => ({ ...s, roasters: [], seen: {}, hidden: [] }));
    setCache({});
    setStatus({});
    setRoasterFilter(null);
    setDialog(null);
  }

  function importShared() {
    if (!pendingImport) return;
    const now = Date.now();
    const added = pendingImport.map((r) => ({ ...r, addedAt: now }));
    setState((s) => ({ ...s, roasters: withColors([...s.roasters, ...added.filter((a) => !s.roasters.some((x) => x.id === a.id))]) }));
    setPendingImport(null);
    refreshMany(added);
  }

  const setPref = <K extends keyof Prefs>(key: K, value: Prefs[K]) => setState((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }));

  function hide(key: string) {
    setState((s) => ({ ...s, hidden: [...s.hidden, key] }));
    setLastHidden(key);
  }

  // ── Derived feed ──────────────────────────────────────────────────────────
  const allItems: FeedItem[] = useMemo(() => state.roasters.flatMap((r) => {
    const products: Product[] = cache[r.id]?.products ?? [];
    return buildItems(r, products, state.seen[r.id] ?? {}, state.prevVisit);
  }), [state.roasters, state.seen, state.prevVisit, cache]);

  const hidden = useMemo(() => new Set(state.hidden), [state.hidden]);
  const visible = useMemo(
    () => filterAndSort(allItems, state.prefs, { roasterId: roasterFilter, query, hidden }),
    [allItems, state.prefs, roasterFilter, query, hidden],
  );
  const countFor = (id: string | null) => filterAndSort(allItems, state.prefs, { roasterId: id, query: "", hidden }).length;
  const colorOf = (id: string) => state.roasters.find((r) => r.id === id)?.color ?? ROASTER_COLORS[0];
  const sinceLastVisit = allItems.filter((i) => i.sinceLastVisit && i.available && !hidden.has(i.key)).length;
  const anyLoading = Object.values(status).some((s) => s.state === "loading");
  const errors = state.roasters.filter((r) => status[r.id]?.state === "error");
  const firstLoad = anyLoading && allItems.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <a className="brand" href="/">
            <img className="brand-mark" src="/icon.svg" alt="" />
            {SITE_NAME}
          </a>
          {ready && state.roasters.length > 0 && (
            <div className="header-actions">
              <button type="button" className="btn btn-ghost" onClick={() => refreshMany(state.roasters)} disabled={anyLoading} aria-label="Check for new coffees">
                <span aria-hidden="true">↻</span><span className="hide-sm">{anyLoading ? "Checking…" : "Refresh"}</span>
              </button>
              <button type="button" className="btn" onClick={() => setDialog("manage")}>
                Roasters <span className="hide-sm">({state.roasters.length})</span>
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setDialog("add")} aria-label="Follow a roaster">
                + <span className="hide-sm" aria-hidden="true">Follow</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="wrap">
        {!storageOk && (
          <p className="notice" role="status">
            Your browser isn&apos;t letting this site save anything (private browsing, maybe?), so your roasters will be forgotten when you close this tab.
          </p>
        )}

        {shareNote && (
          <p className="notice" role="status">
            {shareNote}{" "}
            <button type="button" className="btn btn-ghost" style={{ minHeight: 28 }} onClick={() => setShareNote(null)}>OK</button>
          </p>
        )}

        {pendingImport && (
          <div className="banner" role="status">
            <span>This link has <strong>{pendingImport.length} roaster{pendingImport.length === 1 ? "" : "s"}</strong> to follow: {pendingImport.slice(0, 4).map((r) => r.name).join(", ")}{pendingImport.length > 4 ? "…" : ""}</span>
            <button type="button" className="btn btn-primary" onClick={importShared}>Follow them</button>
            <button type="button" className="btn btn-ghost" style={{ marginLeft: 0 }} onClick={() => setPendingImport(null)}>No thanks</button>
          </div>
        )}

        {!ready ? null : state.roasters.length === 0 ? (
          <Welcome onAdd={addRoaster} />
        ) : (
          <>
            <nav ref={barRef} className={`roaster-bar${chipsOpen ? "" : " collapsed"}`} aria-label="Filter by roaster">
              <span className={`chip-group${roasterFilter === null ? " active" : ""}`}>
                <button type="button" className="chip" aria-pressed={roasterFilter === null} onClick={() => setRoasterFilter(null)}>
                  All <span className="chip-count">{countFor(null)}</span>
                </button>
              </span>
              {state.roasters.map((r) => {
                const s = status[r.id]?.state;
                const active = roasterFilter === r.id;
                return (
                  <span key={r.id} className={`chip-group${active ? " active" : ""}`}>
                    <button type="button" className="chip" aria-pressed={active}
                      onClick={() => setRoasterFilter(active ? null : r.id)}
                      title={s === "error" ? `Couldn't update ${r.name}` : undefined}>
                      <span className={`chip-dot ${s === "loading" || s === "error" ? s : ""}`} style={{ "--rc": colorOf(r.id) } as React.CSSProperties} aria-hidden="true" />
                      {r.name} <span className="chip-count">{countFor(r.id)}</span>
                    </button>
                    <button type="button" className="chip-remove" onClick={() => removeRoaster(r.id)} aria-label={`Remove ${r.name}`} title={`Remove ${r.name}`}>×</button>
                  </span>
                );
              })}
            </nav>
            {(hiddenChips > 0 || chipsOpen) && (
              <button type="button" className="more-roasters" aria-expanded={chipsOpen} onClick={() => setChipsOpen((o) => !o)}>
                {chipsOpen ? "Show fewer" : `+${hiddenChips} more`}
              </button>
            )}

            <div className="toolbar">
              <label className="sr-only" htmlFor="search">Search coffees</label>
              <input id="search" className="search" type="search" placeholder="Search origin, process, notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <label className="sr-only" htmlFor="sort">Sort</label>
              <select id="sort" className="select" value={state.prefs.sort} onChange={(e) => setPref("sort", e.target.value as SortMode)}>
                <option value="newest">Newest first</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="roaster">By roaster</option>
              </select>
              <div className="segmented" role="group" aria-label="Layout">
                {(["grid", "list"] as ViewMode[]).map((v) => (
                  <button key={v} type="button" aria-pressed={state.prefs.view === v} onClick={() => setPref("view", v)} title={v === "grid" ? "Grid" : "List"}>
                    <span aria-hidden="true">{v === "grid" ? "▦" : "☰"}</span><span className="sr-only">{v === "grid" ? "Grid view" : "List view"}</span>
                  </button>
                ))}
              </div>
            </div>

            {sinceLastVisit > 0 && (
              <div className="banner" role="status">
                <span><strong>{sinceLastVisit} new coffee{sinceLastVisit === 1 ? "" : "s"}</strong> since your last visit.</span>
              </div>
            )}

            {lastHidden && (
              <p className="notice" role="status">
                Hidden.{" "}
                <button type="button" className="btn btn-ghost" style={{ minHeight: 28 }} onClick={() => {
                  setState((s) => ({ ...s, hidden: s.hidden.filter((k) => k !== lastHidden) }));
                  setLastHidden(null);
                }}>Undo</button>
              </p>
            )}

            {errors.length > 0 && !anyLoading && (
              <p className="notice">
                Couldn&apos;t update {errors.map((r) => r.name).join(", ")}. Showing what we had before.{" "}
                <button type="button" className="btn btn-ghost" style={{ minHeight: 28 }} onClick={() => setDialog("manage")}>Details</button>
              </p>
            )}

            {firstLoad ? (
              <div className={state.prefs.view}>{Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} view={state.prefs.view} />)}</div>
            ) : visible.length === 0 ? (
              <p className="empty">
                {query ? `Nothing matches “${query}”.` : "No coffees in stock right now."}
              </p>
            ) : (
              <section className={state.prefs.view} aria-label="Coffees">
                {visible.map((item) => (
                  <ProductCard key={item.key} item={item} color={colorOf(item.roasterId)} view={state.prefs.view}
                    onHide={() => hide(item.key)} onRoaster={() => setRoasterFilter(item.roasterId)} />
                ))}
              </section>
            )}
          </>
        )}
      </main>

      <Dialog open={dialog === "add"} onClose={() => setDialog(null)} title="Follow a roaster">
        <AddRoasterForm onAdd={addRoaster} autoFocus />
      </Dialog>

      <Dialog open={dialog === "manage"} onClose={() => setDialog(null)} title="Your roasters">
        <ManageRoasters
          roasters={state.roasters}
          status={status}
          cache={cache}
          onRecolor={(id, color) => setState((s) => ({ ...s, roasters: s.roasters.map((r) => (r.id === id ? { ...r, color } : r)) }))}
          onRename={(id, name) => setState((s) => ({ ...s, roasters: s.roasters.map((r) => (r.id === id ? { ...r, name } : r)) }))}
          onRemove={removeRoaster}
          onRemoveAll={removeAllRoasters}
          onRefresh={(id) => { const r = state.roasters.find((x) => x.id === id); if (r) refreshOne(r); }}
        />
      </Dialog>
    </>
  );
}

function Welcome({ onAdd }: { onAdd: (url: string, name?: string) => Promise<void> }) {
  return (
    <section className="welcome">
      <h1>Fresh coffees from roasters you love.</h1>
      <p>Follow a few roasters and new bags show up here as soon as they land in their shops. No account needed.</p>
      <AddRoasterForm onAdd={onAdd} compact />
      <ul className="privacy-points">
        <li><strong>No sign-up</strong>Nothing to create, nothing to remember.</li>
        <li><strong>Stays on your device</strong>Your roasters are saved in this browser only.</li>
        <li><strong>No tracking</strong>No cookies, analytics or ads. Ever.</li>
      </ul>
    </section>
  );
}
