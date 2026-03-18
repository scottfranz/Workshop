"use client";
import { useState, useEffect } from "react";

interface Harvest {
  id: string; plant: string; bed: number; amount: string;
  unit: string; date: string; notes: string | null;
}

const PLANTS_BY_BED: Record<number, string[]> = {
  1: ["Brussels Sprouts","Broccoli","Cabbage","Kale","Daikon Radish","Rainbow Carrots","Cilantro","Parsley","Chives"],
  2: ["Snapdragon","California Poppy","Swiss Chard","Rainbow Carrots","Daikon Radish","Cilantro","Parsley","Chives"],
  3: ["Tomatillo","Cucumber","Jalapeño","Basil","Edamame","Honeynut Squash"],
};

const PLANT_EMOJIS: Record<string, string> = {
  "Brussels Sprouts":"🥦","Broccoli":"🥦","Cabbage":"🥬","Kale":"🥬",
  "Daikon Radish":"🌿","Rainbow Carrots":"🥕","Cilantro":"🌿","Parsley":"🌿",
  "Chives":"🌿","Snapdragon":"🌸","California Poppy":"🌼","Swiss Chard":"🥬",
  "Tomatillo":"🫑","Cucumber":"🥒","Jalapeño":"🌶️","Basil":"🌿",
  "Edamame":"🫘","Honeynut Squash":"🎃",
};

const SEEDS = [
  {name:"Brussels Sprouts",variety:"Catskill",bed:1,type:"brassica",indoorStart:"Mar 10",transplant:"Apr 25",harvest:"Oct",spacing:24,status:"not_started",emoji:"🥦"},
  {name:"Broccoli",variety:"Waltham 29",bed:1,type:"brassica",indoorStart:"Mar 1",transplant:"Apr 10",harvest:"Jun–Jul",spacing:18,status:"not_started",emoji:"🥦"},
  {name:"Cabbage",variety:"Copenhagen Market",bed:1,type:"brassica",indoorStart:"Mar 1",transplant:"Apr 10",harvest:"Jul",spacing:18,status:"not_started",emoji:"🥬"},
  {name:"Kale",variety:"Lacinato",bed:1,type:"brassica",indoorStart:"Mar 10",transplant:"Apr 15",harvest:"Jun–Oct",spacing:14,status:"not_started",emoji:"🥬"},
  {name:"Daikon Radish",variety:"Daikon",bed:1,type:"root",directSow:"Apr 1",harvest:"May–Jun",spacing:6,status:"not_started",emoji:"🌿"},
  {name:"Rainbow Carrots",variety:"Rainbow Mix",bed:1,type:"root",directSow:"Apr 1",harvest:"Jun–Jul",spacing:3,status:"not_started",emoji:"🥕"},
  {name:"Cilantro",variety:"Calypso",bed:1,type:"herb",directSow:"Apr 1",harvest:"May–Jun",spacing:6,status:"not_started",emoji:"🌿"},
  {name:"Parsley",variety:"Dark Green Flat Leaf",bed:1,type:"herb",indoorStart:"Feb 10",transplant:"Apr 20",harvest:"Jun–Oct",spacing:9,status:"started",emoji:"🌿"},
  {name:"Chives",variety:"Chives",bed:1,type:"herb",directSow:"Apr 1",harvest:"May–Oct",spacing:6,status:"not_started",emoji:"🌿"},
  {name:"Snapdragon",variety:"Appleblossom",bed:2,type:"flower",indoorStart:"Feb 15",transplant:"Apr 25",harvest:"Jun–Sep",spacing:9,status:"started",emoji:"🌸"},
  {name:"California Poppy",variety:"California Poppy",bed:2,type:"flower",directSow:"Mar 25",harvest:"May–Aug",spacing:6,status:"not_started",emoji:"🌼"},
  {name:"Swiss Chard",variety:"Rainbow",bed:2,type:"green",directSow:"Apr 5",harvest:"Jun–Oct",spacing:12,status:"not_started",emoji:"🥬"},
  {name:"Rainbow Carrots",variety:"Rainbow Mix",bed:2,type:"root",directSow:"Apr 1",harvest:"Jun–Jul",spacing:3,status:"not_started",emoji:"🥕"},
  {name:"Daikon Radish",variety:"Daikon",bed:2,type:"root",directSow:"Apr 1",harvest:"May–Jun",spacing:6,status:"not_started",emoji:"🌿"},
  {name:"Tomatillo",variety:"Rio Grande Verde",bed:3,type:"fruiting",indoorStart:"Feb 10",transplant:"May 15",harvest:"Aug–Sep",spacing:24,status:"started",emoji:"🫑"},
  {name:"Cucumber",variety:"Muncher",bed:3,type:"fruiting",directSow:"May 15",harvest:"Jul–Sep",spacing:12,status:"not_started",emoji:"🥒"},
  {name:"Jalapeño",variety:"Tam Mild",bed:3,type:"fruiting",indoorStart:"Feb 5",transplant:"May 15",harvest:"Aug–Sep",spacing:18,status:"started",emoji:"🌶️"},
  {name:"Basil",variety:"Genovese",bed:3,type:"herb",indoorStart:"Mar 25",transplant:"May 15",harvest:"Jun–Sep",spacing:12,status:"not_started",emoji:"🌿"},
  {name:"Edamame",variety:"Midori (Bush)",bed:3,type:"legume",directSow:"May 15",harvest:"Aug",spacing:6,status:"not_started",emoji:"🫘"},
  {name:"Honeynut Squash",variety:"Honeynut",bed:3,type:"fruiting",directSow:"May 15",harvest:"Sep–Oct",spacing:36,status:"not_started",emoji:"🎃"},
];

const BED_COLORS: Record<number,string> = {1:"var(--slate)",2:"var(--sage)",3:"var(--terracotta)"};
const BED_NAMES: Record<number,string> = {1:"Bed 1 — Brassica (Netted)",2:"Bed 2 — Cool Season",3:"Bed 3 — Warm Season"};
const TYPE_COLORS: Record<string,string> = {brassica:"#5B7FA6",root:"#8a6b5a",herb:"#7A9E7E",flower:"#c4748a",green:"#6b8a6b",fruiting:"#B5622A",legume:"#8a7a5a"};
const UNITS = ["handful","bunch","heads","lbs","oz","cups","pieces","pods","roots","sprigs"];

const TIMELINE = [
  {month:"Feb",label:"Start indoors",items:["Jalapeño","Tomatillo","Parsley","Snapdragon"],color:"var(--slate)"},
  {month:"Mar 1–10",label:"Start indoors",items:["Broccoli","Cabbage","Brussels Sprouts","Kale"],color:"var(--slate)"},
  {month:"Mar 25",label:"Start indoors",items:["Basil"],color:"var(--slate)"},
  {month:"Mar 25–Apr 1",label:"Direct sow outdoors",items:["California Poppy","Cilantro (sow 1)"],color:"var(--sage)"},
  {month:"Apr 1–10",label:"Direct sow outdoors",items:["Rainbow Carrots","Daikon Radish","Swiss Chard","Chives","Cilantro (sow 2)"],color:"var(--sage)"},
  {month:"Apr 10–15",label:"Transplant outdoors",items:["Broccoli","Cabbage","Kale"],color:"var(--terracotta)"},
  {month:"Apr 20 ⚠️",label:"Last frost date",items:["Safe to transplant cold-tolerant crops"],color:"var(--gold)"},
  {month:"Apr 25",label:"Transplant outdoors",items:["Brussels Sprouts","Parsley","Snapdragon"],color:"var(--terracotta)"},
  {month:"May 15",label:"Transplant warm crops",items:["Jalapeño","Tomatillo","Basil"],color:"var(--terracotta)"},
  {month:"May 15",label:"Direct sow outdoors",items:["Cucumber","Edamame","Honeynut Squash"],color:"var(--sage)"},
  {month:"Jun–Jul",label:"First harvests",items:["Radish","Cilantro","Broccoli","Carrots","Swiss Chard"],color:"var(--gold)"},
  {month:"Aug–Sep",label:"Main harvest",items:["Jalapeño","Tomatillo","Cucumber","Edamame","Basil"],color:"var(--gold)"},
  {month:"Sep–Oct",label:"Fall harvest",items:["Honeynut Squash","Brussels Sprouts"],color:"var(--gold)"},
];

export default function GardenPage() {
  const [tab, setTab] = useState<"beds"|"calendar"|"harvest">("beds");
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

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh" }}>
      <div style={{ padding:"24px 48px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:26 }}>Garden</div>
          <div style={{ fontSize:13, color:"var(--ink-faint)", fontWeight:300 }}>3 beds · Zone 6a · Ann Arbor, MI · Last frost ~Apr 20</div>
        </div>
        <button onClick={() => setShowLog(true)} style={{ padding:"9px 20px", background:"var(--ink)", color:"var(--cream)", border:"none", borderRadius:4, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Lato', sans-serif" }}>
          + Log Harvest
        </button>
      </div>

      <div style={{ padding:"14px 48px", borderBottom:"1px solid var(--border)", background:"var(--cream)", display:"flex", gap:44, flexShrink:0 }}>
        {[{label:"Varieties",value:18},{label:"Beds",value:3},{label:"Started indoors",value:SEEDS.filter(s=>s.status==="started").length},{label:"Days to last frost",value:"~47"},{label:"Harvests logged",value:harvests.length}].map(s=>(
          <div key={s.label}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--ink-faint)" }}>{s.label}</div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:600, color:"var(--sage)", marginTop:2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding:"0 48px", borderBottom:"1px solid var(--border)", display:"flex", flexShrink:0 }}>
        {([{key:"beds",label:"Beds"},{key:"calendar",label:"Planting Calendar"},{key:"harvest",label:"Harvest Log"}] as const).map(t=>(
          <button key={t.key} onClick={() => { setTab(t.key); setSelectedBed(null); }} style={{ padding:"13px 20px", fontSize:13, fontFamily:"'Lato', sans-serif", border:"none", borderBottom:tab===t.key?"2px solid var(--sage)":"2px solid transparent", background:"transparent", color:tab===t.key?"var(--sage)":"var(--ink-faint)", fontWeight:tab===t.key?700:400, cursor:"pointer", marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"32px 48px" }}>

        {tab==="beds" && !selectedBed && [1,2,3].map(bedNum => (
          <div key={bedNum} onClick={() => setSelectedBed(bedNum)} style={{ border:"1px solid var(--border)", borderRadius:8, marginBottom:16, overflow:"hidden", background:"var(--warm-white)", cursor:"pointer" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor=BED_COLORS[bedNum]}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor="var(--border)"}>
            <div style={{ padding:"16px 22px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:BED_COLORS[bedNum] }} />
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"'Playfair Display', serif", fontSize:17, fontWeight:600 }}>{BED_NAMES[bedNum]}</div>
                <div style={{ fontSize:12, color:"var(--ink-faint)", marginTop:2 }}>4 × 8 ft · {SEEDS.filter(s=>s.bed===bedNum).length} varieties</div>
              </div>
              <div style={{ fontSize:18, color:"var(--ink-faint)" }}>›</div>
            </div>
            <div style={{ padding:"14px 22px", display:"flex", flexWrap:"wrap", gap:8 }}>
              {SEEDS.filter(s=>s.bed===bedNum).map(p => (
                <div key={p.name+p.variety} style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 10px", borderRadius:20, background:TYPE_COLORS[p.type]+"18", border:`1px solid ${TYPE_COLORS[p.type]}33`, fontSize:12 }}>
                  <span>{p.emoji}</span><span style={{ color:"var(--ink-light)" }}>{p.name}</span>
                  {p.status==="started" && <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--slate)" }} />}
                </div>
              ))}
            </div>
          </div>
        ))}

        {tab==="beds" && selectedBed && (
          <div>
            <button onClick={() => setSelectedBed(null)} style={{ fontSize:13, color:"var(--ink-faint)", background:"transparent", border:"none", cursor:"pointer", marginBottom:20, fontFamily:"'Lato', sans-serif" }}>← Back to beds</button>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, marginBottom:24 }}>{BED_NAMES[selectedBed]}</div>
            {SEEDS.filter(s=>s.bed===selectedBed).map((p,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:16, padding:"13px 16px", borderRadius:8, marginBottom:2, border:"1px solid transparent", cursor:"pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="var(--cream)"; (e.currentTarget as HTMLElement).style.borderColor="var(--border)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.borderColor="transparent"; }}>
                <span style={{ fontSize:22 }}>{p.emoji}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700 }}>{p.name} <span style={{ fontWeight:300, fontSize:12, color:"var(--ink-faint)" }}>— {p.variety}</span></div>
                  <div style={{ fontSize:12, color:"var(--ink-faint)", marginTop:2 }}>
                    {(p as any).indoorStart ? `Start indoors ${(p as any).indoorStart} · Transplant ${(p as any).transplant}` : `Direct sow ${(p as any).directSow}`} · Harvest {p.harvest} · {p.spacing}" spacing
                  </div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:3, background:p.status==="started"?"rgba(91,127,166,0.12)":"rgba(140,128,112,0.1)", color:p.status==="started"?"var(--slate)":"var(--ink-faint)" }}>
                  {p.status==="started"?"Started indoors":"Not started"}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab==="calendar" && (
          <div style={{ maxWidth:720 }}>
            <div style={{ fontSize:13, color:"var(--ink-faint)", marginBottom:28, fontStyle:"italic" }}>Zone 6a · Ann Arbor, MI · Last frost April 20</div>
            {TIMELINE.map((event, i) => (
              <div key={i} style={{ display:"flex", gap:20, marginBottom:20 }}>
                <div style={{ width:110, flexShrink:0, paddingTop:3, fontFamily:"'Playfair Display', serif", fontSize:13, fontWeight:700, color:event.color }}>{event.month}</div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:event.color, marginTop:4 }} />
                  {i < TIMELINE.length-1 && <div style={{ width:2, flex:1, background:"var(--border)", marginTop:4 }} />}
                </div>
                <div style={{ flex:1, paddingBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:event.color, marginBottom:6 }}>{event.label}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {event.items.map(item => (
                      <span key={item} style={{ fontSize:12, padding:"3px 9px", borderRadius:20, background:event.color+"15", color:"var(--ink-light)", border:`1px solid ${event.color}30` }}>{item}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

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
                <div style={{ fontSize:14 }}>No harvests yet — check back in June!</div>
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

      {showLog && (
        <div style={{ position:"fixed", inset:0, background:"rgba(30,26,20,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }} onClick={() => setShowLog(false)}>
          <div style={{ background:"var(--warm-white)", borderRadius:10, width:480, padding:32, boxShadow:"0 24px 64px rgba(0,0,0,0.28)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, marginBottom:6 }}>🌿 Log a Harvest</div>
            <div style={{ fontSize:13, color:"var(--ink-faint)", marginBottom:24 }}>What did you pull from the garden today?</div>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--ink-light)", marginBottom:8 }}>Which bed?</div>
                <div style={{ display:"flex", gap:8 }}>
                  {[1,2,3].map(b => (
                    <button key={b} onClick={() => { setLogBed(b); setLogPlant(""); }} style={{ flex:1, padding:"10px 8px", borderRadius:6, cursor:"pointer", border:`1px solid ${logBed===b?BED_COLORS[b]:"var(--border)"}`, background:logBed===b?BED_COLORS[b]+"18":"var(--warm-white)", fontFamily:"'Lato', sans-serif" }}>
                      <div style={{ fontSize:13, fontWeight:logBed===b?700:400, color:logBed===b?BED_COLORS[b]:"var(--ink-faint)" }}>Bed {b}</div>
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
