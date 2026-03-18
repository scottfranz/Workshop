"use client";
import { useState, useEffect, useRef } from "react";

interface WatchEntry {
  id: string; title: string; type: "movie" | "tv"; year: number;
  director: string; runtime: number | null; seasons: number | null;
  season_from: number | null; season_to: number | null;
  tv_status: string | null; rating: number; date_watched: string;
  genre: string; poster: string | null; tmdb_id: number | null;
  watchlist: boolean; notes: string | null;
}

interface TmdbResult {
  tmdb_id: number; title: string; year: string;
  poster: string | null; type: "movie" | "tv";
}

const TV_STATUSES = ["Watching", "Finished", "Dropped", "On Hold"];

function Stars({ n, onSet }: { n: number; onSet?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i}
          onClick={() => onSet?.(i)}
          onMouseEnter={() => onSet && setHover(i)}
          onMouseLeave={() => onSet && setHover(0)}
          style={{ fontSize: 18, cursor: onSet ? "pointer" : "default",
            color: i <= (hover || n) ? "var(--gold)" : "var(--border)", transition: "color 0.1s" }}>
          ★
        </span>
      ))}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 3,
      background: type === "tv" ? "rgba(91,127,166,0.12)" : "rgba(201,150,58,0.12)",
      color: type === "tv" ? "var(--slate)" : "var(--gold)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {type === "tv" ? "TV" : "Film"}
    </span>
  );
}

function Poster({ entry, size = "md" }: { entry: any; size?: "sm"|"md"|"lg" }) {
  const [err, setErr] = useState(false);
  const dims: Record<string, [number,number]> = { sm:[48,72], md:[80,120], lg:[100,150] };
  const [w,h] = dims[size];
  const colors = ["#5a6a8a","#6b5a8a","#8a5a6b","#5a8a6b","#8a7a5a"];
  const color = colors[(entry.title?.charCodeAt(0) ?? 0) % colors.length];
  return entry.poster && !err
    ? <img src={entry.poster} alt={entry.title} onError={() => setErr(true)}
        style={{ width:w, height:h, objectFit:"cover", borderRadius:4, flexShrink:0, boxShadow:"2px 3px 10px rgba(30,26,20,0.2)" }} />
    : <div style={{ width:w, height:h, borderRadius:4, background:color, flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:22,
        boxShadow:"2px 3px 10px rgba(30,26,20,0.15)" }}>
        {entry.type === "tv" ? "📺" : "🎬"}
      </div>;
}

function groupByMonth(items: WatchEntry[]) {
  const groups: Record<string, WatchEntry[]> = {};
  for (const item of items) {
    const key = new Date(item.date_watched + "T12:00:00").toLocaleDateString("en-US", { month:"long", year:"numeric" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.entries(groups);
}

function TmdbSearch({ mediaType, onSelect }: { mediaType: "movie"|"tv"; onSelect: (r: TmdbResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(timeout.current);
    timeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/tmdb?q=${encodeURIComponent(query)}&type=${mediaType}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch { setResults([]); }
      setSearching(false);
    }, 400);
  }, [query, mediaType]);

  const inp = { padding:"9px 12px", border:"1px solid var(--border)", borderRadius:4,
    fontSize:13, fontFamily:"'Lato', sans-serif", color:"var(--ink)", background:"var(--warm-white)", outline:"none" };

  return (
    <>
      <input autoFocus placeholder={`Search for a ${mediaType === "movie" ? "film" : "TV show"}…`}
        value={query} onChange={e => setQuery(e.target.value)}
        style={{ ...inp, width:"100%", fontSize:14, marginBottom:12 }} />
      {searching && <div style={{ fontSize:13, color:"var(--ink-faint)", marginBottom:8 }}>Searching…</div>}
      {results.map(r => (
        <div key={r.tmdb_id} onClick={() => onSelect(r)}
          style={{ display:"flex", gap:14, padding:"10px 12px", borderRadius:8, cursor:"pointer",
            border:"1px solid transparent", marginBottom:4, transition:"all 0.12s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="var(--cream)"; (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.borderColor="transparent"; }}>
          <Poster entry={r} size="sm" />
          <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", gap:4 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--ink)" }}>{r.title}</div>
            <div style={{ fontSize:12, color:"var(--ink-faint)" }}>{r.year}</div>
          </div>
        </div>
      ))}
      {query && !searching && results.length === 0 && (
        <div style={{ fontSize:13, color:"var(--ink-faint)", fontStyle:"italic" }}>No results found</div>
      )}
    </>
  );
}

function WatchlistModal({ onClose, onSaved }: { onClose: () => void; onSaved: (e: WatchEntry) => void }) {
  const [mediaType, setMediaType] = useState<"movie"|"tv">("movie");
  const [selected, setSelected] = useState<TmdbResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    const res = await fetch("/api/movies", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selected.title, type: mediaType,
        year: parseInt(selected.year) || null,
        poster: selected.poster, tmdb_id: selected.tmdb_id,
        watchlist: true, rating: 0,
        date_watched: new Date().toISOString().split("T")[0],
        director: null, genre: null, runtime: null, seasons: null,
        season_from: null, season_to: null, tv_status: null, notes: null,
      }),
    });
    onSaved(await res.json());
    setDone(true);
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(30,26,20,0.55)", display:"flex",
        alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }}
      onClick={onClose}>
      <div style={{ background:"var(--warm-white)", borderRadius:10, width:"100%", maxWidth:480,
          boxShadow:"0 24px 64px rgba(0,0,0,0.28)", overflow:"hidden", maxHeight:"85vh", display:"flex", flexDirection:"column" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding:"22px 28px 18px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, marginBottom:12 }}>
            {done ? "Added to watchlist ✓" : "Add to Watchlist"}
          </div>
          {!done && (
            <div style={{ display:"flex", border:"1px solid var(--border)", borderRadius:6, overflow:"hidden", width:"fit-content" }}>
              {(["movie","tv"] as const).map(t => (
                <button key={t} onClick={() => { setMediaType(t); setSelected(null); }}
                  style={{ padding:"6px 16px", fontSize:12, fontFamily:"'Lato', sans-serif", border:"none",
                    background:mediaType===t?"var(--ink)":"var(--warm-white)",
                    color:mediaType===t?"var(--cream)":"var(--ink-faint)",
                    fontWeight:mediaType===t?700:400, cursor:"pointer" }}>
                  {t === "movie" ? "🎬 Film" : "📺 TV Show"}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:"20px 28px" }}>
          {done && selected ? (
            <div style={{ textAlign:"center", padding:"12px 0" }}>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}><Poster entry={selected} size="lg" /></div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, marginBottom:4 }}>{selected.title}</div>
              <div style={{ fontSize:13, color:"var(--ink-faint)", marginBottom:24 }}>{selected.year}</div>
              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button onClick={() => { setDone(false); setSelected(null); }}
                  style={{ padding:"9px 22px", background:"var(--ink)", color:"var(--cream)", border:"none",
                    borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                  Add another
                </button>
                <button onClick={onClose}
                  style={{ padding:"9px 22px", background:"transparent", color:"var(--ink-faint)",
                    border:"1px solid var(--border)", borderRadius:4, fontSize:13, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                  Done
                </button>
              </div>
            </div>
          ) : !selected ? (
            <TmdbSearch mediaType={mediaType} onSelect={setSelected} />
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ display:"flex", gap:14, padding:"14px 16px", background:"var(--cream)", borderRadius:8, border:"1px solid var(--border)" }}>
                <Poster entry={selected} size="sm" />
                <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", gap:4 }}>
                  <div style={{ fontFamily:"'Playfair Display', serif", fontSize:17 }}>{selected.title}</div>
                  <div style={{ fontSize:12, color:"var(--ink-faint)" }}>{selected.year}</div>
                </div>
                <button onClick={() => setSelected(null)}
                  style={{ background:"transparent", border:"none", cursor:"pointer", color:"var(--ink-faint)", fontSize:18, alignSelf:"flex-start" }}>×</button>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding:"10px 28px", background:"var(--ink)", color:"var(--cream)", border:"none",
                    borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                  {saving ? "Saving…" : "Add to Watchlist →"}
                </button>
                <button onClick={onClose}
                  style={{ padding:"10px 18px", background:"transparent", color:"var(--ink-faint)",
                    border:"1px solid var(--border)", borderRadius:4, fontSize:13, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogModal({ onClose, onSaved }: { onClose: () => void; onSaved: (e: WatchEntry) => void }) {
  const [mediaType, setMediaType] = useState<"movie"|"tv">("movie");
  const [selected, setSelected] = useState<TmdbResult | null>(null);
  const [rating, setRating] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [tvStatus, setTvStatus] = useState("Finished");
  const [seasonFrom, setSeasonFrom] = useState(1);
  const [seasonTo, setSeasonTo] = useState(1);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"search"|"details"|"success">("search");

  const inp = { padding:"9px 12px", border:"1px solid var(--border)", borderRadius:4,
    fontSize:13, fontFamily:"'Lato', sans-serif", color:"var(--ink)", background:"var(--warm-white)", outline:"none" };

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    const res = await fetch("/api/movies", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selected.title, type: mediaType,
        year: parseInt(selected.year) || null,
        poster: selected.poster, tmdb_id: selected.tmdb_id,
        rating, date_watched: date, watchlist: false,
        tv_status: mediaType === "tv" ? tvStatus : null,
        season_from: mediaType === "tv" ? seasonFrom : null,
        season_to: mediaType === "tv" ? seasonTo : null,
        director: null, genre: null, runtime: null, seasons: null, notes: null,
      }),
    });
    onSaved(await res.json());
    setStep("success");
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(30,26,20,0.55)", display:"flex",
        alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }}
      onClick={onClose}>
      <div style={{ background:"var(--warm-white)", borderRadius:10, width:"100%", maxWidth:500,
          boxShadow:"0 24px 64px rgba(0,0,0,0.28)", overflow:"hidden", maxHeight:"90vh", display:"flex", flexDirection:"column" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding:"22px 28px 18px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, marginBottom:4 }}>
            {step === "success" ? "Logged! 🎉" : "Log a Film or Show"}
          </div>
          {step === "search" && (
            <div style={{ display:"flex", border:"1px solid var(--border)", borderRadius:6, overflow:"hidden", width:"fit-content", marginTop:12 }}>
              {(["movie","tv"] as const).map(t => (
                <button key={t} onClick={() => { setMediaType(t); setSelected(null); setStep("search"); }}
                  style={{ padding:"6px 16px", fontSize:12, fontFamily:"'Lato', sans-serif", border:"none",
                    background:mediaType===t?"var(--ink)":"var(--warm-white)",
                    color:mediaType===t?"var(--cream)":"var(--ink-faint)",
                    fontWeight:mediaType===t?700:400, cursor:"pointer" }}>
                  {t === "movie" ? "🎬 Film" : "📺 TV Show"}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ overflowY:"auto", flex:1 }}>
          {step === "search" && (
            <div style={{ padding:"20px 28px" }}>
              <TmdbSearch mediaType={mediaType} onSelect={r => { setSelected(r); setStep("details"); }} />
            </div>
          )}
          {step === "details" && selected && (
            <div style={{ padding:"20px 28px", display:"flex", flexDirection:"column", gap:18 }}>
              <div style={{ display:"flex", gap:14, padding:"14px 16px", background:"var(--cream)", borderRadius:8, border:"1px solid var(--border)" }}>
                <Poster entry={selected} size="sm" />
                <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", gap:4 }}>
                  <div style={{ fontFamily:"'Playfair Display', serif", fontSize:17 }}>{selected.title}</div>
                  <div style={{ fontSize:12, color:"var(--ink-faint)" }}>{selected.year}</div>
                </div>
                <button onClick={() => { setSelected(null); setStep("search"); }}
                  style={{ background:"transparent", border:"none", cursor:"pointer", color:"var(--ink-faint)", fontSize:18, alignSelf:"flex-start" }}>×</button>
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)", marginBottom:8 }}>Rating</div>
                <Stars n={rating} onSet={setRating} />
              </div>
              {mediaType === "tv" && (
                <>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)", marginBottom:8 }}>Status</div>
                    <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                      {TV_STATUSES.map(s => (
                        <button key={s} onClick={() => setTvStatus(s)}
                          style={{ padding:"6px 14px", borderRadius:20,
                            border:`1px solid ${tvStatus===s?"var(--slate)":"var(--border)"}`,
                            background:tvStatus===s?"rgba(91,127,166,0.1)":"transparent",
                            color:tvStatus===s?"var(--slate)":"var(--ink-faint)",
                            fontWeight:tvStatus===s?700:400, fontSize:12, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)", marginBottom:8 }}>Seasons watched</div>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <input type="number" min={1} value={seasonFrom} onChange={e => setSeasonFrom(parseInt(e.target.value)||1)} style={{ ...inp, width:64 }} />
                      <span style={{ color:"var(--ink-faint)", fontSize:13 }}>to</span>
                      <input type="number" min={1} value={seasonTo} onChange={e => setSeasonTo(parseInt(e.target.value)||1)} style={{ ...inp, width:64 }} />
                    </div>
                  </div>
                </>
              )}
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)", marginBottom:8 }}>
                  {mediaType === "tv" ? "Date finished" : "Date watched"}
                </div>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width:"100%" }} />
              </div>
              <div style={{ display:"flex", gap:10, paddingTop:4 }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding:"10px 28px", background:"var(--ink)", color:"var(--cream)", border:"none",
                    borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                  {saving ? "Saving…" : "Save →"}
                </button>
                <button onClick={onClose}
                  style={{ padding:"10px 18px", background:"transparent", color:"var(--ink-faint)",
                    border:"1px solid var(--border)", borderRadius:4, fontSize:13, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {step === "success" && selected && (
            <div style={{ padding:"28px", textAlign:"center" }}>
              <div style={{ fontSize:44, marginBottom:16 }}>{mediaType === "tv" ? "📺" : "🎬"}</div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, marginBottom:8 }}>{selected.title}</div>
              <div style={{ fontSize:13, color:"var(--ink-faint)", marginBottom:20 }}>{selected.year}</div>
              {rating > 0 && <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}><Stars n={rating} /></div>}
              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button onClick={() => { setStep("search"); setSelected(null); setRating(0); }}
                  style={{ padding:"9px 22px", background:"var(--ink)", color:"var(--cream)", border:"none",
                    borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                  Log another
                </button>
                <button onClick={onClose}
                  style={{ padding:"9px 22px", background:"transparent", color:"var(--ink-faint)",
                    border:"1px solid var(--border)", borderRadius:4, fontSize:13, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WatchingPage() {
  const [entries, setEntries] = useState<WatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"timeline"|"watchlist">("timeline");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showLog, setShowLog] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);

  useEffect(() => {
    fetch("/api/movies")
      .then(r => r.json())
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const watched = entries.filter(e => !e.watchlist);
  const watchlist = entries.filter(e => e.watchlist);
  const filtered = watched.filter(e => typeFilter === "all" || e.type === typeFilter);
  const months = groupByMonth(filtered);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh" }}>

      <div style={{ padding:"24px 48px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:26 }}>Movies & TV</div>
          <div style={{ fontSize:13, color:"var(--ink-faint)", fontWeight:300 }}>Your film diary · posters from TMDb</div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          {tab === "watchlist" && (
            <button onClick={() => setShowWatchlist(true)}
              style={{ padding:"9px 20px", background:"transparent", color:"var(--ink)",
                border:"1px solid var(--border)", borderRadius:4, fontSize:13, fontWeight:700,
                cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
              + Add to Watchlist
            </button>
          )}
          <button onClick={() => setShowLog(true)}
            style={{ padding:"9px 20px", background:"var(--ink)", color:"var(--cream)", border:"none",
              borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
            + Log Film or Show
          </button>
        </div>
      </div>

      <div style={{ padding:"14px 48px", borderBottom:"1px solid var(--border)", background:"var(--cream)", display:"flex", gap:44, flexShrink:0 }}>
        {[
          { label:"Watched in "+new Date().getFullYear(), value: watched.filter(e => e.date_watched?.startsWith(String(new Date().getFullYear()))).length },
          { label:"Films", value: watched.filter(e=>e.type==="movie").length },
          { label:"Shows", value: watched.filter(e=>e.type==="tv").length },
          { label:"Watchlist", value: watchlist.length },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--ink-faint)" }}>{s.label}</div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:600, color:"var(--gold)", marginTop:2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding:"0 48px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex" }}>
          {([{key:"timeline",label:`Watched (${watched.length})`},{key:"watchlist",label:`Watchlist (${watchlist.length})`}] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding:"13px 20px", fontSize:13, fontFamily:"'Lato', sans-serif", border:"none",
                borderBottom:tab===t.key?"2px solid var(--gold)":"2px solid transparent",
                background:"transparent", color:tab===t.key?"var(--gold)":"var(--ink-faint)",
                fontWeight:tab===t.key?700:400, cursor:"pointer", marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:7 }}>
          {[{key:"all",label:"All"},{key:"movie",label:"🎬 Films"},{key:"tv",label:"📺 Shows"}].map(f => (
            <button key={f.key} onClick={() => setTypeFilter(f.key)}
              style={{ padding:"4px 12px", borderRadius:20,
                border:`1px solid ${typeFilter===f.key?"var(--gold)":"var(--border)"}`,
                background:typeFilter===f.key?"var(--gold-light)":"transparent",
                color:typeFilter===f.key?"var(--ink)":"var(--ink-faint)",
                fontSize:12, fontWeight:typeFilter===f.key?700:400, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"32px 48px" }}>
        {loading && <div style={{ textAlign:"center", padding:"60px 0", color:"var(--ink-faint)" }}>Loading…</div>}

        {!loading && tab === "timeline" && watched.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0", color:"var(--ink-faint)" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🎬</div>
            <div style={{ fontSize:14, marginBottom:16 }}>Nothing logged yet.</div>
            <button onClick={() => setShowLog(true)}
              style={{ padding:"9px 20px", background:"var(--ink)", color:"var(--cream)", border:"none",
                borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
              Log your first film or show
            </button>
          </div>
        )}

        {!loading && tab === "timeline" && months.map(([month, items]) => (
          <div key={month} style={{ marginBottom:48 }}>
            <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20 }}>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:19 }}>{month}</div>
              <div style={{ flex:1, height:1, background:"var(--border)" }} />
              <div style={{ fontSize:12, color:"var(--ink-faint)" }}>{items.length} title{items.length!==1?"s":""}</div>
            </div>
            {items.map(item => (
              <div key={item.id} style={{ display:"flex", gap:20, padding:"14px 18px", borderRadius:8,
                  border:"1px solid transparent", cursor:"pointer", transition:"all 0.15s", marginBottom:2 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="var(--cream)"; (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.borderColor="transparent"; }}>
                <Poster entry={item} size="md" />
                <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", gap:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontFamily:"'Playfair Display', serif", fontSize:19, fontWeight:600 }}>{item.title}</span>
                    <TypeBadge type={item.type} />
                  </div>
                  <div style={{ fontSize:13, color:"var(--ink-faint)" }}>
                    {[item.year, item.director,
                      item.runtime ? `${item.runtime} min` : null,
                      item.season_from ? `S${item.season_from}–S${item.season_to} · ${item.tv_status}` : null,
                      item.genre].filter(Boolean).join(" · ")}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    {item.rating > 0 && <Stars n={item.rating} />}
                    <span style={{ fontSize:12, color:"var(--ink-faint)" }}>
                      {new Date(item.date_watched+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {!loading && tab === "watchlist" && (
          <>
            {watchlist.length === 0 && (
              <div style={{ textAlign:"center", padding:"60px 0", color:"var(--ink-faint)" }}>
                <div style={{ fontSize:36, marginBottom:12 }}>🍿</div>
                <div style={{ fontSize:14, marginBottom:16 }}>Your watchlist is empty.</div>
                <button onClick={() => setShowWatchlist(true)}
                  style={{ padding:"9px 20px", background:"var(--ink)", color:"var(--cream)", border:"none",
                    borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
                  Add something
                </button>
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(108px, 1fr))", gap:28 }}>
              {watchlist.filter(e => typeFilter==="all"||e.type===typeFilter).map(item => (
                <div key={item.id} style={{ display:"flex", flexDirection:"column", gap:9 }}>
                  <Poster entry={item} size="lg" />
                  <div>
                    <TypeBadge type={item.type} />
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--ink)", lineHeight:1.35, marginTop:4 }}>{item.title}</div>
                    <div style={{ fontSize:11, color:"var(--ink-faint)", marginTop:2 }}>{item.year}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showLog && <LogModal onClose={() => setShowLog(false)} onSaved={e => { setEntries(prev => [e, ...prev]); setShowLog(false); }} />}
      {showWatchlist && <WatchlistModal onClose={() => setShowWatchlist(false)} onSaved={e => { setEntries(prev => [e, ...prev]); setShowWatchlist(false); }} />}
    </div>
  );
}
