"use client";

import { useState, useEffect, useRef } from "react";

type Status = "ideas" | "in-progress" | "review" | "done";
type TagType = "app" | "site" | "blog" | "tool" | "api" | "other";

interface Project {
  id: string;
  title: string;
  description: string;
  status: Status;
  tags: TagType[];
  position: number;
  created_at: string;
}

const COLUMNS: { id: Status; label: string }[] = [
  { id: "ideas", label: "Ideas" },
  { id: "in-progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

const TAG_STYLES: Record<TagType, { bg: string; color: string }> = {
  app:   { bg: "#E6F1FB", color: "#185FA5" },
  site:  { bg: "#EAF3DE", color: "#3B6D11" },
  blog:  { bg: "#FAEEDA", color: "#854F0B" },
  tool:  { bg: "#EEEDFE", color: "#534AB7" },
  api:   { bg: "#FAECE7", color: "#993C1D" },
  other: { bg: "var(--border)", color: "var(--ink-faint)" },
};

const ALL_TAGS: TagType[] = ["app", "site", "blog", "tool", "api", "other"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "add"; status: Status } | { mode: "edit"; project: Project } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => { if (Array.isArray(d)) setProjects(d); }).finally(() => setLoading(false));
  }, []);

  async function handleMove(id: string, newStatus: Status) {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    await fetch("/api/projects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: newStatus }) });
  }

  async function handleSave(data: Omit<Project, "id" | "created_at" | "position">) {
    if (modal?.mode === "edit") {
      const res = await fetch("/api/projects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: modal.project.id, ...data }) });
      const updated = await res.json();
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    } else {
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const created = await res.json();
      setProjects(prev => [...prev, created]);
    }
    setModal(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project?")) return;
    setProjects(prev => prev.filter(p => p.id !== id));
    await fetch("/api/projects", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setModal(null);
  }

  const colProjects = (status: Status) => projects.filter(p => p.status === status);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "var(--warm-white)", flexShrink: 0 }} className="proj-header">
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26 }}>Projects</div>
        <div style={{ fontSize: 13, color: "var(--ink-faint)", fontWeight: 300 }}>Digital ideas · apps · sites · tools</div>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }} className="proj-pad">
        <style>{`
          @media (min-width: 769px) {
            .proj-header { padding: 24px 48px !important; }
            .proj-pad { padding: 28px 48px !important; }
            .proj-board { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
            .proj-status-tag { display: none !important; }
          }
          @media (max-width: 768px) {
            .proj-col-header { display: none !important; }
          }
        `}</style>
        {loading ? (
          <div style={{ color: "var(--ink-faint)", fontFamily: "'Lato', sans-serif" }}>Loading…</div>
        ) : (
          <div className="proj-board" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            {COLUMNS.map(col => (
              <div key={col.id}
                onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => { e.preventDefault(); if (dragId) handleMove(dragId, col.id); setDragId(null); setDragOver(null); }}
                style={{ background: dragOver === col.id ? "rgba(107,66,38,0.04)" : "transparent", borderRadius: 8, transition: "background 0.15s", minHeight: 200 }}>
                {/* Column header */}
                <div className="proj-col-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-faint)", fontFamily: "'Lato', sans-serif" }}>{col.label}</span>
                    <span style={{ fontSize: 11, background: "var(--border)", color: "var(--ink-faint)", borderRadius: 10, padding: "1px 7px", fontFamily: "'Lato', sans-serif" }}>{colProjects(col.id).length}</span>
                  </div>
                </div>

                {/* Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {colProjects(col.id).map(p => (
                      <div key={p.id} draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      onClick={() => setModal({ mode: "edit", project: p })}
                      style={{ background: "var(--warm-white)", border: `1px solid ${dragId === p.id ? "var(--coffee)" : "var(--border)"}`, borderRadius: 8, padding: "12px 14px", cursor: "grab", opacity: dragId === p.id ? 0.5 : 1, transition: "border-color 0.15s, transform 0.15s", fontFamily: "'Lato', sans-serif" }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)"}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = ""}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35 }}>{p.title}</div>
                        <span className="proj-status-tag" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-faint)", background: "var(--border)", borderRadius: 8, padding: "2px 7px", flexShrink: 0, marginLeft: 8 }}>{COLUMNS.find(c => c.id === p.status)?.label}</span>
                      </div>
                      {p.description && <div style={{ fontSize: 12, color: "var(--ink-faint)", lineHeight: 1.45, marginBottom: 8 }}>{p.description}</div>}
                      {p.tags?.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {p.tags.map(tag => (
                            <span key={tag} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 10, background: TAG_STYLES[tag]?.bg ?? "var(--border)", color: TAG_STYLES[tag]?.color ?? "var(--ink-faint)" }}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add button */}
                  <button onClick={() => setModal({ mode: "add", status: col.id })}
                    style={{ width: "100%", background: "none", border: "1px dashed var(--border)", borderRadius: 8, padding: "8px", fontSize: 12, color: "var(--ink-faint)", cursor: "pointer", fontFamily: "'Lato', sans-serif", transition: "border-color 0.15s, color 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ink-faint)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-light)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-faint)"; }}>
                    + add card
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <CardModal
          mode={modal.mode}
          project={modal.mode === "edit" ? modal.project : undefined}
          defaultStatus={modal.mode === "add" ? modal.status : undefined}
          onSave={handleSave}
          onDelete={modal.mode === "edit" ? () => handleDelete(modal.project.id) : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function CardModal({ mode, project, defaultStatus, onSave, onDelete, onClose }: {
  mode: "add" | "edit";
  project?: Project;
  defaultStatus?: Status;
  onSave: (data: Omit<Project, "id" | "created_at" | "position">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<Status>(project?.status ?? defaultStatus ?? "ideas");
  const [tags, setTags] = useState<TagType[]>(project?.tags ?? []);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const toggleTag = (tag: TagType) => setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const inp: React.CSSProperties = { padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, fontFamily: "'Lato', sans-serif", color: "var(--ink)", background: "var(--warm-white)", outline: "none", width: "100%" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div style={{ background: "var(--warm-white)", borderRadius: 8, padding: 32, width: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "'Lato', sans-serif" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, marginBottom: 24 }}>{mode === "add" ? "New Project" : "Edit Project"}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-light)", marginBottom: 5 }}>Title</div>
            <input ref={titleRef} type="text" style={inp} placeholder="e.g. Coffee price tracker" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-light)", marginBottom: 5 }}>Description</div>
            <textarea style={{ ...inp, height: 72, resize: "vertical" }} placeholder="What's the idea?" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-light)", marginBottom: 8 }}>Status</div>
            <div style={{ display: "flex", gap: 6 }}>
              {COLUMNS.map(col => (
                <button key={col.id} onClick={() => setStatus(col.id)}
                  style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${status === col.id ? "var(--coffee)" : "var(--border)"}`, background: status === col.id ? "var(--coffee)" : "transparent", color: status === col.id ? "var(--cream)" : "var(--ink-faint)", fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>
                  {col.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-light)", marginBottom: 8 }}>Tags</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ALL_TAGS.map(tag => {
                const active = tags.includes(tag);
                return (
                  <button key={tag} onClick={() => toggleTag(tag)}
                    style={{ padding: "4px 10px", borderRadius: 10, border: `1px solid ${active ? "transparent" : "var(--border)"}`, background: active ? TAG_STYLES[tag].bg : "transparent", color: active ? TAG_STYLES[tag].color : "var(--ink-faint)", fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif", fontWeight: active ? 700 : 400 }}>
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 24, alignItems: "center" }}>
          <button onClick={() => title.trim() && onSave({ title: title.trim(), description, status, tags })}
            disabled={!title.trim()}
            style={{ padding: "10px 24px", background: "var(--ink)", color: "var(--cream)", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: title.trim() ? "pointer" : "not-allowed", fontFamily: "'Lato', sans-serif", opacity: title.trim() ? 1 : 0.5 }}>
            {mode === "add" ? "Add Project" : "Save"}
          </button>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "transparent", color: "var(--ink-faint)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>Cancel</button>
          {onDelete && <button onClick={onDelete} style={{ marginLeft: "auto", padding: "10px 16px", background: "transparent", color: "var(--terracotta)", border: "1px solid var(--terracotta-light)", borderRadius: 4, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>Delete</button>}
        </div>
      </div>
    </div>
  );
}
