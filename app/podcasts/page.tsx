"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PODCAST_COLOR = "#7B5EA7";
const PODCAST_LIGHT = "rgba(123,94,167,0.12)";
const PODCAST_BORDER = "rgba(123,94,167,0.35)";

interface SpotifyEpisode {
  spotify_id: string;
  episode_title: string;
  show_name: string;
  artwork_url: string | null;
  release_date: string | null;
  duration_ms: number | null;
  description: string | null;
  spotify_url: string | null;
}

interface LoggedEpisode {
  id: number;
  spotify_id: string;
  episode_title: string;
  show_name: string;
  artwork_url: string | null;
  release_date: string | null;
  duration_ms: number | null;
  rating: number | null;
  notes: string | null;
  listened_at: string;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatListenedAt(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function groupByShow(episodes: LoggedEpisode[]): Record<string, LoggedEpisode[]> {
  const groups: Record<string, LoggedEpisode[]> = {};
  for (const ep of episodes) {
    if (!groups[ep.show_name]) groups[ep.show_name] = [];
    groups[ep.show_name].push(ep);
  }
  return groups;
}

export default function PodcastsPage() {
  const [episodes, setEpisodes] = useState<LoggedEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyEpisode[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SpotifyEpisode | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [listenedAt, setListenedAt] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [expandedShow, setExpandedShow] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchEpisodes(); }, []);

  async function fetchEpisodes() {
    setLoading(true);
    const { data } = await supabase
      .from("podcast_episodes")
      .select("*")
      .order("listened_at", { ascending: false });
    setEpisodes(data ?? []);
    if (data && data.length > 0) {
      setExpandedShow(data[0].show_name);
    }
    setLoading(false);
  }

  function handleSearchInput(val: string) {
    setSearchQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (val.trim().length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/spotify?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        setSearchResults(data.episodes ?? []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
  }

  function selectEpisode(ep: SpotifyEpisode) {
    setSelected(ep);
    setSearchResults([]);
    setSearchQuery("");
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    await supabase.from("podcast_episodes").insert({
      spotify_id: selected.spotify_id,
      episode_title: selected.episode_title,
      show_name: selected.show_name,
      artwork_url: selected.artwork_url,
      release_date: selected.release_date,
      duration_ms: selected.duration_ms,
      rating,
      notes: notes.trim() || null,
      listened_at: listenedAt,
    });
    setSaving(false);
    closeModal();
    fetchEpisodes();
  }

  function closeModal() {
    setShowModal(false);
    setSelected(null);
    setSearchQuery("");
    setSearchResults([]);
    setRating(null);
    setNotes("");
    setListenedAt(new Date().toISOString().split("T")[0]);
  }

  const grouped = groupByShow(episodes);
  const showNames = Object.keys(grouped);


  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <style>{`
        .podcast-log-btn:hover { opacity: 0.88; }
        .rating-btn {
          transition: all 0.12s;
          border: 1px solid var(--border);
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          font-family: 'Lato', sans-serif;
          font-weight: 700;
          font-size: 14px;
          color: var(--ink-faint);
          padding: 9px 0;
        }
        .rating-btn:hover { border-color: ${PODCAST_COLOR}; color: ${PODCAST_COLOR}; }
        .rating-btn.active { background: ${PODCAST_COLOR}; border-color: ${PODCAST_COLOR}; color: white; }
        .show-header:hover { background: var(--cream) !important; }
        .ep-row:hover { background: rgba(123,94,167,0.04) !important; }
        .result-row:hover { background: rgba(123,94,167,0.08) !important; }
        @media (max-width: 600px) {
          .podcasts-title-row { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
          .rating-grid { grid-template-columns: repeat(5, 1fr) !important; }
          .podcasts-stats-bar { padding: 12px 20px !important; gap: 24px !important; }
          .podcasts-content { padding: 20px !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: "24px 48px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }} className="podcasts-title-row">
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "var(--ink)" }}>Podcasts</div>
          <div style={{ fontSize: 13, color: "var(--ink-faint)", fontWeight: 300, marginTop: 2 }}>
            {showNames.length} show{showNames.length !== 1 ? "s" : ""} · {episodes.length} episode{episodes.length !== 1 ? "s" : ""} logged
          </div>
        </div>
        <button
          className="podcast-log-btn"
          onClick={() => setShowModal(true)}
          style={{ padding: "9px 20px", background: PODCAST_COLOR, color: "white", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Lato', sans-serif", transition: "opacity 0.15s" }}
        >
          + Log Episode
        </button>
      </div>

      {/* Stats bar */}
      {episodes.length > 0 && (
        <div className="podcasts-stats-bar" style={{ padding: "14px 48px", borderBottom: "1px solid var(--border)", background: "var(--cream)", display: "flex", gap: 44, flexShrink: 0 }}>
          {[
            { label: "Episodes", value: episodes.length },
            { label: "Shows", value: showNames.length },
            { label: "Rated", value: episodes.filter(e => e.rating).length },
            {
              label: "Avg Rating",
              value: episodes.filter(e => e.rating).length > 0
                ? (episodes.reduce((s, e) => s + (e.rating ?? 0), 0) / episodes.filter(e => e.rating).length).toFixed(1)
                : "—"
            },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-faint)" }}>{s.label}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: PODCAST_COLOR, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="podcasts-content" style={{ flex: 1, overflowY: "auto", padding: "24px 48px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-faint)" }}>Loading…</div>
        )}

        {!loading && episodes.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-faint)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎙️</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, marginBottom: 8, color: "var(--ink)" }}>No episodes logged yet</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Hit "Log Episode" to add your first one.</div>
            <button onClick={() => setShowModal(true)} style={{ padding: "9px 20px", background: PODCAST_COLOR, color: "white", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>+ Log Episode</button>
          </div>
        )}

        {!loading && showNames.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {showNames.map(showName => {
              const showEps = grouped[showName];
              const isOpen = expandedShow === showName;
              const artwork = showEps[0]?.artwork_url; // most recent episode = most current show art
              const rated = showEps.filter(e => e.rating);
              const avgRating = rated.length > 0
                ? (rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length).toFixed(1)
                : null;

              return (
                <div key={showName} style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "white" }}>
                  {/* Show header */}
                  <div
                    className="show-header"
                    onClick={() => setExpandedShow(isOpen ? null : showName)}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer", transition: "background 0.15s", background: "transparent" }}
                  >
                    {artwork && (
                      <img src={artwork} alt={showName} style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{showName}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
                        {showEps.length} episode{showEps.length !== 1 ? "s" : ""}
                        {avgRating && <span style={{ marginLeft: 10, color: PODCAST_COLOR, fontWeight: 700 }}>★ {avgRating} avg</span>}
                      </div>
                    </div>
                    <span style={{ color: "var(--ink-faint)", fontSize: 12, flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>

                  {/* Episode rows */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border)" }}>
                      {showEps.map((ep, i) => (
                          <div
                            key={ep.id}
                            className="ep-row"
                            style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: i < showEps.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.12s" }}
                          >
                            {ep.artwork_url && (
                              <img src={ep.artwork_url} alt="" style={{ width: 40, height: 40, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, color: "var(--ink)", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ep.episode_title}</div>
                              <div style={{ fontSize: 11, color: "var(--ink-faint)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                                <span>{formatListenedAt(ep.listened_at)}</span>
                                {ep.duration_ms && <span>{formatDuration(ep.duration_ms)}</span>}
                              </div>
                              {ep.notes && (
                                <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 4, fontStyle: "italic" }}>{ep.notes}</div>
                              )}
                            </div>
                            {ep.rating && (
                              <div style={{ flexShrink: 0, background: PODCAST_LIGHT, border: `1px solid ${PODCAST_BORDER}`, borderRadius: 6, padding: "4px 10px", fontSize: 13, fontWeight: 700, color: PODCAST_COLOR, fontFamily: "'Lato', sans-serif" }}>
                                {ep.rating}<span style={{ fontSize: 10, opacity: 0.7 }}>/10</span>
                              </div>
                            )}
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Modal */}
      {showModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 400, fontSize: 22, color: "var(--ink)", margin: "0 0 20px" }}>Log an Episode</h2>

            {/* Search */}
            {!selected && (
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => handleSearchInput(e.target.value)}
                  placeholder="Search for a podcast or episode..."
                  style={{ width: "100%", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "var(--ink)", fontFamily: "'Lato', sans-serif", outline: "none", boxSizing: "border-box" }}
                />
                {searching && (
                  <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--ink-faint)" }}>Searching…</div>
                )}
              </div>
            )}

            {/* Search results */}
            {!selected && searchResults.length > 0 && (
              <div style={{ background: "var(--cream)", borderRadius: 6, overflow: "hidden", marginBottom: 16, border: "1px solid var(--border)", maxHeight: 280, overflowY: "auto" }}>
                {searchResults.map(ep => (
                  <div
                    key={ep.spotify_id}
                    className="result-row"
                    onClick={() => selectEpisode(ep)}
                    style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", transition: "background 0.12s" }}
                  >
                    {ep.artwork_url && <img src={ep.artwork_url} alt="" style={{ width: 40, height: 40, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ep.episode_title}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>{ep.show_name}{ep.duration_ms ? ` · ${formatDuration(ep.duration_ms)}` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected episode */}
            {selected && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", background: PODCAST_LIGHT, border: `1px solid ${PODCAST_BORDER}`, borderRadius: 8, padding: "12px 14px", marginBottom: 20 }}>
                {selected.artwork_url && <img src={selected.artwork_url} alt="" style={{ width: 52, height: 52, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 600, marginBottom: 2 }}>{selected.episode_title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{selected.show_name}{selected.duration_ms ? ` · ${formatDuration(selected.duration_ms)}` : ""}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--ink-faint)", cursor: "pointer", fontSize: 18, padding: 4, flexShrink: 0 }}>✕</button>
              </div>
            )}

            {/* Rating */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 10 }}>Rating</div>
              <div className="rating-grid" style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 6 }}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button
                    key={n}
                    className={`rating-btn${rating === n ? " active" : ""}`}
                    onClick={() => setRating(rating === n ? null : n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 8 }}>Notes</div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any thoughts on this episode? (optional)"
                rows={3}
                style={{ width: "100%", background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "var(--ink)", fontFamily: "'Lato', sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }}
              />
            </div>

            {/* Date */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 8 }}>Date Listened</div>
              <input
                type="date"
                value={listenedAt}
                onChange={e => setListenedAt(e.target.value)}
                style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "var(--ink)", fontFamily: "'Lato', sans-serif", outline: "none" }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={closeModal}
                style={{ padding: "9px 20px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, color: "var(--ink-faint)", cursor: "pointer", fontFamily: "'Lato', sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!selected || saving}
                style={{ padding: "9px 20px", background: selected ? PODCAST_COLOR : "rgba(123,94,167,0.3)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, color: "white", cursor: selected ? "pointer" : "default", fontFamily: "'Lato', sans-serif", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving…" : "Save Episode"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
