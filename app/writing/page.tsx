"use client";
import { useState, useEffect, useRef, useCallback } from "react";

interface Entry {
  id: string; title: string; body: string; type: "journal"|"draft"|"note";
  is_public: boolean; created_at: string; word_count: number;
}

const TYPE_META = {
  journal:{ label:"Journal", color:"var(--terracotta)", bg:"rgba(181,98,42,0.1)", icon:"📓" },
  draft:{ label:"Draft", color:"var(--slate)", bg:"rgba(91,127,166,0.1)", icon:"📄" },
  note:{ label:"Note", color:"var(--sage)", bg:"rgba(122,158,126,0.1)", icon:"✏️" },
};

function wc(text: string) { return text.trim().split(/\s+/).filter(Boolean).length; }

type SaveStatus = "idle" | "saving" | "saved";

export default function WritingPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list"|"read"|"write">("list");
  const [selected, setSelected] = useState<Entry|null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<"journal"|"draft"|"note">("journal");
  const [isPublic, setIsPublic] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Refs so the autosave callback always sees latest values
  const selectedRef = useRef<Entry|null>(null);
  const titleRef = useRef("");
  const bodyRef = useRef("");
  const typeRef = useRef<"journal"|"draft"|"note">("journal");
  const isPublicRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIdRef = useRef<string|null>(null); // tracks id after first autosave of a new entry

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { bodyRef.current = body; }, [body]);
  useEffect(() => { typeRef.current = type; }, [type]);
  useEffect(() => { isPublicRef.current = isPublic; }, [isPublic]);

  useEffect(() => {
    fetch("/api/writing").then(r => r.json()).then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  // Core save — does not navigate; returns the saved entry
  const doSave = useCallback(async (): Promise<Entry | null> => {
    const t = titleRef.current;
    const b = bodyRef.current;
    if (!t && !b) return null;

    const payload = { title: t, body: b, type: typeRef.current, is_public: isPublicRef.current, word_count: wc(b) };

    // Determine which id to update: existing entry, or an id created by a prior autosave
    const existingId = selectedRef.current?.id ?? savedIdRef.current;

    if (existingId) {
      const res = await fetch("/api/writing", { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id: existingId, ...payload }) });
      const data = await res.json();
      setEntries(prev => prev.map(e => e.id === existingId ? data : e));
      return data;
    } else {
      const res = await fetch("/api/writing", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      const data = await res.json();
      savedIdRef.current = data.id; // remember for subsequent autosaves
      setEntries(prev => [data, ...prev]);
      return data;
    }
  }, []);

  // Autosave: debounce 1.5s after any content change while in write view
  useEffect(() => {
    if (view !== "write") return;
    if (!title && !body) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      await doSave();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 1500);

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [title, body, type, isPublic, view, doSave]);

  // Cancel: flush any pending save then go back
  async function handleCancel() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if ((title || body)) {
      setSaveStatus("saving");
      await doSave();
    }
    setView("list"); setSelected(null); setTitle(""); setBody("");
    savedIdRef.current = null;
    setSaveStatus("idle");
  }

  function openEditor(entry?: Entry) {
    savedIdRef.current = null;
    if (entry) { setSelected(entry); setTitle(entry.title); setBody(entry.body); setType(entry.type); setIsPublic(entry.is_public); }
    else { setSelected(null); setTitle(""); setBody(""); setType("journal"); setIsPublic(false); }
    setSaveStatus("idle");
    setView("write");
  }

  const filtered = entries.filter(e => typeFilter === "all" || e.type === typeFilter);

  const statusLabel =
    saveStatus === "saving" ? "Saving…" :
    saveStatus === "saved"  ? "✓ Saved" :
    "";

  if (view === "write") return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh" }}>
      <style>{`
        .write-toolbar { padding: 10px 48px; gap: 10px; }
        .write-toolbar-row2 { display: flex; align-items: center; gap: 10px; }
        @media (max-width: 600px) {
          .write-toolbar { padding: 10px 16px !important; flex-wrap: wrap; }
          .write-toolbar-row2 { width: 100%; }
        }
      `}</style>
      <div className="write-toolbar" style={{ borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", flexShrink:0 }}>
        {/* Row 1: type selector + public toggle */}
        <div style={{ display:"flex", border:"1px solid var(--border)", borderRadius:6, overflow:"hidden" }}>
          {Object.entries(TYPE_META).map(([key,meta]) => (
            <button key={key} onClick={() => setType(key as any)} style={{ padding:"8px 14px", fontSize:12, fontFamily:"'Lato', sans-serif", border:"none", background:type===key?"var(--ink)":"var(--warm-white)", color:type===key?"var(--cream)":"var(--ink-faint)", fontWeight:type===key?700:400, cursor:"pointer" }}>
              {meta.icon} {meta.label}
            </button>
          ))}
        </div>
        <button onClick={() => setIsPublic(!isPublic)} style={{ padding:"8px 14px", border:"1px solid var(--border)", borderRadius:6, background:"var(--warm-white)", cursor:"pointer", fontSize:12, fontFamily:"'Lato', sans-serif", color:isPublic?"var(--gold)":"var(--ink-faint)", fontWeight:isPublic?700:400, whiteSpace:"nowrap" }}>
          {isPublic ? "🔓 Public" : "🔒 Private"}
        </button>
        {/* Row 2 (same row on desktop, wraps on mobile): spacer + word count + status + back */}
        <div className="write-toolbar-row2" style={{ flex:1, justifyContent:"flex-end" }}>
          <div style={{ fontSize:12, color:"var(--ink-faint)" }}>{wc(body)} words</div>
          <div style={{ fontSize:12, color: saveStatus === "saved" ? "var(--sage)" : "var(--ink-faint)", minWidth:56, textAlign:"right", transition:"color 0.2s" }}>
            {statusLabel}
          </div>
          <button onClick={handleCancel} style={{ padding:"7px 16px", background:"transparent", border:"1px solid var(--border)", borderRadius:4, fontSize:13, cursor:"pointer", fontFamily:"'Lato', sans-serif", color:"var(--ink-faint)", whiteSpace:"nowrap" }}>← Back</button>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"32px clamp(16px, 5vw, 48px) 48px" }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={{ width:"100%", fontFamily:"'Playfair Display', serif", fontSize:28, fontWeight:600, border:"none", outline:"none", background:"transparent", color:"var(--ink)", marginBottom:8 }} />
        <div style={{ fontSize:12, color:"var(--ink-faint)", marginBottom:20 }}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
        <div style={{ height:1, background:"var(--border)", marginBottom:24 }} />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Start writing…" style={{ width:"100%", minHeight:320, fontFamily:"'Lato', sans-serif", fontSize:15, lineHeight:1.85, border:"none", outline:"none", background:"transparent", color:"var(--ink-light)", resize:"none" }} />
      </div>
    </div>
  );

  if (view === "read" && selected) return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh" }}>
      <div style={{ padding:"16px 48px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        <button onClick={() => { setView("list"); setSelected(null); }} style={{ fontSize:13, color:"var(--ink-faint)", background:"transparent", border:"none", cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>← Back</button>
        <div style={{ flex:1 }} />
        <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:3, background:TYPE_META[selected.type].bg, color:TYPE_META[selected.type].color }}>{TYPE_META[selected.type].label}</span>
        <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:3, background:selected.is_public?"rgba(201,150,58,0.12)":"rgba(140,128,112,0.1)", color:selected.is_public?"var(--gold)":"var(--ink-faint)" }}>{selected.is_public?"Public":"Private"}</span>
        <button onClick={() => openEditor(selected)} style={{ padding:"6px 16px", background:"transparent", border:"1px solid var(--border)", borderRadius:4, fontSize:12, cursor:"pointer", fontFamily:"'Lato', sans-serif", color:"var(--ink-faint)" }}>Edit</button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"36px 48px" }}>
        <div style={{ maxWidth:680 }}>
          <div style={{ fontSize:12, color:"var(--ink-faint)", marginBottom:12 }}>
            {new Date(selected.created_at).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
            <span style={{ marginLeft:12 }}>{selected.word_count} words</span>
          </div>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:28, fontWeight:600, lineHeight:1.25, marginBottom:28 }}>{selected.title}</div>
          <div style={{ fontSize:15, lineHeight:1.85, color:"var(--ink-light)", whiteSpace:"pre-line" }}>{selected.body}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh" }}>
      <div style={{ padding:"24px 48px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:26 }}>Writing</div>
          <div style={{ fontSize:13, color:"var(--ink-faint)", fontWeight:300 }}>Journal · Drafts · Notes</div>
        </div>
        <button onClick={() => openEditor()} style={{ padding:"9px 20px", background:"var(--ink)", color:"var(--cream)", border:"none", borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>+ New Entry</button>
      </div>
      <div style={{ padding:"14px 48px", borderBottom:"1px solid var(--border)", background:"var(--cream)", display:"flex", gap:44, flexShrink:0 }}>
        {[{label:"Total entries",value:entries.length},{label:"Total words",value:entries.reduce((s,e)=>s+e.word_count,0).toLocaleString()},{label:"Drafts",value:entries.filter(e=>e.type==="draft").length},{label:"Public",value:entries.filter(e=>e.is_public).length}].map(s=>(
          <div key={s.label}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--ink-faint)" }}>{s.label}</div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:600, color:"var(--terracotta)", marginTop:2 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ padding:"12px 48px", borderBottom:"1px solid var(--border)", display:"flex", gap:8, flexShrink:0 }}>
        {[{key:"all",label:"All"},{key:"journal",label:"📓 Journals"},{key:"draft",label:"📄 Drafts"},{key:"note",label:"✏️ Notes"}].map(f=>(
          <button key={f.key} onClick={() => setTypeFilter(f.key)} style={{ padding:"5px 14px", borderRadius:20, border:`1px solid ${typeFilter===f.key?"var(--terracotta)":"var(--border)"}`, background:typeFilter===f.key?"var(--terracotta-light)":"transparent", color:typeFilter===f.key?"var(--terracotta)":"var(--ink-faint)", fontSize:12, fontWeight:typeFilter===f.key?700:400, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
            {f.label}
          </button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"24px 48px" }}>
        {loading && <div style={{ textAlign:"center", padding:"60px 0", color:"var(--ink-faint)" }}>Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0", color:"var(--ink-faint)" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>✍︎</div>
            <div style={{ fontSize:14, marginBottom:16 }}>Nothing here yet.</div>
            <button onClick={() => openEditor()} style={{ padding:"9px 20px", background:"var(--ink)", color:"var(--cream)", border:"none", borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>Write something</button>
          </div>
        )}
        {!loading && filtered.map(entry => (
          <div key={entry.id} onClick={() => { setSelected(entry); setView("read"); }}
            style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 18px", borderRadius:8, border:"1px solid transparent", cursor:"pointer", marginBottom:2, transition:"all 0.12s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="var(--cream)"; (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.borderColor="transparent"; }}>
            <div style={{ width:36, height:36, borderRadius:8, background:TYPE_META[entry.type].bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
              {TYPE_META[entry.type].icon}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:16, fontWeight:600, marginBottom:3 }}>{entry.title}</div>
              <div style={{ fontSize:12, color:"var(--ink-faint)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{entry.body?.replace(/\n/g," ").substring(0,100)}…</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
              <div style={{ display:"flex", gap:6 }}>
                <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:3, background:TYPE_META[entry.type].bg, color:TYPE_META[entry.type].color }}>{TYPE_META[entry.type].label}</span>
                <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:3, background:entry.is_public?"rgba(201,150,58,0.12)":"rgba(140,128,112,0.1)", color:entry.is_public?"var(--gold)":"var(--ink-faint)" }}>{entry.is_public?"Public":"Private"}</span>
              </div>
              <div style={{ fontSize:11, color:"var(--ink-faint)" }}>
                {new Date(entry.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                <span style={{ marginLeft:8 }}>{entry.word_count} words</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
