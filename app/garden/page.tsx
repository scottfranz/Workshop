"use client";
import { useState, useEffect } from "react";

interface Harvest {
  id: string; plant: string; bed: number; amount: string;
  unit: string; date: string; notes: string | null;
}

const PLANTS_BY_BED: Record<number, string[]> = {
  1: ["Kale","Daikon","Carrots","Cilantro","Parsley","Swiss Chard","Chives"],
  2: ["Tomatillo","Sungold Cherry Tomatoes","Jalapeños","Basil","Edamame","Honeynut Squash"],
};

const PLANT_EMOJIS: Record<string, string> = {
  "Kale":"🥬","Daikon":"🌿","Carrots":"🥕","Cilantro":"🌿","Parsley":"🌿",
  "Swiss Chard":"🥬","Chives":"🌿","Tomatillo":"🫑","Sungold Cherry Tomatoes":"🍅",
  "Jalapeños":"🌶️","Basil":"🌿","Edamame":"🫘","Honeynut Squash":"🎃",
};

const SEEDS = [
  {name:"Kale",variety:"Lacinato",bed:1,type:"green",directSow:"May 19",harvest:"Jul–Oct",spacing:14,emoji:"🥬"},
  {name:"Daikon",variety:"Daikon",bed:1,type:"root",directSow:"May 19",harvest:"Aug–Sep",spacing:6,emoji:"🌿"},
  {name:"Carrots",variety:"Rainbow Mix",bed:1,type:"root",directSow:"May 19",harvest:"Aug–Sep",spacing:3,emoji:"🥕"},
  {name:"Cilantro",variety:"Calypso",bed:1,type:"herb",directSow:"May 19",harvest:"Jun–Jul",spacing:6,emoji:"🌿"},
  {name:"Parsley",variety:"Dark Green Flat Leaf",bed:1,type:"herb",directSow:"May 19",harvest:"Jul–Oct",spacing:9,emoji:"🌿"},
  {name:"Swiss Chard",variety:"Rainbow",bed:1,type:"green",directSow:"May 19",harvest:"Jul–Oct",spacing:12,emoji:"🥬"},
  {name:"Chives",variety:"Chives",bed:1,type:"herb",directSow:"May 19",harvest:"Jun–Oct",spacing:6,emoji:"🌿"},
  {name:"Tomatillo",variety:"Rio Grande Verde",bed:2,type:"fruiting",directSow:"May 19",harvest:"Aug–Sep",spacing:24,emoji:"🫑"},
  {name:"Sungold Cherry Tomatoes",variety:"Sungold",bed:2,type:"fruiting",directSow:"May 19",harvest:"Jul–Sep",spacing:24,emoji:"🍅"},
  {name:"Jalapeños",variety:"Tam Mild",bed:2,type:"fruiting",directSow:"May 19",harvest:"Aug–Sep",spacing:18,emoji:"🌶️"},
  {name:"Basil",variety:"Genovese",bed:2,type:"herb",directSow:"May 19",harvest:"Jun–Sep",spacing:12,emoji:"🌿"},
  {name:"Edamame",variety:"Midori (Bush)",bed:2,type:"legume",directSow:"May 19",harvest:"Aug",spacing:6,emoji:"🫘"},
  {name:"Honeynut Squash",variety:"Honeynut",bed:2,type:"fruiting",directSow:"May 19",harvest:"Sep–Oct",spacing:36,emoji:"🎃"},
];

const BED_COLORS: Record<number,string> = {1:"var(--slate)",2:"var(--terracotta)"};
const BED_NAMES: Record<number,string> = {1:"Bed 1 — Greens & Roots",2:"Bed 2 — Warm Season"};
const TYPE_COLORS: Record<string,string> = {root:"#8a6b5a",herb:"#7A9E7E",green:"#6b8a6b",fruiting:"#B5622A",legume:"#8a7a5a"};
const UNITS = ["handful","bunch","heads","lbs","oz","cups","pieces","pods","roots","sprigs"];

export default function GardenPage() {
  const [tab, setTab] = useState<"beds"|"harvest">("beds");
  const [selectedBed, setSelectedBed] = useState<number|null>(null);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [logBed, setLogBed] = useState<number|null>(null);
  const [logPlant, setLogPlant] = useState("");
  const [logAmount, setLogAmount] = useState("");
  const [logUnit, setLogUnit] = useState("handful");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [logNotes, setLogNotes] = useState("");
  const [harvestView, setHarvestView] = useState<"summary"|"log">("summary");

  useEffect(() => {
    fetch("/api/garden").then(r => r.json()).then(d => setHarvests(Array.isArray(d) ? d : []));
  }, []);

  async function submitHarvest() {
    const res = await fetch("/api/garden", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({plant:logPlant,bed:logBed,amount:logAmount,unit:logUnit,date:logDate,notes:logNotes||null}) });
    const data = await res.json();
    setHarvests(prev => [data, ...prev]);
    setShowLog(false); setLogBed(null); setLogPlant(""); setLogAmount(""); setLogNotes("");
  }

  const inp = { padding:"9px 12px", border:"1px solid var(--border)", borderRadius:4, fontSize:13, fontFamily:"'Lato', sans-serif", color:"var(--ink)", background:"var(--warm-white)", outline:"none", width:"100%" };

  // Harvest summary: total per plant
  const harvestSummary = harvests.reduce<Record<string,{amount:number,unit:string,bed:number,emoji:string}>>((acc, h) => {
    const key = h.plant;
    if (!acc[key]) acc[key] = {amount:0,unit:h.unit,bed:h.bed,emoji:PLANT_EMOJIS[h.plant]||"🌿"};
    acc[key].amount += parseFloat(h.amount) || 0;
    return acc;
  }, {});

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh" }}>
      {/* Header */}
      <div style={{ padding:"24px 48px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:26 }}>Garden</div>
          <div style={{ fontSize:13, color:"var(--ink-faint)", fontWeight:300 }}>2 beds · Zone 6a · Garden City, MI · Direct sown May 19</div>
        </div>
        <button onClick={() => setShowLog(true)} style={{ padding:"9px 20px", background:"var(--ink)", color:"var(--cream)", border:"none", borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
          + Log Harvest
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ padding:"14px 48px", borderBottom:"1px solid var(--border)", background:"var(--cream)", display:"flex", gap:44, flexShrink:0 }}>
        {[
          {label:"Varieties", value:SEEDS.length},
          {label:"Beds", value:2},
          {label:"Sow date", value:"May 19"},
          {label:"Harvests logged", value:harvests.length},
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--ink-faint)" }}>{s.label}</div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:600, color:"var(--sage)", marginTop:2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ padding:"0 48px", borderBottom:"1px solid var(--border)", display:"flex", flexShrink:0 }}>
        {([{key:"beds",label:"Beds"},{key:"harvest",label:"Harvest Log"}] as const).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelectedBed(null); }} style={{ padding:"13px 20px", fontSize:13, fontFamily:"'Lato', sans-serif", border:"none", borderBottom:tab===t.key?"2px solid var(--sage)":"2px solid transparent", background:"transparent", color:tab===t.key?"var(--sage)":"var(--ink-faint)", fontWeight:tab===t.key?700:400, cursor:"pointer", marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:"auto", padding:"32px 48px" }}>

        {/* Beds list */}
        {tab==="beds" && !selectedBed && [1,2].map(bedNum => (
          <div key={bedNum} onClick={() => setSelectedBed(bedNum)} style={{ border:"1px solid var(--border)", borderRadius:8, marginBottom:16, overflow:"hidden", background:"var(--warm-white)", cursor:"pointer" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor=BED_COLORS[bedNum]}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor="var(--border)"}>
            <div style={{ padding:"16px 22px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:BED_COLORS[bedNum] }} />
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"'Playfair Display', serif", fontSize:17, fontWeight:600 }}>{BED_NAMES[bedNum]}</div>
                <div style={{ fontSize:12, color:"var(--ink-faint)", marginTop:2 }}>4 × 8 ft · {SEEDS.filter(s=>s.bed===bedNum).length} varieties · sown May 19</div>
              </div>
              <div style={{ fontSize:18, color:"var(--ink-faint)" }}>›</div>
            </div>
            <div style={{ padding:"14px 22px", display:"flex", flexWrap:"wrap", gap:8 }}>
              {SEEDS.filter(s=>s.bed===bedNum).map(p => (
                <div key={p.name} style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 10px", borderRadius:20, background:TYPE_COLORS[p.type]+"18", border:`1px solid ${TYPE_COLORS[p.type]}33`, fontSize:12 }}>
                  <span>{p.emoji}</span><span style={{ color:"var(--ink-light)" }}>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Bed detail */}
        {tab==="beds" && selectedBed && (
          <div>
            <button onClick={() => setSelectedBed(null)} style={{ fontSize:13, color:"var(--ink-faint)", background:"transparent", border:"none", cursor:"pointer", marginBottom:20, fontFamily:"'Lato', sans-serif" }}>← Back to beds</button>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, marginBottom:24 }}>{BED_NAMES[selectedBed]}</div>
            {SEEDS.filter(s=>s.bed===selectedBed).map((p,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:16, padding:"13px 16px", borderRadius:8, marginBottom:2, border:"1px solid transparent" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="var(--cream)"; (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.borderColor="transparent"; }}>
                <span style={{ fontSize:22 }}>{p.emoji}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700 }}>{p.name} <span style={{ fontWeight:300, fontSize:12, color:"var(--ink-faint)" }}>— {p.variety}</span></div>
                  <div style={{ fontSize:12, color:"var(--ink-faint)", marginTop:2 }}>
                    Direct sown May 19 · Harvest {p.harvest} · {p.spacing}" spacing
                  </div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:3, background:"rgba(122,158,126,0.15)", color:"var(--sage)" }}>
                  Sown
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Harvest log */}
        {tab==="harvest" && (
          <div>
            <div style={{ display:"flex", gap:0, border:"1px solid var(--border)", borderRadius:6, overflow:"hidden", width:"fit-content", marginBottom:28 }}>
              {([{key:"summary",label:"Summary"},{key:"log",label:"All Entries"}] as const).map(t => (
                <button key={t.key} onClick={() => setHarvestView(t.key)} style={{ padding:"7px 18px", fontSize:13, fontFamily:"'Lato', sans-serif", border:"none", background:harvestView===t.key?"var(--ink)":"var(--warm-white)", color:harvestView===t.key?"var(--cream)":"var(--ink-faint)", fontWeight:harvestView===t.key?700:400, cursor:"pointer" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {harvests.length === 0 && (
              <div style={{ textAlign:"center", padding:"60px 0", color:"var(--ink-faint)" }}>
                <div style={{ fontSize:36, marginBottom:12 }}>🌱</div>
                <div style={{ fontSize:14 }}>No harvests yet — check back in a few weeks!</div>
              </div>
            )}

            {harvests.length > 0 && harvestView==="summary" && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:12 }}>
                {Object.entries(harvestSummary).map(([plant, s]) => (
                  <div key={plant} style={{ border:"1px solid var(--border)", borderRadius:8, padding:"16px 18px", background:"var(--warm-white)" }}>
                    <div style={{ fontSize:24, marginBottom:8 }}>{s.emoji}</div>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>{plant}</div>
                    <div style={{ fontSize:12, color:"var(--ink-faint)" }}>Bed {s.bed}</div>
                    <div style={{ fontSize:18, fontFamily:"'Playfair Display', serif", color:"var(--sage)", marginTop:8 }}>{s.amount} <span style={{ fontSize:12 }}>{s.unit}</span></div>
                  </div>
                ))}
              </div>
            )}

            {harvests.length > 0 && harvestView==="log" && harvests.map(h => (
              <div key={h.id} style={{ display:"flex", alignItems:"center", gap:16, padding:"13px 16px", borderRadius:8, marginBottom:2, border:"1px solid transparent" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="var(--cream)"; (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.borderColor="transparent"; }}>
                <span style={{ fontSize:20 }}>{PLANT_EMOJIS[h.plant]||"🌿"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700 }}>{h.plant}</div>
                  {h.notes && <div style={{ fontSize:12, color:"var(--ink-faint)", fontStyle:"italic", marginTop:2 }}>{h.notes}</div>}
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--sage)" }}>{h.amount} {h.unit}</div>
                  <div style={{ fontSize:11, color:"var(--ink-faint)", marginTop:2 }}>Bed {h.bed} · {h.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Harvest Modal */}
      {showLog && (
        <div style={{ position:"fixed", inset:0, background:"rgba(30,26,20,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }} onClick={() => setShowLog(false)}>
          <div style={{ background:"var(--warm-white)", borderRadius:10, width:480, padding:32, boxShadow:"0 24px 64px rgba(0,0,0,0.28)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, marginBottom:6 }}>🌿 Log a Harvest</div>
            <div style={{ fontSize:13, color:"var(--ink-faint)", marginBottom:24 }}>What did you pull from the garden today?</div>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)", marginBottom:8 }}>Which bed?</div>
                <div style={{ display:"flex", gap:8 }}>
                  {[1,2].map(b => (
                    <button key={b} onClick={() => { setLogBed(b); setLogPlant(""); }} style={{ flex:1, padding:"10px 8px", borderRadius:6, cursor:"pointer", border:`1px solid ${logBed===b?BED_COLORS[b]:"var(--border)"}`, background:logBed===b?BED_COLORS[b]+"18":"var(--warm-white)", fontFamily:"'Lato', sans-serif" }}>
                      <div style={{ fontSize:13, fontWeight:logBed===b?700:400, color:logBed===b?BED_COLORS[b]:"var(--ink-faint)" }}>{BED_NAMES[b]}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)", marginBottom:8 }}>What did you harvest?</div>
                {!logBed ? <div style={{ fontSize:13, color:"var(--ink-faint)", fontStyle:"italic" }}>Select a bed first</div> : (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                    {PLANTS_BY_BED[logBed].map(p => (
                      <button key={p} onClick={() => setLogPlant(logPlant===p?"":p)} style={{ padding:"6px 12px", borderRadius:20, cursor:"pointer", fontSize:12, border:`1px solid ${logPlant===p?BED_COLORS[logBed]:"var(--border)"}`, background:logPlant===p?BED_COLORS[logBed]+"18":"var(--warm-white)", color:logPlant===p?BED_COLORS[logBed]:"var(--ink-faint)", fontWeight:logPlant===p?700:400, fontFamily:"'Lato', sans-serif" }}>
                        {PLANT_EMOJIS[p]} {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)", marginBottom:8 }}>How much?</div>
                <div style={{ display:"flex", gap:8 }}>
                  <input type="text" placeholder="e.g. 2" style={{ ...inp, width:80 }} value={logAmount} onChange={e => setLogAmount(e.target.value)} />
                  <select value={logUnit} onChange={e => setLogUnit(e.target.value)} style={{ ...inp, flex:1 }}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)", marginBottom:8 }}>Date</div>
                <input type="date" style={inp} value={logDate} onChange={e => setLogDate(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)", marginBottom:8 }}>Notes <span style={{ fontWeight:300, color:"var(--ink-faint)" }}>(optional)</span></div>
                <textarea rows={2} style={{ ...inp, resize:"vertical" }} value={logNotes} onChange={e => setLogNotes(e.target.value)} placeholder="How did it look?" />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={submitHarvest} disabled={!logBed||!logPlant||!logAmount} style={{ padding:"10px 28px", background:logBed&&logPlant&&logAmount?"var(--ink)":"var(--border)", color:logBed&&logPlant&&logAmount?"var(--cream)":"var(--ink-faint)", border:"none", borderRadius:4, fontSize:13, fontWeight:700, cursor:logBed&&logPlant&&logAmount?"pointer":"default", fontFamily:"'Lato', sans-serif" }}>
                  Log Harvest →
                </button>
                <button onClick={() => setShowLog(false)} style={{ padding:"10px 18px", background:"transparent", color:"var(--ink-faint)", border:"1px solid var(--border)", borderRadius:4, fontSize:13, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
