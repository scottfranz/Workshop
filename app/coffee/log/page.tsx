"use client";

import { useState } from "react";

const ROAST_LEVELS = ["Light", "Light Medium", "Medium Light", "Medium", "Medium Dark", "Dark"];
const PROCESSES = [
  "Washed", "Natural", "Honey", "Anaerobic Natural", "Anaerobic Washed",
  "Carbonic Maceration Washed", "Thermal Shock", "Washed Thermal Shock",
  "Honey Process", "Double Washed", "White Honey Washed", "Yellow Honey",
  "EA Sugarcane Decaf", "Natural EA Decaf", "Other",
];

const empty = {
  rating: "", roastDate: "", openedDate: "", roaster: "", name: "",
  country: "", region: "", producer: "", farm: "", harvestDate: "",
  variety: "", altitude: "", process: "", cleanFunk: "", roastLevel: "",
  development: "", roasterNotes: "", myNotes: "", weight: "", price: "",
};

type Field = keyof typeof empty;

const fieldLabel: Record<Field, string> = {
  rating: "My Rating", roastDate: "Roast Date", openedDate: "Opened Bag Date",
  roaster: "Roaster", name: "Coffee Name", country: "Country", region: "Region",
  producer: "Producer", farm: "Farm / Washing Station", harvestDate: "Harvest Date",
  variety: "Variety", altitude: "Altitude (masl)", process: "Process",
  cleanFunk: "Clean → Funk (1–10)", roastLevel: "Roast Level",
  development: "Development (1–10)", roasterNotes: "Roaster Notes",
  myNotes: "My Notes", weight: "Weight (g)", price: "Price Paid ($)",
};

const SECTIONS = [
  { title: "The Bag",     fields: ["rating", "roaster", "name", "roastDate", "openedDate", "weight", "price"] as Field[] },
  { title: "Origin",      fields: ["country", "region", "producer", "farm", "harvestDate", "variety", "altitude"] as Field[] },
  { title: "Roast",       fields: ["process", "roastLevel", "development", "cleanFunk"] as Field[] },
  { title: "Tasting",     fields: ["roasterNotes", "myNotes"] as Field[] },
];

export default function BagLogPage() {
  const [form, setForm] = useState({ ...empty });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set = (field: Field, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const pricePerCup =
    form.weight && form.price && parseFloat(form.weight) > 0
      ? ((parseFloat(form.price) / parseFloat(form.weight)) * 15).toFixed(2)
      : null;

  async function handleSubmit() {
    if (!form.roaster || !form.name) {
      setErrorMsg("Roaster and coffee name are required.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/bags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");
      setStatus("success");
      setForm({ ...empty });
    } catch (err) {
      setErrorMsg(String(err));
      setStatus("error");
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 4,
    fontSize: 13, fontFamily: "'Lato', sans-serif", color: "var(--ink)",
    background: "var(--warm-white)", outline: "none", width: "100%",
  };

  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: "none", cursor: "pointer" };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle, resize: "vertical", minHeight: 72,
  };

  return (
    <div>
      {/* Top bar */}
      <div style={{ padding: "24px 48px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--warm-white)", zIndex: 10 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26 }}>Log a Bag</div>
        <div style={{ fontSize: 13, color: "var(--ink-faint)", fontWeight: 300 }}>Record a new coffee — goes straight to your Google Sheet</div>
      </div>

      <div style={{ padding: "40px 48px", maxWidth: 860 }}>

        {status === "success" && (
          <div style={{ background: "rgba(122,158,126,0.1)", border: "1px solid var(--sage-light)", borderRadius: 6, padding: "14px 20px", fontSize: 14, color: "var(--sage)", fontWeight: 700, marginBottom: 32 }}>
            ✓ Logged successfully — it&apos;s in your spreadsheet.{" "}
            <span style={{ textDecoration: "underline", cursor: "pointer", fontWeight: 400 }} onClick={() => setStatus("idle")}>Log another</span>
          </div>
        )}

        {status === "error" && (
          <div style={{ background: "rgba(181,98,42,0.08)", border: "1px solid var(--terracotta-light)", borderRadius: 6, padding: "14px 20px", fontSize: 13, color: "var(--terracotta)", marginBottom: 32 }}>
            ⚠ {errorMsg}
          </div>
        )}

        {SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: 36 }}>
            {/* Section header */}
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
              {section.title}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px 24px" }}>
              {section.fields.map((field) => {
                const fullWidth = ["roasterNotes", "myNotes", "name"].includes(field);
                const wrapStyle: React.CSSProperties = fullWidth ? { gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 5 } : { display: "flex", flexDirection: "column", gap: 5 };
                const lbl = <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-light)", letterSpacing: "0.03em" }}>{fieldLabel[field]}</div>;

                // Rating — simple number input
                if (field === "rating") {
                  return (
                    <div key={field} style={wrapStyle}>{lbl}
                      <input type="number" min={0} max={10} step={0.1} style={inputStyle} placeholder="0.0 – 10.0" value={form[field]} onChange={(e) => set("rating", e.target.value)} />
                    </div>
                  );
                }

                // Sliders
                if (field === "cleanFunk" || field === "development") {
                  const isCleanFunk = field === "cleanFunk";
                  return (
                    <div key={field} style={wrapStyle}>
                      {lbl}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>{isCleanFunk ? "1 Clean" : "1 Under"}</span>
                        <input type="range" min={1} max={10} step={1} value={form[field] || 5} onChange={(e) => set(field, e.target.value)} style={{ flex: 1, accentColor: "var(--coffee)" }} />
                        <span style={{ fontSize: 11, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>{isCleanFunk ? "10 Funk" : "10 Dark"}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--coffee)", minWidth: 22, textAlign: "center" }}>{form[field] || "–"}</span>
                      </div>
                    </div>
                  );
                }

                // Selects
                if (field === "roastLevel") {
                  return (
                    <div key={field} style={wrapStyle}>{lbl}
                      <select style={selectStyle} value={form[field]} onChange={(e) => set(field, e.target.value)}>
                        <option value="">Select…</option>
                        {ROAST_LEVELS.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                  );
                }

                if (field === "process") {
                  return (
                    <div key={field} style={wrapStyle}>{lbl}
                      <select style={selectStyle} value={form[field]} onChange={(e) => set(field, e.target.value)}>
                        <option value="">Select…</option>
                        {PROCESSES.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                  );
                }

                // Textareas
                if (field === "roasterNotes" || field === "myNotes") {
                  return (
                    <div key={field} style={wrapStyle}>{lbl}
                      <textarea style={textareaStyle} placeholder={field === "roasterNotes" ? "e.g. Blueberry, Jasmine, Brown Sugar" : "Your impressions…"} value={form[field]} onChange={(e) => set(field, e.target.value)} />
                    </div>
                  );
                }

                // Price — with live price-per-cup preview
                if (field === "price") {
                  return (
                    <div key={field} style={wrapStyle}>{lbl}
                      <input type="number" min={0} step={0.01} style={inputStyle} placeholder="0.00" value={form[field]} onChange={(e) => set(field, e.target.value)} />
                      {pricePerCup && <div style={{ fontSize: 12, color: "var(--ink-faint)", fontStyle: "italic" }}>≈ ${pricePerCup} per cup</div>}
                    </div>
                  );
                }

                // Dates
                if (field === "roastDate" || field === "openedDate") {
                  return (
                    <div key={field} style={wrapStyle}>{lbl}
                      <input type="date" style={inputStyle} value={form[field]} onChange={(e) => set(field, e.target.value)} />
                    </div>
                  );
                }

                // Numbers
                if (field === "weight" || field === "altitude") {
                  return (
                    <div key={field} style={wrapStyle}>{lbl}
                      <input type="number" min={0} style={inputStyle} value={form[field]} onChange={(e) => set(field, e.target.value)} />
                    </div>
                  );
                }

                // Default text
                return (
                  <div key={field} style={wrapStyle}>{lbl}
                    <input type="text" style={inputStyle} value={form[field]} onChange={(e) => set(field, e.target.value)} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
          <button onClick={handleSubmit} disabled={status === "loading"} style={{ padding: "11px 32px", background: "var(--ink)", color: "var(--cream)", border: "none", borderRadius: 4, fontSize: 14, fontFamily: "'Lato', sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em" }}>
            {status === "loading" ? "Saving…" : "Log Bag →"}
          </button>
          <button onClick={() => { setForm({ ...empty }); setStatus("idle"); }} style={{ padding: "11px 20px", background: "transparent", color: "var(--ink-faint)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, fontFamily: "'Lato', sans-serif", cursor: "pointer" }}>
            Clear
          </button>
          {pricePerCup && (
            <span style={{ fontSize: 12, color: "var(--ink-faint)", marginLeft: "auto" }}>
              Price per cup: <strong style={{ color: "var(--ink)" }}>${pricePerCup}</strong>
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
