import React from "react";
import { useState } from "react";

const calcQi = (val, ideal, limit) => {
  if (limit === ideal) return 0;
  return Math.min(Math.max(Math.abs((val - ideal) / (limit - ideal)) * 100, 0), 100);
};

const arcSlice = (cx, cy, r, startDeg, endDeg) => {
  const toRad = d => (d * Math.PI) / 180;
  const s = toRad(startDeg), e = toRad(endDeg);
  const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
};

const SEGS = [
  { from: 0,  to: 20,  fill: "#C0DD97" },
  { from: 20, to: 40,  fill: "#a8d47a" },
  { from: 40, to: 60,  fill: "#FAC775" },
  { from: 60, to: 80,  fill: "#F09595" },
  { from: 80, to: 100, fill: "#E24B4A" },
];

const BANDS = [
  { range: "0–25",   name: "Excellent",  bg: "#EAF3DE", color: "#3B6D11", min: 0,   max: 25   },
  { range: "26–50",  name: "Good",       bg: "#C0DD97", color: "#27500A", min: 26,  max: 50   },
  { range: "51–75",  name: "Poor",       bg: "#FAC775", color: "#633806", min: 51,  max: 75   },
  { range: "76–100", name: "Very Poor",  bg: "#F09595", color: "#791F1F", min: 76,  max: 100  },
  { range: ">100",   name: "Unsuitable", bg: "#E24B4A", color: "#fff",    min: 101, max: 9999 },
];

function Meter({ score }) {
  const cx = 150, cy = 155, r = 138;
  const clamped = Math.min(Math.max(score ?? 0, 0), 110);
  const deg = 180 + (clamped / 100) * 180;
  const rad = (deg * Math.PI) / 180;
  const nx = (cx + 52 * Math.cos(rad)).toFixed(2);
  const ny = (cy + 52 * Math.sin(rad)).toFixed(2);
  return (
    <svg viewBox="0 0 300 170" width="100%" height="100%" style={{ overflow:"visible" }}>
      <defs><clipPath id="halfClip"><rect x="0" y="0" width="300" height="155"/></clipPath></defs>
      <g clipPath="url(#halfClip)">
        {SEGS.map((s, i) => (
          <path key={i} d={arcSlice(cx, cy, r, 180 + (s.from/100)*180, 180 + (s.to/100)*180)} fill={s.fill}/>
        ))}
      </g>
      <circle cx="150" cy="155" r="72" fill="#fff"/>
      <line x1="150" y1="155" x2={nx} y2={ny} stroke="#1a1f18" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="150" cy="155" r="6" fill="#1a1f18"/>
      <text x="12"  y="166" fontSize="10" fontFamily="'DM Mono',monospace" fill="#3B6D11">0</text>
      <text x="136" y="28"  fontSize="10" fontFamily="'DM Mono',monospace" fill="#854F0B">50</text>
      <text x="262" y="166" fontSize="10" fontFamily="'DM Mono',monospace" fill="#A32D2D">100</text>
    </svg>
  );
}

function Field({ id, label, unit, min, max, step, midLabel, hints, vals, setVals }) {
  const set = v => setVals(prev => ({ ...prev, [id]: v }));
  return (
    <div className="field">
      <div className="field-top">
        <span className="field-label">{label}</span>
        <span className="field-unit">{unit}</span>
      </div>
      <input
        type="number" min={min} max={max} step={step} value={vals[id]}
        onChange={e => set(parseFloat(e.target.value) || 0)}
        style={{ width:"100%", background:"transparent", border:"none", borderBottom:"1.5px solid var(--border2)", outline:"none", fontFamily:"'DM Mono',monospace", fontSize:20, fontWeight:500, color:"var(--text)", padding:"4px 0 6px" }}
      />
      <input type="range" min={min} max={max} step={step} value={vals[id]}
        onChange={e => set(parseFloat(e.target.value))}/>
      <div className="range-vals">
        <span>{min}</span><span>{midLabel ?? Math.round((min+max)/2)}</span><span>{max}</span>
      </div>
      <div className="ideal-hint">{hints}</div>
    </div>
  );
}

export default function WQIPage() {
  const [vals, setVals]     = useState({ ph:7.0, turb:1.0, cond:400, do:8.0, temp:25.0 });
  const [result, setResult] = useState(null);
  const [visible, setVisible] = useState(false);

  const calculate = () => {
    const { ph, turb, cond, do: doV, temp } = vals;
    const qPh   = calcQi(ph,   7.0, 8.5);
    const qTurb  = calcQi(turb, 0,   5);
    const qCond  = calcQi(cond, 0,   1500);
    const qDo    = calcQi(doV,  14,  5);
    const qTemp  = calcQi(temp, 25,  35);
    const score  = Math.round(qPh*0.25 + qTurb*0.25 + qCond*0.20 + qDo*0.20 + qTemp*0.10);
    let label, desc, color;
    if      (score <= 25)  { label="Excellent";  color="#3B6D11"; desc="Water is clean and safe for all uses including drinking."; }
    else if (score <= 50)  { label="Good";       color="#27500A"; desc="Acceptable quality. Suitable for most uses with minimal treatment."; }
    else if (score <= 75)  { label="Poor";       color="#854F0B"; desc="Polluted water. Treatment recommended before consumption."; }
    else if (score <= 100) { label="Very Poor";  color="#791F1F"; desc="Heavily polluted. Not safe to drink without extensive treatment."; }
    else                   { label="Unsuitable"; color="#501313"; desc="Water is unsafe. Requires urgent remediation."; }
    const params = [
      { name:"pH",          val:ph.toFixed(1),              unit:"",        qi:Math.round(qPh)   },
      { name:"Turbidity",   val:parseFloat(turb).toFixed(1),unit:" NTU",    qi:Math.round(qTurb) },
      { name:"Conductivity",val:parseFloat(cond).toFixed(0),unit:" µS/cm",  qi:Math.round(qCond) },
      { name:"D.O.",        val:parseFloat(doV).toFixed(1), unit:" mg/L",   qi:Math.round(qDo)   },
      { name:"Temperature", val:parseFloat(temp).toFixed(1),unit:"°C",      qi:Math.round(qTemp) },
    ];
    setResult({ score, label, color, desc, params });
    setVisible(false);
    setTimeout(() => setVisible(true), 10);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", padding:"18px 24px", gap:14, boxSizing:"border-box", overflow:"hidden" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", gap:14, flexShrink:0, paddingBottom:14, borderBottom:".5px solid var(--border2)" }}>
        <svg width="36" height="42" viewBox="0 0 48 56" fill="none">
          <path d="M24 4 C24 4 6 22 6 34 A18 18 0 0 0 42 34 C42 22 24 4 24 4Z" fill="#1D9E75" opacity="0.9"/>
          <path d="M15 38 Q19 32 24 35 Q29 38 33 31" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div>
          <h1 style={{ fontSize:22, fontWeight:500, letterSpacing:"-.02em", margin:0 }}>Water Quality Index</h1>
          <p style={{ fontSize:12, fontFamily:"'DM Mono',monospace", color:"var(--text2)", margin:"3px 0 0" }}>WHO standard reference values · weighted sub-index method</p>
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:16, flex:1, minHeight:0, overflow:"hidden" }}>

        {/* ── Left: Inputs ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:10, overflowY:"auto" }}>
          <div className="card card-pad" style={{ flexShrink:0 }}>
            <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:".07em", color:"var(--text3)", marginBottom:12 }}>Parameters</div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <Field id="ph"   label="pH"            unit="0 – 14"  min={0}  max={14}   step={0.1} midLabel={7}    hints="ideal: 7.0 | limit: 6.5–8.5"    vals={vals} setVals={setVals}/>
              <Field id="turb" label="Turbidity"     unit="NTU"     min={0}  max={100}  step={0.1} midLabel={50}   hints="ideal: 0 | limit: 5 NTU"         vals={vals} setVals={setVals}/>
              <Field id="cond" label="Conductivity"  unit="µS/cm"   min={0}  max={2000} step={1}   midLabel={1000} hints="ideal: 0 | limit: 1500 µS/cm"     vals={vals} setVals={setVals}/>
              <Field id="do"   label="Dissolved O₂"  unit="mg/L"    min={0}  max={20}   step={0.1} midLabel={10}   hints="ideal: ≥8 mg/L | limit: 5 mg/L"  vals={vals} setVals={setVals}/>
              <Field id="temp" label="Temperature"   unit="°C"      min={0}  max={45}   step={0.1} midLabel={22}   hints="ideal: 25°C | limit: ±10°C"       vals={vals} setVals={setVals}/>
            </div>
            <button className="btn-teal" style={{ width:"100%", marginTop:18, borderRadius:"var(--r-lg)", fontSize:15, padding:"11px" }} onClick={calculate}>
              Calculate WQI →
            </button>
          </div>


        </div>

        {/* ── Right: Results ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:12, minHeight:0, overflow:"hidden" }}>

          {!result && (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ textAlign:"center", fontFamily:"'DM Mono',monospace", color:"var(--text3)", fontSize:13 }}>
                <div style={{ fontSize:40, marginBottom:12, opacity:.3 }}>💧</div>
                Set parameters and calculate to see results
              </div>
            </div>
          )}

          {result && visible && (
            <div className="fade-up" style={{ display:"flex", flexDirection:"column", gap:12, flex:1, minHeight:0, overflow:"hidden" }}>

              {/* Top row: meter + bands */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, flexShrink:0 }}>

                {/* Meter card */}
                <div className="card" style={{ padding:"18px 16px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                  <div style={{ width:"100%", maxWidth:260, aspectRatio:"300/170" }}>
                    <Meter score={result.score}/>
                  </div>
                  <div style={{ fontSize:52, fontWeight:300, lineHeight:1, color:result.color, marginTop:8 }}>{result.score}</div>
                  <div style={{ fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:500, letterSpacing:".08em", textTransform:"uppercase", color:result.color, marginTop:4 }}>{result.label}</div>
                  <div style={{ fontSize:12, color:"var(--text2)", marginTop:6, fontStyle:"italic", fontWeight:300, textAlign:"center" }}>{result.desc}</div>
                </div>

                {/* Bands */}
                <div style={{ display:"flex", flexDirection:"column", gap:8, justifyContent:"center" }}>
                  {BANDS.map(b => {
                    const active = result.score >= b.min && result.score <= b.max;
                    return (
                      <div key={b.name} style={{ borderRadius:"var(--r-md)", padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", border:`2px solid ${active?"rgba(0,0,0,.3)":"transparent"}`, background:b.bg, transform:active?"translateX(4px)":"none", transition:"all .25s" }}>
                        <div style={{ fontSize:12, fontWeight:500, color:b.color }}>{b.name}</div>
                        <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:b.color, opacity:.8 }}>{b.range}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sub-index param chips */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, flexShrink:0 }}>
                {result.params.map(p => (
                  <div key={p.name} className="card" style={{ padding:"12px 14px" }}>
                    <div style={{ fontSize:9, fontFamily:"'DM Mono',monospace", color:"var(--text3)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>{p.name}</div>
                    <div style={{ fontSize:17, fontWeight:500, fontFamily:"'DM Mono',monospace" }}>{p.val}{p.unit}</div>
                    <div style={{ fontSize:10, color:"var(--text2)", marginBottom:6 }}>sub-index: {p.qi}/100</div>
                    <div className="qi-bar-bg">
                      <div className="qi-bar-fill" style={{ width:`${p.qi}%`, background:p.qi<=25?"#1D9E75":p.qi<=50?"#639922":p.qi<=75?"#EF9F27":"#E24B4A" }}/>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}